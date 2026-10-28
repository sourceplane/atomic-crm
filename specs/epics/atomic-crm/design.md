# atomic-crm — design

## What maps to what

| Upstream (Supabase-hosted) | Here (Cloudflare + Supabase) |
|---|---|
| The SPA built by Vite, served from any static host | The same Vite build as the Worker's Static Assets (`not_found_handling: single-page-application`) |
| Six Supabase edge functions (Deno): `users`, `update_password`, `merge_contacts`, `delete_note_attachments`, `postmark`, `mcp` | The Worker's own routes at `/functions/v1/<name>`: the same code on workerd, `Deno.env` read from the Worker's env, `jsr:`/`npm:` imports from npm |
| `supabase.functions.invoke(name)` → `<project>.supabase.co/functions/v1/<name>` | The same call; the Supabase client's `fetch` sends `/functions/v1/*` to the Worker's own origin |
| The edge functions' direct Postgres pool (`SUPABASE_DB_URL`) | `pg` through the Worker's Hyperdrive binding, one client per request |
| `delete_note_attachments` called by a `pg_net` webhook from a note trigger | The trigger queues the paths in a private outbox table; the Worker's Cron Trigger drains it through the Storage API — no `pg_net`, and no Worker URL the database has to know |
| `supabase db push` of the migrations | `packages/db`'s runner through Supabase's Management API, run by `infra/db-migrate` before the Worker deploys |
| A Supabase project created by hand | `infra/terraform/supabase` per environment, Auth pointed at the Worker, email confirmation off; `infra/terraform/cloudflare-hyperdrive` in front of its Postgres |
| The service-role key in the functions' environment | The Supabase root's `service_role_key`, an Orun secret pushed to the Worker as a Worker secret — never a var, never in the bundle |

## Out of scope

- Supabase's OAuth 2.1 server (what lets an MCP client sign in) is an Auth setting the Terraform provider does not expose; the MCP route is ported, and enabling the OAuth server is an owner step.
- Postmark's inbound email is optional: the route is ported and answers only once its webhook credentials are stored.
