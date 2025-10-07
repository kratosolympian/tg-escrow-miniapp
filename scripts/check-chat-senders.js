#!/usr/bin/env node
// Usage: node scripts/check-chat-senders.js --escrow <ESCROW_ID> --url <BASE_URL>
// Example: node scripts/check-chat-senders.js --escrow 151a3151-42b7-477a-bf52-7be2a331befc --url http://localhost:3001

// simple arg parsing (no external deps)
const rawArgs = process.argv.slice(2);
let escrowId = null;
let baseUrl = "http://localhost:3001";
for (let i = 0; i < rawArgs.length; i++) {
  const a = rawArgs[i];
  if (a === "--escrow" || a === "-e") {
    escrowId = rawArgs[i + 1];
    i++;
  } else if (a === "--url" || a === "-u") {
    baseUrl = rawArgs[i + 1];
    i++;
  } else if (a === "--cookie" || a === "-c") {
    // provide a Cookie header string, e.g. "sb:token=...; sb:refresh-token=..."
    cookieHeader = rawArgs[i + 1];
    i++;
  } else if (a === "--bearer" || a === "-b") {
    // provide a Bearer token string
    bearerToken = rawArgs[i + 1];
    i++;
  }
}

if (!escrowId) {
  console.error("Missing --escrow <ESCROW_ID>");
  process.exit(2);
}

let fetchImpl = global.fetch;
if (!fetchImpl) {
  try {
    // try node-fetch if available
    fetchImpl = require("node-fetch");
  } catch (e) {
    console.error(
      "Node does not have global fetch and node-fetch is not installed. Please run: pnpm add -D node-fetch or run on Node 18+.",
    );
    process.exit(2);
  }
}
const fetch = fetchImpl;

async function main() {
  try {
    const url = `${baseUrl.replace(/\/$/, "")}/api/escrow/${escrowId}/chat`;
    console.log("Fetching", url);
    const headers = {};
    if (typeof cookieHeader !== "undefined" && cookieHeader !== null)
      headers["Cookie"] = cookieHeader;
    if (typeof bearerToken !== "undefined" && bearerToken !== null)
      headers["Authorization"] = `Bearer ${bearerToken}`;
    const res = await fetch(url, { headers, credentials: "include" });
    if (!res.ok) {
      console.error("Request failed:", res.status, await res.text());
      process.exit(3);
    }
    const data = await res.json();
    if (!data.success || !Array.isArray(data.messages)) {
      console.error(
        "Unexpected response shape:",
        JSON.stringify(data, null, 2),
      );
      process.exit(4);
    }
    const msgs = data.messages;
    console.log("Total messages:", msgs.length);
    const missing = msgs.filter((m) => !m.sender || !m.sender.full_name);
    if (missing.length === 0) {
      console.log("All messages include sender.full_name ✅");
      process.exit(0);
    }
    console.log("Messages missing sender.full_name:", missing.length);
    for (const m of missing) {
      console.log(
        `- id=${m.id} sender_id=${m.sender_id} message="${String(m.message).slice(0, 80)}"`,
      );
    }
    process.exit(1);
  } catch (err) {
    console.error("Error:", err);
    process.exit(5);
  }
}

main();
