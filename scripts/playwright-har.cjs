const fs = require("fs");
const path = require("path");
const playwright = require("playwright");

(async () => {
  const outDir = path.resolve(__dirname, "playwright-output");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const harPath = path.join(outDir, "capture.har");
  const requestsPath = path.join(outDir, "requests.json");
  const responsesPath = path.join(outDir, "responses.json");
  const cookiesPath = path.join(outDir, "cookies.json");
  const failingPath = path.join(outDir, "failing-requests.json");

  const headless = process.env.HEADLESS !== "false";
  const browser = await playwright.chromium.launch({ headless });
  const context = await browser.newContext({
    recordHar: { path: harPath, omitContent: false },
  });
  const page = await context.newPage();

  const requests = [];
  const responses = [];
  const consoles = [];

  page.on("request", (req) => {
    try {
      requests.push({
        id: req._requestId || req.url(),
        url: req.url(),
        method: req.method(),
        headers: req.headers(),
        postData: req.postData ? req.postData() : undefined,
        timestamp: Date.now(),
      });
    } catch (e) {
      // ignore
    }
  });

  page.on("response", async (res) => {
    try {
      const req = res.request();
      const body = await res.text().catch(() => null);
      responses.push({
        url: res.url(),
        status: res.status(),
        statusText: res.statusText(),
        headers: res.headers(),
        request: {
          url: req.url(),
          method: req.method(),
          headers: req.headers(),
        },
        body:
          body && body.length > 10000
            ? body.slice(0, 10000) + "...[truncated]"
            : body,
        timestamp: Date.now(),
      });
    } catch (e) {
      // ignore
    }
  });

  // capture console messages with timestamps
  page.on("console", (msg) => {
    try {
      consoles.push({
        type: msg.type(),
        text: msg.text(),
        location: msg.location ? msg.location() : null,
        timestamp: Date.now(),
      });
    } catch (e) {
      // ignore
    }
  });

  try {
    const origin = "http://localhost:3002";
    // Install in-page instrumentation so outgoing fetch/XHR requests and headers are
    // printed to the page console. This makes it easy to see whether Cookie headers
    // are included on API calls in headful captures.
    await page.addInitScript(() => {
      // helper to normalize headers into a plain object
      function headersToObject(h) {
        const out = {};
        try {
          if (!h) return out;
          // if it's a plain object
          if (typeof h === "object" && !h.forEach && !(h instanceof Headers)) {
            try {
              for (const k of Object.keys(h)) out[k.toLowerCase()] = h[k];
            } catch (e) {}
            return out;
          }
          // if it's an array of pairs
          if (Array.isArray(h)) {
            try {
              for (const [k, v] of h) out[k.toLowerCase()] = v;
            } catch (e) {}
            return out;
          }
          // if it's a Headers-like object
          try {
            if (typeof h.entries === "function") {
              for (const [k, v] of h.entries()) out[k.toLowerCase()] = v;
              return out;
            }
          } catch (e) {}
        } catch (e) {}
        return out;
      }

      // wrap fetch to log method, url, credentials, and headers (serialized)
      try {
        const _fetch = window.fetch;
        window.fetch = async function (input, init) {
          try {
            const method =
              (init && init.method) ||
              (typeof input === "string"
                ? "GET"
                : (input && input.method) || "GET");
            const url =
              typeof input === "string" ? input : (input && input.url) || "";
            const credentials =
              (init && init.credentials) ||
              (typeof input === "object" && input && input.credentials) ||
              "omit";
            // gather headers from init or from Request
            const headers = {};
            try {
              Object.assign(headers, headersToObject(init && init.headers));
            } catch (e) {}
            try {
              if (typeof input !== "string" && input && input.headers)
                Object.assign(headers, headersToObject(input.headers));
            } catch (e) {}
            // if cookie is readable via document.cookie, also include it for convenience
            let docCookie = "(unreadable)";
            try {
              docCookie = document.cookie || "(empty)";
            } catch (e) {
              docCookie = "(err)";
            }
            console.log("[INSTRUMENT][fetch] ->", method, url, {
              credentials,
              headers,
              documentCookie: docCookie,
            });
          } catch (e) {
            console.log(
              "[INSTRUMENT][fetch] error prepping log",
              e && e.message,
            );
          }
          return _fetch.apply(this, arguments);
        };
      } catch (e) {
        console.log("[INSTRUMENT] fetch wrap failed", e && e.message);
      }

      // wrap XHR: capture open, setRequestHeader, and send
      try {
        const _open = XMLHttpRequest.prototype.open;
        const _send = XMLHttpRequest.prototype.send;
        const _setRequestHeader = XMLHttpRequest.prototype.setRequestHeader;
        XMLHttpRequest.prototype.open = function (method, url) {
          this.__instrument_method = method;
          this.__instrument_url = url;
          this.__instrument_request_headers =
            this.__instrument_request_headers || {};
          return _open.apply(this, arguments);
        };
        XMLHttpRequest.prototype.setRequestHeader = function (header, value) {
          try {
            this.__instrument_request_headers =
              this.__instrument_request_headers || {};
            this.__instrument_request_headers[header.toLowerCase()] = value;
          } catch (e) {}
          return _setRequestHeader.apply(this, arguments);
        };
        XMLHttpRequest.prototype.send = function (body) {
          try {
            const headers = this.__instrument_request_headers || {};
            let docCookie = "(unreadable)";
            try {
              docCookie = document.cookie || "(empty)";
            } catch (e) {
              docCookie = "(err)";
            }
            console.log(
              "[INSTRUMENT][xhr] ->",
              this.__instrument_method || "GET",
              this.__instrument_url || "",
              {
                headers,
                body: body
                  ? String(body).slice(0, 200) +
                    (String(body).length > 200 ? "...[truncated]" : "")
                  : undefined,
                documentCookie: docCookie,
              },
            );
          } catch (e) {
            console.log("[INSTRUMENT][xhr] error prepping log", e && e.message);
          }
          return _send.apply(this, arguments);
        };
      } catch (e) {
        console.log("[INSTRUMENT] xhr wrap failed", e && e.message);
      }
    });

    await page.goto(origin, { waitUntil: "networkidle" });

    // in-page dev signin so browser receives Set-Cookie headers
    const buyerEmail = "buy@kratos.ng";
    const signin = await page.evaluate(async (email) => {
      const resp = await fetch("/api/dev/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const j = await resp.json().catch(() => null);
      return { status: resp.status, json: j };
    }, buyerEmail);
    console.log("dev signin status (in-page):", signin.status);

    // Log document.cookie from page context so we can see non-httpOnly cookies in console
    try {
      await page.evaluate(() => {
        try {
          console.log(
            "[INSTRUMENT][document.cookie] ->",
            document.cookie || "(empty)",
          );
        } catch (e) {
          console.log("[INSTRUMENT][document.cookie] -> error", e && e.message);
        }
      });
    } catch (e) {
      // ignore
    }

    // collect cookies after sign-in
    const cookies = await context.cookies();
    fs.writeFileSync(cookiesPath, JSON.stringify(cookies, null, 2));
    console.log("Wrote cookies to", cookiesPath);

    // navigate to escrow page that was failing in repros
    const escrowPath = "/buyer/escrow/MG171MFW7GRE";
    await page.goto(origin + escrowPath, { waitUntil: "networkidle" });

    // wait a bit for background fetches
    await page.waitForTimeout(4000);

    // Explicitly call sign-url and upload-receipt so server-side _debug (when DEBUG=1)
    // will be present in the captured responses. This ensures the endpoints
    // are exercised even if the page doesn't trigger them during normal load.
    try {
      await page.evaluate(async () => {
        try {
          console.log("[INSTRUMENT][explicit] -> sign-url call");
          const resp = await fetch("/api/storage/sign-url", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              path: "MG171MFW7GRE/receipt-test.jpg",
              bucket: "receipts",
            }),
          });
          const j = await resp.json().catch(() => null);
          console.log(
            "[INSTRUMENT][explicit][sign-url] status",
            resp.status,
            "json",
            j,
          );
        } catch (e) {
          console.log("[INSTRUMENT][explicit][sign-url] error", e && e.message);
        }

        try {
          console.log("[INSTRUMENT][explicit] -> upload-receipt call");
          const fd = new FormData();
          // Use a real image blob for testing
          const imageData =
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="; // 1x1 transparent PNG
          const blob = new Blob(
            [Uint8Array.from(atob(imageData), (c) => c.charCodeAt(0))],
            { type: "image/png" },
          );
          fd.append("file", blob, "test-receipt.png");
          fd.append("escrowId", "MG171MFW7GRE");
          const resp2 = await fetch("/api/escrow/upload-receipt", {
            method: "POST",
            body: fd,
            credentials: "include",
          });
          const j2 = await resp2.json().catch(() => null);
          console.log(
            "[INSTRUMENT][explicit][upload-receipt] status",
            resp2.status,
            "json",
            j2,
          );
        } catch (e) {
          console.log(
            "[INSTRUMENT][explicit][upload-receipt] error",
            e && e.message,
          );
        }
      });
    } catch (e) {
      // ignore page evaluate errors
    }

    // Also log document.cookie after navigation
    try {
      await page.evaluate(() => {
        try {
          console.log(
            "[INSTRUMENT][document.cookie-after-nav] ->",
            document.cookie || "(empty)",
          );
        } catch (e) {
          console.log(
            "[INSTRUMENT][document.cookie-after-nav] -> error",
            e && e.message,
          );
        }
      });
    } catch (e) {
      // ignore
    }

    fs.writeFileSync(requestsPath, JSON.stringify(requests, null, 2));
    fs.writeFileSync(responsesPath, JSON.stringify(responses, null, 2));
    fs.writeFileSync(
      path.join(outDir, "console.json"),
      JSON.stringify(consoles, null, 2),
    );

    // Correlate console messages to nearest network event (within 3000ms)
    const correlation = consoles
      .map((c) => {
        // find nearest response by timestamp distance
        const nearest = responses.reduce((best, r) => {
          const dt = Math.abs((r.timestamp || 0) - c.timestamp);
          if (!best || dt < best.dt) return { r, dt };
          return best;
        }, null);
        return {
          console: c,
          nearestResponse: nearest
            ? {
                url: nearest.r.url,
                status: nearest.r.status,
                timestamp: nearest.r.timestamp,
                requestHeaders: nearest.r.request.headers,
              }
            : null,
          withinMs: nearest ? nearest.dt : null,
        };
      })
      .filter((entry) => entry.withinMs !== null && entry.withinMs <= 3000);

    fs.writeFileSync(
      path.join(outDir, "correlation.json"),
      JSON.stringify(correlation, null, 2),
    );

    const failing = responses
      .filter((r) => r.status >= 400)
      .map((r) => ({
        url: r.url,
        status: r.status,
        requestHeaders: r.request.headers,
      }));
    fs.writeFileSync(failingPath, JSON.stringify(failing, null, 2));
    console.log("Wrote requests/responses/failing lists to", outDir);
  } catch (e) {
    console.error("error during capture", e);
  } finally {
    await context.close();
    await browser.close();
  }
})();
