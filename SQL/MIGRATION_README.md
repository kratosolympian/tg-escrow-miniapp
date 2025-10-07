# Migration: replace public.is_admin usage with admin_users table

## Purpose

This checklist documents a safe, idempotent way to apply the migration that removes the dependence on the `public.is_admin()` helper (which selected from `profiles`) and introduces an `admin_users` table used by RLS policies. Applying this migration prevents the "infinite recursion detected in policy for relation \"profiles\"" (Postgres 42P17) when auth-driven policies reference `profiles`.

## Files you already have in this repo

- `SQL/2025-09-26-replace-is_admin-with-admin_users.sql` — idempotent migration that creates `admin_users` and updates policies to reference it.
- `SQL/schema.sql` and `SQL/fix_rls_recursion.sql` — updated copies in the repo showing the new policy shapes.
- `scripts/populate-admin-users.js` — optional script to copy existing admin flags from `profiles` into `admin_users`.
- `scripts/reproduce-profile-recursion.js` — quick local reproducer to verify the 42P17 error or the absence of it after migration.

## High-level steps (manual in Supabase SQL editor)

1. Open your Supabase project and go to SQL -> Editor. Make sure you are logged in with an admin/service-role account.
2. Copy the contents of `SQL/2025-09-26-replace-is_admin-with-admin_users.sql` and run the whole file in the editor. The migration is idempotent and safe to re-run.
3. Seed `admin_users` from existing `profiles` if you use `profiles.role = 'admin'` or a similar marker. Example:

   INSERT INTO public.admin_users (user_id)
   SELECT id FROM public.profiles WHERE role = 'admin'
   ON CONFLICT DO NOTHING;

   If you prefer to run the project's helper script instead (requires Node and SUPABASE_SERVICE_ROLE_KEY in env):

   # PowerShell

   $env:SUPABASE_SERVICE_ROLE_KEY = 'your_service_role_key_here'; node .\scripts\populate-admin-users.js

4. Verify the table was populated:

   SELECT count(\*) FROM public.admin_users;

5. Re-run a reproducer from a developer machine (this uses your NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY or the project test helper):

   node .\scripts\reproduce-profile-recursion.js

   Expect: The PostgREST fetch that previously returned the 42P17 error should return 200 and the escrow row.

6. If everything is fine, roll this change out to other environments (staging, production) following the same steps.

## Notes and rollbacks

- The migration is additive (creates `admin_users` and updates policy expressions to reference it). If you must rollback, restore DB snapshot prior to running the migration.
- Do NOT delete the original `public.is_admin` function immediately if you are running a rolling deployment with multiple app instances. Keep it until you have migrated all environments and validated behavior. Once everything is migrated and no code paths call it, you can safely drop it.

## Automated option (careful)

If you want a one-shot automated migration script that runs against your Supabase project, I can add a Node script that uses the admin/service role key to execute the migration and the seed step. This requires adding a small dependency (supabase-js). I can prepare and commit that if you want — mark the todo and I will add it.

## Support/Verification

If you'd like, I can:

- Prepare a PR with this README and an optional automated migration script.
- Provide the exact psql commands for running this migration from CI (with connection string including service role key).
- Help coordinate a safe rollout for production (order of operations, smoke tests, and monitoring points).

Checklist complete by: GitHub Copilot (local changes); run migration in Supabase to complete the fix in each environment.
