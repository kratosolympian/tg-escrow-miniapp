#!/usr/bin/env node
/*
Run the idempotent SQL migration to create `admin_users` and update policies.

Usage:
  Set SUPABASE_DB_URL to your Postgres connection string (service role) then run:
    node ./scripts/run-migration.js

This script is intentionally simple and synchronous: it reads the SQL file and executes it inside a transaction.
It also runs a safe seed to populate `admin_users` from `profiles`.
*/
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { Client } from "pg";

// Load .env.local if present (same pattern as other scripts)
const envPath = path.resolve(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const MIGRATION_SQL_PATH = new URL(
  "../SQL/2025-09-26-replace-is_admin-with-admin_users.sql",
  import.meta.url,
).pathname;

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error(
      "ERROR: SUPABASE_DB_URL (or DATABASE_URL) not set. Provide a Postgres connection string with a service-role user.",
    );
    process.exit(2);
  }

  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    console.log("Connected to DB. Reading migration SQL...");
    const sql = fs.readFileSync(MIGRATION_SQL_PATH, "utf8");

    console.log("Starting transaction and executing migration SQL...");
    await client.query("BEGIN");
    await client.query(sql);

    console.log(
      'Running safe seed: insert admin users from profiles where role = \"admin\"',
    );
    await client.query(
      `INSERT INTO public.admin_users (user_id)
       SELECT id FROM public.profiles WHERE role = 'admin'
       ON CONFLICT DO NOTHING;`,
    );

    await client.query("COMMIT");
    console.log("Migration and seed completed successfully.");
  } catch (err) {
    console.error("Migration failed, rolling back. Error:");
    console.error(err && err.message ? err.message : err);
    try {
      await client.query("ROLLBACK");
    } catch (e) {}
    process.exit(1);
  } finally {
    await client.end();
  }
}

if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1].endsWith("run-migration.js")
) {
  main();
}
