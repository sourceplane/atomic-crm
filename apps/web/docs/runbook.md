# web — runbook

| Symptom | Check | Fix |
|---|---|---|
| The deploy's smoke test fails on `/` | `curl -s https://<worker>/ \| grep 'id="root"'` | the build did not produce `dist/`: read the lane's `build-app` step |
| `/api/health` says `"supabase": false` | the rendered `wrangler.jsonc` `vars` | the Supabase root has not applied for this environment, or its `WIRING_SUPABASE` secret is missing: re-run the `supabase` lane |
| `/api/health` says `"admin": false`; inviting a user or resetting a password fails | `wrangler secret list --name atomic-crm-web-<env>` | the deploy found no `SUPABASE_SERVICE_ROLE_KEY`: re-run the `supabase` lane, then this one |
| `/api/health` says `"database": false`; merging contacts fails | the `hyperdrive` block of the rendered config | re-run `cloudflare-hyperdrive`, then this lane |
| Sign-in works but every list is empty | the browser console: PostgREST 401/42501 | the schema is not applied: re-run `db-migrate` |
| `/functions/v1/postmark` answers 503 | — | inbound email is optional: store `POSTMARK_WEBHOOK_USER`, `POSTMARK_WEBHOOK_PASSWORD` and `POSTMARK_WEBHOOK_AUTHORIZED_IPS` as Orun secrets and redeploy |

Local: `pnpm --filter @app/web preview` builds the app and serves it with the
Worker under `wrangler dev` on :8787 (secrets from `.dev.vars`, see
`.dev.vars.example`); `pnpm --filter @app/web dev:demo` runs upstream's
FakeRest demo with no Supabase at all.
