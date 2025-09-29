What changed

- The escrow fetch endpoints now include a `signed_url` field on each receipt returned to a member (buyer/seller/admin as appropriate).
- Signed URLs are generated with a 900-second (15 minute) expiry using the Supabase Service Role client.

Why

- This saves a round-trip: the client no longer needs to call `/api/storage/sign-url` for each receipt after fetching an escrow.
- The server enforces access (buyer/seller/admin) and uses the service role client to sign URLs safely.

Behavior and fallbacks

- If signing fails for any receipt, the API will still return the receipt row with `signed_url: null` and the `file_path` column. The client can fall back to calling `/api/storage/sign-url` if needed.
- Signed URLs are intentionally short-lived. If you need longer durations, adjust the expiry parameter in `createSignedUrl` calls.

Performance considerations

- Generating multiple signed URLs per request results in extra storage API calls. For escrows with many receipts or under high load consider:
  - Returning only `file_path` and requesting signed URLs on demand from the client.
  - Caching signed URLs server-side for a short window.
  - Returning signed URLs only for recent/new receipts.

Next steps (optional)

- Normalize the `signed_url` field across all escrow APIs and update client UI to prefer it when present.
- Add an integration test that asserts `signed_url` exists for newly uploaded receipts.

