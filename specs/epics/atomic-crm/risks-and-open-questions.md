# atomic-crm — risks and open questions

| # | Risk | Decision |
|---|---|---|
| AT-A | No Orun composition, and no resource of the Supabase Terraform provider, deploys a Supabase edge function | The six functions become the Worker's own routes. Proven before the port (the AT spike): the admin client, JWKS verification, Kysely over `pg` through Hyperdrive and the MCP server all run on workerd |
| AT-B | The functions' Postgres pool assumed a long-lived Deno process | `pg` through Hyperdrive, one client per request, closed after it |
| AT-C | `delete_note_attachments` is called by a `pg_net` webhook whose URL is derived from the Supabase project's own functions URL, which a Worker route does not have | An outbox: the trigger queues the paths, and the Worker's Cron Trigger drains the queue through the Storage API |
| AT-D | `pgjwt`, created by one migration and used by none, is not available on Supabase's Postgres 17 | Not created |
| AT-E | Supabase's OAuth 2.1 server (MCP sign-in) is not exposed by the Terraform provider | ACCEPTED: the MCP route is ported; enabling the OAuth server is an owner step in the README |
| AT-F | The service-role key must reach the Worker without reaching the browser | An Orun secret the Supabase root publishes, pushed to the Worker as a Worker secret by its deploy |
| AT-G | No live bootstrap has run from this repository | OPEN: the e2e applies the migrations to a Supabase-shaped Postgres and serves the Worker against stand-ins for Supabase's APIs; the applies, the Management API runs as `postgres` (storage policies, triggers on `auth.users`), `wrangler secret bulk` on a first deploy and the card's seventeen minutes are proven only by a live bootstrap |
