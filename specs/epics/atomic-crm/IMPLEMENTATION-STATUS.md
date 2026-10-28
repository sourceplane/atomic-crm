# atomic-crm — implementation status

| Milestone | State | Landed |
|---|---|---|
| AT0 — the spec | done | AT-1 (#1) |
| AT1 — the CRM on Workers | done | AT-2 (#2) |
| AT2 — the data plane | in review | AT-3 |
| AT3 — ready to instantiate | — | |
| AT4 — a baseline | — | |

## AT1 as built

- `apps/web` is upstream's `src/`, `public/`, `index.html` and `demo/` at
  marmelab/atomic-crm `9eb8349`, built by Vite into the Static Assets of one
  Worker (`worker/index.ts`), 561 KiB compressed with every function bundled.
- The six edge functions are `worker/functions`, routed at
  `/functions/v1/<name>`; `wrangler dev` serves the SPA (deep links included),
  answers CORS preflight, refuses a signed-out caller with 401, resets a
  password through the admin client, answers inbound email 503 unconfigured,
  and serves the MCP server's OAuth challenge, metadata and tool calls against
  Postgres through the Hyperdrive binding, request after request.
- `tests/web`: upstream's 33 test files (433 tests and upstream's one skip) in
  Chromium, its 5 edge-function test files, and the port's own (routes,
  the functions' fetch, the build's project, the wrangler render, the MCP
  server's Postgres) — `pnpm typecheck`, `pnpm lint`, `pnpm test` and
  `pnpm build` green.

## AT2 as built

- `infra/terraform/supabase` (supabase-starter's root): one project per
  environment, Auth's Site URL and redirect allow-list the Worker, sign-up
  without email confirmation; publishes the database credentials,
  `WIRING_SUPABASE` (URL and publishable key) and `SUPABASE_SERVICE_ROLE_KEY`.
- `infra/terraform/cloudflare-hyperdrive`: a Hyperdrive config in front of
  each project's Postgres, caching off; publishes `WIRING_CLOUDFLARE_HYPERDRIVE`.
- `packages/db` (`@saas/db`): the control migration, upstream's 30
  `supabase/migrations` in their order, its seed, and the port's outbox — 33
  checksummed migrations, applied through the Management API by
  `infra/db-migrate` before the Worker deploys. Upstream's declarative
  `supabase/schemas` were compared with its migration history on a
  Supabase-shaped Postgres 16 first: the same schema except one column's
  position and a grant the declarative files still give (`get_user_id_by_email`
  to `anon` and `authenticated`, which the history revokes), so the history —
  what `supabase db push` applies — is what ships.
- `tests/db`: every migration by db-migrate's runner on a Supabase-shaped
  PGlite, twice (the second applies nothing), then sign-up (the first user is
  the administrator), contacts through the Data API's roles, the attachments
  bucket and its policies, the seed, and the attachments outbox. The same
  migrations apply as Supabase's non-superuser `postgres` on a real Postgres 16.
- `apps/web` deploys after `supabase`, `cloudflare-hyperdrive` and
  `db-migrate` (enforced on a push to `main`), renders its config from their
  wiring documents, stores the service-role key as a Worker secret, and drains
  the attachments outbox on a Cron Trigger every ten minutes.

## Departures from the upstream template

| Where | Upstream | Here | Why |
|---|---|---|---|
| Edge functions | Deployed to the Supabase project (Deno) | The Worker's routes, same paths, same code | No Orun path deploys a Supabase edge function (the AT spike) |
| `Deno.env` / `Deno.serve` | Deno's runtime | `worker/functions/_shared/deno.ts`: the Worker's env through `cloudflare:workers`; the handler exported for the router | The only two Deno APIs the functions use |
| `jsr:` / `npm:` / `esm.sh` / `deno.land` imports | URL and registry specifiers | npm packages, at the versions upstream names | workerd bundles npm packages |
| `_shared/db.ts` | Kysely over a deno-postgres pool held by the function | Kysely over `pg`, built per request through Hyperdrive | A Worker may not reuse a socket another request opened |
| MCP `withPostgresClient()` | `@supabase/server`'s pooled middleware | `_shared/requestPostgres.ts`: same API, same role and claims, a client per query | Same reason: the pooled client hangs on the second request |
| MCP resource / issuer | Derived from Supabase's runtime | This route's origin, the Worker's `SUPABASE_URL` | Not on Supabase's runtime |
| `postmark` | Throws at load when unconfigured; trusts `x-forwarded-for` | Answers 503 until configured; checks `cf-connecting-ip` | One route's missing config must not take the Worker down; Cloudflare sets the caller's address there |
| Type-only fixes in `merge_contacts`, `users`, `postmark`, `_shared/db.ts` | Never type-checked | Casts and non-null assertions, no runtime change | The Worker is type-checked |
| `supabase.functions.invoke` | `<project>/functions/v1/<name>` | The same path on the page's origin (`functionsFetch`) | The functions are the Worker's |
| MCP URL on the profile page | `<project>/functions/v1/mcp` | `<origin>/functions/v1/mcp` | Same |
| Build env | `VITE_*` from `.env` / the shell | Also from the rendered `wrangler.jsonc` vars (`build-env.ts`) | The bundle and the Worker name the same project |
| `vite.config.ts` | `rollup-plugin-visualizer`, `preserveSymlinks: true` | Neither; the PWA's navigate fallback skips `/functions/` and `/api/` | Opens a browser in CI; breaks resolution under pnpm; the Worker's routes are not the app shell |
| Dependencies | npm, `package-lock.json` | pnpm, every direct dependency pinned to the version upstream's lockfile resolves; `@supabase/supabase-js`, `cropperjs`, `date-fns`, `react-router-dom` declared (transitive upstream) | Upstream's tests pass against its lockfile, and pnpm resolves only declared packages |
| Tests | Colocated, Storybook stories as fixtures | `tests/web/src/upstream`, mirroring `src/`, with the 14 stories they render; Storybook itself is not carried | The repository's tests live in `tests/<app>` |
| Folder `src/components/atomic-crm` | — | `src/components/crm` | A product's rename rewrites the repository's slug everywhere |
| Migrations | `supabase db push` of `supabase/migrations` (+ `--include-seed`) | The same files, in order, through `@saas/db`'s runner (Management API), then the seed as a migration | Orun's db-migrate composition |
| `pgjwt` | Created in `20260128165057_sso_handling`, never used | Not created | Not shipped on Supabase's Postgres 17 |
| `http`, `pg_net` | Created unconditionally | Created where installed (every Supabase project); skipped elsewhere | The tests' Postgres has neither |
| Note-attachments clean-up | Trigger → `pg_net` → `delete_note_attachments` (only for Data API changes) | Trigger → `private.note_attachment_cleanups` → the Worker's Cron Trigger → Storage (every change) | The database has no address for the Worker's route |
| Service-role key | Supabase injects it into every edge function | The Supabase root's output, an Orun secret, stored as a Worker secret by the deploy | The functions are the Worker's |
| Hyperdrive caching | — (direct pool) | Off | A CRM's reads must see the write before them |
