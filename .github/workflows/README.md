This workflow allows running the migration and the reproducer against the staging environment.

Required repository secrets (add these in your GitHub repo settings -> Secrets):

- STAGING_SUPABASE_DB_URL: Postgres connection string (service role or db user able to run migrations)
- STAGING_SUPABASE_URL: Supabase project URL (e.g. https://xyz.supabase.co)
- STAGING_SUPABASE_SERVICE_ROLE_KEY: Supabase service-role key
- STAGING_SUPABASE_ANON_KEY: Supabase anon key (used by reproducer if needed)
- STAGING_BASE_URL: Optional base URL for the running staging app (if reproducer calls it)

To run:

1. Push this branch and open the Actions -> Migrate and test on staging -> Run workflow.
2. Monitor the job logs for migration output and reproducer results.

Notes:

- The workflow uses `scripts/run-migration.js` and `scripts/populate-admin-users.js` from the repository. Ensure those scripts are correct and idempotent for your staging environment.
- If your staging DB is not reachable from GitHub Actions (rare), run the SQL manually in the Supabase SQL editor.
