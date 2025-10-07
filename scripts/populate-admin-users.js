import fs from "fs";
import path from "path";
import fetch from "node-fetch";
import dotenv from "dotenv";

// Load .env.local if present
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
let SUPABASE_PROJECT_URL = process.env.SUPABASE_PROJECT_URL || null;
if (!SUPABASE_PROJECT_URL && process.env.NEXT_PUBLIC_SUPABASE_URL) {
  SUPABASE_PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL.replace(
    /^https?:\/\//,
    "",
  ).replace(/\/$/, "");
}

if (!SERVICE_ROLE || !SUPABASE_PROJECT_URL) {
  console.error(
    "Please set SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_PROJECT_URL) in .env.local or environment",
  );
  process.exit(2);
}

const base = `https://${SUPABASE_PROJECT_URL}`;

async function fetchAdminProfiles() {
  const url = `${base}/rest/v1/profiles?select=id&role=eq.admin`;
  const headers = {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    Accept: "application/json",
  };
  const res = await fetch(url, { method: "GET", headers });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Failed to fetch admin profiles: ${res.status} ${txt}`);
  }
  const data = await res.json();
  return data; // array of { id }
}

async function insertAdminUser(id) {
  const url = `${base}/rest/v1/admin_users`;
  const headers = {
    apikey: SERVICE_ROLE,
    Authorization: `Bearer ${SERVICE_ROLE}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const body = JSON.stringify({ user_id: id });
  const res = await fetch(url, { method: "POST", headers, body });
  if (res.ok) return true;
  // if conflict, PostgREST may return 409; treat as success
  if (res.status === 409) return false;
  const txt = await res.text().catch(() => "");
  throw new Error(`Failed to insert admin_user ${id}: ${res.status} ${txt}`);
}

async function main() {
  try {
    console.log("Fetching profiles with role=admin...");
    const admins = await fetchAdminProfiles();
    if (!Array.isArray(admins) || admins.length === 0) {
      console.log("No admin profiles found. Nothing to do.");
      process.exit(0);
    }
    console.log(
      `Found ${admins.length} admin profiles. Inserting into admin_users...`,
    );
    let inserted = 0;
    for (const a of admins) {
      const id = a.id || a.user_id || a;
      try {
        const ok = await insertAdminUser(id);
        if (ok) {
          console.log("Inserted admin_users row for", id);
          inserted++;
        } else {
          console.log("Skipped (already exists):", id);
        }
      } catch (e) {
        console.error("Error inserting", id, e.message || e);
      }
    }
    console.log(
      `Done. Inserted ${inserted} rows. Total admins processed: ${admins.length}`,
    );
    process.exit(0);
  } catch (err) {
    console.error("Script failed:", err.message || err);
    process.exit(1);
  }
}

main();
