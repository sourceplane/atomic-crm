# atomic-crm — operating contract (for humans and agents)

This is the standing guide to how this product is deployed and operated.
Instance facts (live URLs, workspace, how the Worker is wired, whether
inbound email is connected, the secrets it uses) live in
[deployment.md](deployment.md), rendered from probed reality by the
bootstrap's `02-docs` phase; this file is the contract that stays true
between deployments. It is written to give an agent with repository read
access enough context to reason about and operate the product without any
other source.

## What this system is

Marmelab's Atomic CRM — contacts, companies, deals, tasks, notes with
attachments, an activity log, CSV import, global search and an MCP endpoint
— as a React-Admin single-page app on one Cloudflare Worker, over a Supabase
project (Auth, the Data API, Storage, Postgres), expressed as an Orun
component-native desired-state repo. Seven components:

- **`infra/terraform/supabase`** (`supabase`) — one Supabase project per
  environment, its Auth's Site URL and redirect origin the Worker, sign-up
  without email confirmation. Its apply publishes `SUPABASE_PROJECT_REF`,
  `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_URL`, `WIRING_SUPABASE` (the
  project's URL and publishable key) and `SUPABASE_SERVICE_ROLE_KEY` onto the
  environment's secret rung.
- **`infra/terraform/cloudflare-hyperdrive`** (`cloudflare-hyperdrive`) — one
  Hyperdrive config per environment over that database, caching off. Its
  apply publishes `WIRING_CLOUDFLARE_HYPERDRIVE` (the config's id and name).
- **`infra/db-migrate`** (`db-migrate`) — applies `packages/db`'s migrations
  to the environment's database through Supabase's Management API. Each
  migration is recorded with its checksum in `_migrations.applied`; only the
  missing ones apply.
- **`packages/db`** (`db`) — the migrations (upstream Atomic CRM's history,
  its seed, then this product's own) and their runner.
- **`apps/web`** (`web`) — the CRM: the app, built by Vite, as the Worker's
  Static Assets, and the Worker's own routes — the six edge functions at
  `/functions/v1/<name>` (`worker/functions`), `/api/health`, and a Cron
  Trigger that drains the note-attachments queue (`worker/cleanup.ts`). The
  browser talks to Supabase directly with the publishable key; the functions
  reach Postgres through the `HYPERDRIVE` binding (a client per request) and
  Supabase's admin API with the service-role key.
- **`tests/web`**, **`tests/db`** — vitest suites (the app's in Chromium),
  verified on the `dev` rung.

Environments: **`stage`** and **`prod`** are deployed; **`dev` is
verify-only by design** — lanes build and test, nothing deploys.

## Identity and tenancy

Every remote operation runs against ONE Orun workspace, declared in
`intent.yaml` under `execution.state.workspace` — committed, enforced, and
what CI uses. Do not remove it; headless credentials depend on it. If it
reads `ws_SET_ME`, the bootstrap had no workspace to write: set the real one
before anything else.

## How deployment works

1. Merge (or push) to `main`.
2. CI (`.github/workflows/ci.yml`) runs `orun plan --changed` — only
   components whose files changed are planned — then runs each planned lane
   with `orun run --remote-state`, authenticated by GitHub OIDC (the
   exchange resolves this repository's linked workspace server-side).
3. Per environment, in this order — each edge `mode: enforced` on a push to
   main, advisory on a pull request (which deploys nothing):
   **`supabase` → `cloudflare-hyperdrive` → `db-migrate` → `web`.** A job
   resolves its secrets when it starts, so each one reads what the apply
   before it published. The Worker's deploy re-renders
   `apps/web/wrangler.jsonc` from `WIRING_SUPABASE` and
   `WIRING_CLOUDFLARE_HYPERDRIVE`, builds the app (which inlines the
   project's URL and publishable key from that render), stores the
   service-role key as a Worker secret, deploys `atomic-crm-web-<env>`, and
   smoke-tests it: the app shell, `/api/health`, and a signed-out call to a
   function, which must answer 401.
4. `prod` deploys after `stage` has converged on the same commit
   (`environments.prod.promotion` in intent.yaml).
5. **The convergence run is the deployment.** A green run means every
   planned lane applied. Failed lanes are retried with
   `gh run rerun --failed`, which resumes the same execution.

Caveats that matter:

- A push that touches no component files plans zero lanes — that run is
  green and deployed nothing. Never treat "latest run green" as "product
  converged"; probe the URLs instead.
- `apps/web/wrangler.jsonc` is committed as the render of
  `wrangler.template.jsonc` from `wiring.fixture.json` (placeholder
  project and Hyperdrive values): edit the template and run
  `pnpm --filter @app/web run wire:fixture`. The deploy lanes render the
  real one in their own job tree; never commit a real id or key.
- The data is protected by row-level security, as upstream designs it:
  every table in `public` has it, with policies for the `authenticated`
  role; the anon key alone reads nothing but the sign-up state. The
  service-role key bypasses it — it lives only on the Worker, as a Worker
  secret, for the admin functions (inviting a user, resetting a password,
  deleting attachments, inbound email).
- A migration is immutable once applied: its checksum is in
  `packages/db/src/manifest.ts` and in the database's ledger. Change the
  schema with a NEW migration in `packages/db/src/migrations` (give a new
  table row-level security and the policies it needs); `pnpm test` applies
  every migration to a Supabase-shaped Postgres.
- Deleting a note, or removing an attachment from one, queues the files in
  `private.note_attachment_cleanups`; the Worker's Cron Trigger removes them
  from Storage within ten minutes. A row Storage refused keeps its
  `attempts` and `last_error`, and is retried up to five times.

## Secrets model

- **Brokered provider secrets**, minted per run from the workspace's
  connections — no long-lived values at rest, nothing to rotate by hand:
  `CLOUDFLARE_API_TOKEN` (Workers deploy and Worker secrets),
  `CLOUDFLARE_HYPERDRIVE_TOKEN` (Hyperdrive — the deploy token deliberately
  cannot touch it), `CLOUDFLARE_ACCOUNT_ID`, `SUPABASE_ACCESS_TOKEN` (project
  create and migrations) and `SUPABASE_ORG_ID`.
- **Published by the applies** onto the stage and prod rungs:
  `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_DB_URL`,
  `WIRING_SUPABASE`, `SUPABASE_SERVICE_ROLE_KEY`,
  `WIRING_CLOUDFLARE_HYPERDRIVE`. The service-role key reaches the Worker as
  a Worker secret at each deploy (`wrangler secret bulk`, over stdin).
- **Optional, the owner's to add** per environment, because no platform
  brokers Postmark: `POSTMARK_WEBHOOK_USER`, `POSTMARK_WEBHOOK_PASSWORD`,
  `POSTMARK_WEBHOOK_AUTHORIZED_IPS` and `VITE_INBOUND_EMAIL` (README,
  "Optional services"). Until they exist `/functions/v1/postmark` answers
  503 and nothing else changes.
- Inspect by NAME only: `orun secrets list --org <ws> --project` and
  `--env stage|prod`. No tooling in this repository prints a secret value,
  and no document in `ai/context/` may contain one.

## The first sign-in, and the team

A new environment has no users; the app opens on a sign-up form, and the
first account becomes the administrator (`handle_new_user`). The
administrator invites the rest from the user menu (**Users** → **New**),
through Supabase Auth's invitations — which reach only the Supabase
organization's members until the project has its own SMTP server. With
SMTP set, turn email confirmation on (`authEmailConfirmation: "true"` in
`infra/terraform/supabase/component.yaml`) and merge.

## Verifying the system

```bash
# the CRM and how it is wired on each environment (also recorded, probed, in deployment.md)
curl -s -o /dev/null -w '%{http_code}\n' https://atomic-crm-web-stage.your-workers-subdomain.workers.dev/
curl -s https://atomic-crm-web-prod.your-workers-subdomain.workers.dev/api/health   # {"ok":true,"supabase":true,"database":true,"admin":true}

# workspace readiness (integrations + repository link)
orun integrations list --org <ws> --json && orun cloud check --org <ws>
```

## Common operations

| task | how |
|---|---|
| deploy a change | merge to `main`; watch the run; failed lanes → `gh run rerun --failed` |
| deploy by hand | Orunbase's Deploy button, or `gh workflow run ci.yml --ref main -f environment=<env> [-f component=<a,b>]` — the named components (blank: every one) run in that environment as a merge runs them; started off `main` it is refused |
| change the schema | a new `packages/db/src/migrations/<timestamp>_<name>/up.sql` and its manifest entry (`pnpm --filter @saas/db run manifest:fix` for its checksum), merge — db-migrate applies it before the Worker deploys |
| redeploy without a change | edit the last line of the component's `component.yaml` (`# orun: redeploy <reason> <stamp>`) and merge — it is a deploy trigger, nothing reads it |
| connect inbound email | store the four Postmark secrets (README, "Optional services"), then deploy `web` by hand |
| connect an MCP client | enable the project's OAuth Server (Supabase dashboard → Authentication → OAuth Server); the endpoint is `/functions/v1/mcp`, shown on each user's profile page |
| serve a custom domain | attach it to the Worker in Cloudflare (README, "Custom domain"), set `SITE_URL` under the environment's `env:` in `intent.yaml` (Supabase Auth's Site URL and redirect origin follow at the next apply), and replace the placeholder `atomic-crm.example.com` in `BASE_DOMAIN` |
| turn off upstream's telemetry | pass `disableTelemetry` to `<CRM>` in `apps/web/src/App.tsx` |
| headless credentials | `ORUN_TOKEN` (workspace-scoped) + `GITHUB_TOKEN` |

The deployment record is the bootstrap's `02-docs` phase. Re-running it (the
Orun console's Retry on that phase, or `orun new … --phase 02-docs`)
re-probes the URLs and re-renders [deployment.md](deployment.md); it is
idempotent.

## Evolution

Structural changes (a second Worker, a queue, another data store) follow the
same contract that deployed the product: add a component under `apps/`,
`infra/` or `packages/` with a `component.yaml` — declaring `dependsOn` on
any infrastructure whose published secrets it reads, enforced on main — land
it as a pull request, and the convergence run applies it.
