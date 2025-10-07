Title: Replace ephemeral one-time tokens with signed HMAC tokens + DB-backed single-use storage

Summary:

- Replaces the in-memory ephemeral UUID one-time token helper with a signed HMAC token system (`lib/signedAuth.ts`).
- Tokens are HMAC-signed and include a token id and expiry in their payload. Servers verify the signature and either consume from DB (`one_time_tokens` table) or fall back to an in-memory cache.
- Added a migration SQL: `SQL/migrations/20250912_create_one_time_tokens.sql`.
- Updated `app/api/auth/*` and `app/api/escrow/join` routes to use the new API.
- Added a unit test for the token helper and extended the integration test to exercise header-based token usage.

Environment:

- Add `SIGNED_TOKEN_SECRET` to production environment variables. In dev the helper falls back to a default value but this is insecure.

Notes:

- DB-backed deletion is best-effort and uses the service role client. This provides single-use semantics across processes but requires the migration to be applied.
- If you prefer Redis for token storage, I can replace the DB calls with Redis ops.

How to run locally:

1. Install deps: `pnpm install`
2. Run the migration in Supabase using the SQL file `SQL/migrations/20250912_create_one_time_tokens.sql`.
3. Run the app: `pnpm run dev` or build: `pnpm run build`.

Files changed (high-level):

- lib/signedAuth.ts (rewritten)
- SQL/migrations/20250912_create_one_time_tokens.sql (new)
- scripts/integration-test.mjs (updated to exercise headers)
- test/signedAuth.test.ts (new)
- package.json (test script + dev deps)
- scripts/integration-test.mjs (updated to exercise headers)
- package.json (dev deps)

Follow-ups:

- Add Redis-based storage option for high-throughput deployments.
- Add more unit tests and CI integration for test runs.
- Open actual PR branch and CI workflow (I can create the branch & PR if you want).
