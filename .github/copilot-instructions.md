
## Purpose
This file gives short, practical instructions to AI coding agents (Copilot-style assistants) to be immediately productive in this repository. Focus on discoverable patterns, developer workflows, and precise file examples.

## Big picture
- Framework: Next.js 14 (App Router) + TypeScript. App code lives under `app/` and API routes under `app/api/`.
- Backend: Supabase (Postgres) for DB, Auth and Storage. DB schema & RLS policies live in `SQL/` and `supabase/`.
- Auth: Telegram WebApp → Supabase bridge. See `app/api/auth/` and `lib/signedAuth.ts` / `lib/ephemeralAuth.ts` for token flows.
- Clients: `lib/supabaseClient.ts` (browser/anon) and `lib/supabaseServer.ts` (server/service-role and cookie/header helpers).

## Dev & CI workflows (explicit commands)
-- Unit tests: (none configured)
-- Playwright e2e: (removed)

Note: DB migration and reset are manual; `package.json` scripts only print hints. Run SQL files in the Supabase SQL editor in this order: `SQL/schema.sql`, `SQL/rls.sql`, `SQL/storage.sql`.
## Testing and debugging tips
For debugging server-side Supabase calls, set environment vars in `.env.local` (see `README.md`) and run the dev server; server logs appear in terminal.
- Signed one-time tokens live in memory + DB fallback: `lib/signedAuth.ts`. Use `createSignedToken` and `verifyAndConsumeSignedToken` for short-lived links.
- Ephemeral login tokens: `lib/ephemeralAuth.ts` provides an in-memory UUID store used by admin demo and tests.
- Types: generated DB types are under `supabase/types.generated.ts`. Import `Database` where helpful.
- UI: components under `components/` follow Next.js server/client boundary rules (check `app/` files for use of server components).

## Key files to inspect for changes
- `app/api/` — API endpoints (auth, escrow, admin, storage). Use these when adding backend behavior.
- `app/admin/` — Admin UI pages and demo flows (useful for admin UX changes).
- `lib/supabaseServer.ts`, `lib/supabaseClient.ts` — central Supabase wiring.
- `lib/signedAuth.ts`, `lib/ephemeralAuth.ts` — token and temporary auth behavior.
- `SQL/*.sql` & `supabase/seed.sql` — DB schema, RLS and initial data. Changing DB shape requires updating these and running migrations manually.

## Testing and debugging tips
For debugging server-side Supabase calls, set environment vars in `.env.local` (see `README.md`) and run the dev server; server logs appear in terminal.

## Integration & external dependencies
- Supabase: required env vars are `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Telegram: `TELEGRAM_BOT_TOKEN` and `TG_AUTH_SECRET` used for WebApp integration and auth signing.
- Vercel: recommended deploy target; ensure env vars are configured in project settings.

## Patterns & examples
- Upload flow: client requests a signed URL via `POST app/api/storage/sign-url`, then uploads receipts to Supabase Storage. See `app/api/storage/` and `lib/supabaseHelpers.ts`.
- Admin confirm payment: `POST app/api/admin/confirm-payment` — server uses `createServiceRoleClient()` to perform privileged DB writes.
- One-time tokens: `lib/signedAuth.ts` creates signed payloads with HMAC; `verifyAndConsumeSignedToken` prefers DB-backed consumption for multi-process safety.

## When editing code
- Preserve RLS assumptions: DB-level access is enforced by RLS; adding server calls that require service role must use `createServiceRoleClient()`.
- If adding new DB tables/columns, add SQL to `SQL/schema.sql` (and RLS rules to `SQL/rls.sql`) and include instructions in README on applying them to Supabase.

## Quick references (paths)
- App routes: `app/api/*`
- UI: `app/*`, `components/*`
- Supabase wiring: `lib/supabaseClient.ts`, `lib/supabaseServer.ts`
- Token helpers: `lib/signedAuth.ts`, `lib/ephemeralAuth.ts`
- DB schema & RLS: `SQL/`, `supabase/`
-- Tests: (none)

## Final notes
- Keep changes minimal to the App Router and API route contracts; many client pages expect specific JSON shapes. Reference API handlers when changing request/response shapes.
- If you need more details (example requests, expected DB rows), ask and I will extract specific handler code and DB schemas.

Please review this update and tell me if you'd like more examples (specific API handlers, full request shape examples, or test run instructions).
