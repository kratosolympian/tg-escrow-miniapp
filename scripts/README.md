simulate-escrow script

This script simulates a full escrow flow (seller creates escrow, buyer joins, uploads receipt, chat, mark delivered, confirm received).

Requirements:

- Node.js installed (v18+ recommended)
- From repo root run:

```bash
pnpm add node-fetch form-data tough-cookie fetch-cookie
```

Run:

```bash
SUPABASE_SERVICE_ROLE_KEY="<your service role key>" \
SUPABASE_PROJECT_URL="<your-project>.supabase.co" \
node ./scripts/simulate-escrow.js
```

Environment variables:

- BASE_URL (optional, default http://localhost:3000)
- SUPABASE_SERVICE_ROLE_KEY (required for headless admin user creation)
- SUPABASE_PROJECT_URL (required to call Supabase Admin REST API; example: myproject.supabase.co)
- SELLER_EMAIL, BUYER_EMAIL, TEST_PASSWORD (optional overrides)

Notes:

- This script uses the Supabase Admin REST API to create users, then logs them in via the app's `/api/auth/login` route using cookie jars. It asserts expected states at each step and exits non-zero on failure.
- Keep the service role key secret. Do not commit it into source control.
- If your local dev server uses a different auth flow, you may need to adapt the script credentials or endpoints.
