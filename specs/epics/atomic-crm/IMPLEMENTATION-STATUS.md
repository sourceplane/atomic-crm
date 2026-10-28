# atomic-crm — implementation status

| Milestone | State | Landed |
|---|---|---|
| AT0 — the spec | done | AT-1 (#1) |
| AT1 — the CRM on Workers | in review | AT-2 |
| AT2 — the data plane | — | |
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
