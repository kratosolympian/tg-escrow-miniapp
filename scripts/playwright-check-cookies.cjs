const playwright = require("playwright");
(async () => {
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
    // in-page dev signin
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
    const cookies = await context.cookies();
    console.log(
      "cookies:",
      cookies.map((c) => ({
        name: c.name,
        domain: c.domain,
        path: c.path,
        httpOnly: c.httpOnly,
        sameSite: c.sameSite,
      })),
    );
  } catch (e) {
    console.error("error", e);
  } finally {
    await browser.close();
  }
})();
