# atomic-crm

Marmelab's [Atomic CRM](https://github.com/marmelab/atomic-crm) — contacts,
companies, a deals kanban, tasks, notes with attachments, an activity log,
CSV import, global search and an MCP endpoint for AI assistants, in a
React-Admin single-page app over Supabase — running on **one Cloudflare
Worker with Static Assets**: the app is its assets, and the six Supabase edge
functions upstream deploys to the Supabase project are the Worker's own
routes, at the same `/functions/v1/<name>` paths. **Supabase** stays what it
is upstream — Auth, the Data API, Storage and the Postgres the schema lives
in — with the Worker reaching that Postgres through **Cloudflare Hyperdrive**.
Terraform provisions the Supabase project and the Hyperdrive config per
environment and Orun's `db-migrate` applies the schema, on every merge to
`main`.

No other service is needed. The first person to sign up on a new deployment
becomes its administrator and invites the rest of the team; inbound email
(Postmark) is optional, and the CRM runs without it.

Atomic CRM is MIT-licensed by Marmelab ([LICENSE](LICENSE)); this product keeps
its app, its screens, its data model and its edge functions' code.

## Live deployment

<!-- 02-docs:begin -->
Not recorded yet. The bootstrap's last phase writes the live URLs, the
workspace, how the Worker is wired, whether inbound email is connected and
the secrets the product uses into
[ai/context/deployment.md](ai/context/deployment.md); how the product deploys
and how to operate it is in
[ai/context/operations.md](ai/context/operations.md).
<!-- 02-docs:end -->

## What is here

