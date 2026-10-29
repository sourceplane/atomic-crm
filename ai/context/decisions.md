# atomic-crm — decisions

The choices that shape this repository, one line each, with where the full
reasoning lives. Superseded decisions stay listed, marked, so the history
reads in order.

| # | Decision | Why | Source |
|---|---|---|---|
| 1 | The six Supabase edge functions are the Worker's own routes, at the paths `supabase.functions.invoke` calls | No Orun composition, and no resource of the Supabase Terraform provider, deploys an edge function; the spike proved every function's dependencies on workerd first | risk AT-A, design.md |
| 2 | Upstream's function code nearly verbatim: `Deno.env`/`Deno.serve` from a two-function shim, `jsr:`/`npm:` imports as npm packages, type-only fixes where `tsc` refuses | An upstream sync stays a diff of upstream's own files | IMPLEMENTATION-STATUS (AT1) |
| 3 | A Postgres client per request (Kysely in `merge_contacts`, a client per query for the MCP server), never a module-level pool | A Worker cannot reuse a socket another request opened — the pooled MCP middleware hangs on the second request; Hyperdrive is the pool | risk AT-B |
| 4 | The Supabase client's `fetch` sends `/functions/v1/*` to the page's origin | The app's calls stay `supabase.functions.invoke`, unchanged | design.md |
| 5 | The build inlines the project's URL and key from the rendered `wrangler.jsonc` | The bundle and the Worker name the same project, from one place | IMPLEMENTATION-STATUS (AT1) |
| 6 | Every direct dependency pinned to the version upstream's lockfile resolves | Upstream's tests fail on newer patch versions and pass on its lockfile | IMPLEMENTATION-STATUS (AT1) |
| 7 | Upstream's migration history ships, not its declarative schema | The two differ by a grant the history revokes (`get_user_id_by_email`); the history is what `supabase db push` deploys | IMPLEMENTATION-STATUS (AT2) |
| 8 | The note-attachments webhook becomes an outbox the Worker's Cron Trigger drains | The database has no address for the Worker's route | risk AT-C |
| 9 | The service-role key is a Supabase-root output, resolved fail-closed by the deploy and stored as a Worker secret | The admin functions need it; it must never reach a var or the bundle | risk AT-F |
| 10 | Infra before app on main: supabase → cloudflare-hyperdrive → db-migrate → web, enforced; advisory on a pull request | Each component reads what the one before it published; a migration is the one step a re-run cannot take back, so it runs last before the Worker | design.md |
| 11 | Hyperdrive caching off | A CRM's reads must see the write before them | IMPLEMENTATION-STATUS (AT2) |
| 12 | The rebrand renames the display name "Atomic CRM" and the slug, and never Marmelab's repository, site, telemetry endpoint or release history | Those name where the code came from; renaming them would point a product at pages that do not exist | `tooling/rebrand/rebrand.mjs` |
| 13 | The saas-starter v8 shape on orun v2.88.0: one landing, the record, `ci.yml` alone in a product, the brokered keys in one reconcile per provider, generated component docs, no await of what the convergence already resolves | The same chain as saas-starter's (Supabase, Hyperdrive, db-migrate, one Worker) | `repo-blueprint.yaml`, `testing/phases.test.sh` |