| Surface | Where |
|---|---|
| The app (React-Admin, upstream's `src/`) | `apps/web/src` |
| The edge functions, as the Worker's routes | `apps/web/worker/functions` (upstream's `supabase/functions`), routed by `apps/web/worker/index.ts` |
| The Worker's config | `apps/web/wrangler.template.jsonc` (rendered to `wrangler.jsonc`) |
| Upstream's FakeRest demo (no backend) | `apps/web/demo` |
| The schema | `packages/db/src/migrations` — upstream's `supabase/migrations`, its seed, the port's own |
| The Supabase project, per environment | `infra/terraform/supabase` |
| Hyperdrive, per environment | `infra/terraform/cloudflare-hyperdrive` |
| The migrations' deploy | `infra/db-migrate` |
| Tests | `tests/web` (upstream's app tests in Chromium, the edge functions', the Worker's), `tests/db` (every migration on a Supabase-shaped Postgres) |
| How it deploys and how to operate it | [`ai/context/operations.md`](ai/context/operations.md) |

## Getting started

```bash
pnpm install
pnpm --filter @app/web run wire:fixture   # re-render apps/web/wrangler.jsonc from its template (it is committed)
pnpm typecheck
pnpm lint
pnpm test        # installs Playwright's Chromium headless shell the first time
pnpm build       # vite build → apps/web/dist
```

The build needs no Supabase project: it inlines the URL and publishable key
of the project `apps/web/wrangler.jsonc` names (a placeholder until a deploy
renders the real one).

## Running it locally

**Without a backend.** Upstream's demo runs the whole app on an in-memory
FakeRest provider with generated data:

```bash
pnpm --filter @app/web dev:demo    # http://localhost:5174
```

**Against a local Supabase.** With the [Supabase CLI](https://supabase.com/docs/guides/local-development)
(Docker):

1. Start a local stack anywhere (`supabase init && supabase start`): its API
   is `http://127.0.0.1:54321` and its Postgres `127.0.0.1:54322`, which is
   what `apps/web/.env.development` and the Worker's local Hyperdrive
   connection already name. Put its publishable key in
   `apps/web/.env.local` as `VITE_SB_PUBLISHABLE_KEY` if it differs from
   the one in `.env.development`.
2. Apply the migrations once, in the manifest's order (CI applies the same
   files to the real projects):

   ```bash
   for f in $(grep -oE 'path: "[^"]+"' packages/db/src/manifest.ts | cut -d'"' -f2); do
     psql "postgres://postgres:postgres@127.0.0.1:54322/postgres" -f "packages/db/src/migrations/$f"
   done
   ```

3. Give the Worker its secrets: copy `apps/web/.dev.vars.example` to
   `apps/web/.dev.vars`, set `SUPABASE_SERVICE_ROLE_KEY` (from `supabase
   status`), and add `SUPABASE_URL=http://127.0.0.1:54321` and
   `SB_PUBLISHABLE_KEY=<the local key>` (they override the rendered vars).
4. Run the app and the Worker's routes side by side:

   ```bash
   pnpm --filter @app/web dev:worker   # the edge functions, http://127.0.0.1:8787
   pnpm --filter @app/web dev          # the app, http://localhost:5173 (proxies /functions)
   ```

   or the built app served by the Worker, as it deploys:
   `pnpm --filter @app/web preview` (http://127.0.0.1:8787).

**Against a deployed project.** Point `apps/web/.env.local`
(`VITE_SUPABASE_URL`, `VITE_SB_PUBLISHABLE_KEY`) and `.dev.vars` at your
stage project instead; the Worker's database is then that project's
Postgres, through `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`.

## How it deploys

Merges to `main` converge through [Orun](https://github.com/sourceplane/orun):
`.github/workflows/ci.yml` plans the changed components and runs each lane
against the workspace in `intent.yaml`. Per environment the order is
enforced —

```
supabase ──▶ cloudflare-hyperdrive ──▶ db-migrate ──▶ web
```

— because each reads what the one before it published: the project's
credentials, the Hyperdrive id over its database, the schema the app reads.
`stage` deploys first and `prod` once stage has converged on the same
commit; `dev` only verifies. Every deploy is smoke-tested over HTTP: the app
shell, `/api/health`, and a signed-out call to a function, which must be
refused.

The pipeline holds one credential, GitHub's own `GITHUB_TOKEN`. The
Cloudflare tokens and account id and the Supabase access token and org id
are brokered per run from the workspace's connections; the Supabase
project's credentials, its URL and publishable key, its service-role key and
the Hyperdrive id are published by the Terraform applies as Orun secrets. The
service-role key reaches the Worker as a Worker secret (`wrangler secret
bulk`, over stdin) — never a var, never the browser's bundle.

**Deploy by hand.** Orunbase's **Deploy** button on a component, or **Run
workflow** on the CI workflow in GitHub's Actions tab (on `main`), runs
`ci.yml` for the environment and components you pick, and each one deploys
exactly as a merge would. Leave the component blank to redeploy every
component in that environment with nothing changed — after storing a
secret, say.

## The first sign-in

A new deployment has no users, and the app opens on a sign-up form: the
first account becomes the CRM's **administrator** (upstream's
`handle_new_user` trigger). Sign-up signs straight in — each project is
created with email confirmation off, because a Supabase project without SMTP
of its own emails only its organization's members.

The administrator adds teammates from the user menu (**Users** → **New**), which sends each
an invitation through Supabase Auth. Until the project has
[its own SMTP server](https://supabase.com/docs/guides/auth/auth-smtp),
those emails reach only the Supabase organization's members; with SMTP set,
turn confirmation back on with `authEmailConfirmation: "true"` in
`infra/terraform/supabase/component.yaml`.

## Optional services

Each value is this repository's Orun secret, per deployed environment:

```bash
orun secrets set POSTMARK_WEBHOOK_USER --env prod     # prompts for the value
```

then redeploy `web` (**Deploy by hand**, above): a secret reaches the Worker
when it deploys.

| Service | Secrets | Without it |
|---|---|---|
| Postmark inbound email (notes from forwarded mail) | `POSTMARK_WEBHOOK_USER`, `POSTMARK_WEBHOOK_PASSWORD`, `POSTMARK_WEBHOOK_AUTHORIZED_IPS` (Postmark's webhook IPs); `VITE_INBOUND_EMAIL` (your Postmark inbound address, shown on the profile page). Point Postmark's inbound webhook at `https://<user>:<password>@atomic-crm-web-<env>.<subdomain>.workers.dev/functions/v1/postmark` | `/functions/v1/postmark` answers 503 and the profile page shows no inbound address |
| MCP clients (Claude, ChatGPT…) | none — enable Supabase Auth's **OAuth Server** in the project's dashboard (Authentication → OAuth Server) | the MCP endpoint (`/functions/v1/mcp`, shown on the profile page) refuses sign-in |

## How it maps to Supabase-hosted Atomic CRM

| Upstream | Here |
|---|---|
| The SPA on any static host (upstream: GitHub Pages) | The Worker's Static Assets, `atomic-crm-web-<env>` |
| Six edge functions deployed to the Supabase project (Deno) | The Worker's routes at the same paths: `Deno.env`/`Deno.serve` from a two-function shim, the `jsr:`/`npm:` imports as npm packages |
| `supabase.functions.invoke` → `<project>/functions/v1/<name>` | The same call; the Supabase client sends it to the page's own origin |
| The functions' Postgres pool (`SUPABASE_DB_URL`) | `pg` through the Worker's Hyperdrive binding, a client per request |
| The note-attachments webhook (`pg_net` → `delete_note_attachments`) | A queue (`private.note_attachment_cleanups`) the Worker's Cron Trigger drains every ten minutes |
| `npm run supabase:remote:init` (a project created by hand, `supabase db push --include-roles --include-seed`) | `infra/terraform/supabase` per environment, then `infra/db-migrate` applying upstream's migrations and seed |
| Supabase injects the service-role key into every function | The Supabase root's output, stored on the Worker as a Worker secret |
| The MCP URL `<project>/functions/v1/mcp` | `<the Worker>/functions/v1/mcp` |
| npm, Storybook, Husky | pnpm 10, Node 22; upstream's tests run as they do upstream (Vitest in Chromium, with the stories they render) |
| "Deploy" (fork, `make` targets, a Supabase project by hand) | Orun: Terraform per environment, the migrations and the Worker on every merge to `main` |

## Worker size

Workers Free deploys a Worker up to 3 MiB compressed. Measured with
`wrangler deploy --dry-run`: 561 KiB, every edge function included. The app's
assets (14 MiB with source maps) are not part of that limit.

## Custom domain

The Worker answers on workers.dev from its first deploy. To serve it on your
domain, attach the domain to the Worker in Cloudflare (Workers & Pages → the
Worker → Settings → Domains & Routes), then set `SITE_URL` under the
environment's `env:` in `intent.yaml` to that origin and merge: the next
`supabase` apply makes it Auth's Site URL and redirect origin. `BASE_DOMAIN`
beside it records the domain; the repository was born with the placeholder
`atomic-crm.example.com`.

## Telemetry

Like upstream, the app's production build reports the hostname it is served
from to Marmelab (`src/components/crm/root/CRM.tsx`), so Marmelab can count
Atomic CRM installs. Pass `disableTelemetry` to `<CRM>` in
`apps/web/src/App.tsx` to turn it off.

## CI

| Workflow | What it runs |
|---|---|
| `ci.yml` | the Orun pipeline, and the only workflow: `orun plan --changed`, then one job per lane. A pull request runs the verify lanes — the Worker built and dry-deployed for each environment, its tests and the migrations' tests, both Terraform roots checked and planned, the migrations planned and their checksums verified — with nothing applied or deployed; a merge applies, migrates and deploys stage → prod. A manual run (Orunbase's Deploy button, or Run workflow on `main`) deploys the environment and components it names as a merge would |
