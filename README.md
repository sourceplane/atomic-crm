# atomic-crm

Marmelab's [Atomic CRM](https://github.com/marmelab/atomic-crm) — contacts,
companies, a deals kanban, tasks, notes with attachments, an activity log,
CSV import, global search and an MCP endpoint for AI assistants, in a
React-Admin single-page app over Supabase — running on **one Cloudflare
Worker with Static Assets**, whose own routes are the six Supabase edge
functions upstream deploys to the Supabase project, with **Supabase** (Auth,
the Data API, Storage, Postgres) provisioned per environment by Terraform
through [Orun](https://github.com/sourceplane/orun), the Worker reaching its
Postgres through **Cloudflare Hyperdrive**, and the schema — upstream's own
migration history — applied by Orun's `db-migrate`; packaged as an **Orun
baseline**: one command takes a new CRM from nothing to live on stage and
prod, in its own repository, under its own name, in ONE landing.

The template's code is the code. What the port changes is what the Workers
runtime and a fresh, unattended deployment force: the edge functions run on
the Worker through a two-function Deno shim, opening a Postgres client per
request through Hyperdrive; the Supabase client sends function calls to the
Worker; the note-attachments webhook upstream fires through `pg_net` becomes
a queue the Worker's Cron Trigger drains; and each project is created with
its Auth pointed at the Worker, so the first account to sign up becomes the
CRM's administrator with no SMTP server. What the baseline adds is
everything needed to make a copy of it somebody else's — built the way
[cirrus-baseline](https://github.com/sourceplane/cirrus-baseline) builds a
product, in one landing. See [`specs/epics/atomic-crm`](specs/epics/atomic-crm/README.md)
for the design, the milestones and the as-built status, including every
departure.

## Instantiating a product

```bash
git clone --depth 1 --branch <baseline-tag> https://github.com/sourceplane/atomic-crm
cd atomic-crm
orun new --blueprint repo-blueprint.yaml --out ~/products/acme-crm --run-hooks --resume \
  --set reponame=acme-crm --set productname="Acme CRM" \
  --set githuborg=acme-inc --set subdomain=<workers-dev-subdomain>
```

Or, once the platform's registry lists it, from the Orun console (Baselines →
`atomic-crm` → Build). Two phases: **`01-product`** creates the repository,
mints the five brokered credentials (Cloudflare and Supabase) and lands the
whole product as one pull request, whose convergence on `main` provisions and
deploys it per environment in a fixed order —

```
supabase ──▶ cloudflare-hyperdrive ──▶ db-migrate ──▶ web
```

— each edge `mode: enforced` on a push to main and advisory on a pull
request; then **`02-docs`** records the live deployment from probed facts.
**[BOOTSTRAP.md](BOOTSTRAP.md)** is the operator guide;
[docs/phases/](docs/phases/README.md) has a page per phase.

The new repository receives the **product only** — the CRM, the Terraform
roots, the migrations, the tests, its CI, its tooling, a README of its own
and its operating contract — renamed throughout to the product's name,
repository, Worker, Supabase projects and Hyperdrive configs. None of this
repository's machinery ships. **Inbound email is the owner's to connect
afterwards** (the product's README, "Optional services"): no platform
brokers Postmark, so the card asks for no Postmark key.

| What makes it a baseline | Where |
|---|---|
| The console card (inputs, secrets, programme) | `blueprint.yaml` |
| The build document (modules, phases, hooks) | `repo-blueprint.yaml` |
| This tree's identity, the product's README and the bootstrap's task contracts | `.baseline/` |
| The rename engine (the display name "Atomic CRM", the slug, the Worker, the secret refs — never Marmelab's own links) | `tooling/rebrand/rebrand.mjs` |
| The bootstrap's helpers (deferrals, redeploy marker, work-tree strip) | `tooling/bootstrap/` |
| The component docs generator | `tooling/catalog/gen-component-docs.py` |
| The deployment-record renderer | `hooks/render-deployment-docs.sh` |
| The product's context pack | `ai/context/` |
| The baseline's tests: contract, leak, offline bootstrap and plans, end to end | `testing/`, `.github/workflows/baseline.yml` |
| Cutting a `baseline-vN` tag | `.github/workflows/tag.yml` |

## What is here (the product)

| Surface | Where |
|---|---|
| The app (React-Admin, upstream's `src/`) | `apps/web/src` |
| The edge functions, as the Worker's routes | `apps/web/worker/functions`, routed by `apps/web/worker/index.ts` |
| The attachments queue's drain (Cron Trigger) | `apps/web/worker/cleanup.ts` |
| The Worker's config | `apps/web/wrangler.template.jsonc` (rendered to `wrangler.jsonc`) |
| Upstream's FakeRest demo | `apps/web/demo` |
| The schema | `packages/db/src/migrations` — upstream's history, its seed, the port's outbox |
| The Supabase project, Hyperdrive | `infra/terraform/supabase`, `infra/terraform/cloudflare-hyperdrive` |
| The migrations' deploy | `infra/db-migrate` |
| Tests | `tests/web`, `tests/db` |

The product's own README (`.baseline/product/README.md`) covers running it
locally, the first sign-in, the optional services, the mapping from
Supabase-hosted Atomic CRM, the Worker's size and a custom domain.

## Getting started

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test        # installs Playwright's Chromium headless shell the first time
pnpm build
pnpm --filter @app/web dev:demo   # upstream's demo, no backend: http://localhost:5174
```

## How it is tested

| Tier | What | Where |
|---|---|---|
| contract | the card against the build, the phases, coverage, the rename engine, the bootstrap's helpers, the wiring path; the component docs | `testing/{manifest,phases,coverage,rebrand,retouch,bootstrap-defer,wire}.test.sh`, `gen-component-docs.py --check` |
| blueprint | the build read by the pinned orun, the leak gate, the offline bootstrap and the product's own plans | `testing/leak.test.sh`, `testing/placement.test.sh` |
| end to end | the bootstrapped product installed from its lockfile, typechecked, linted and tested; its migrations applied by db-migrate's runner to a Supabase-shaped Postgres; the Worker built, dry-deployed and served against it — the app, the health check, the functions refusing a signed-out caller, signing a user up and reading as them, the attachments queue drained | `testing/e2e.test.sh` |

## CI

| Workflow | What it runs | Ships to a product |
|---|---|---|
| `ci.yml` | the Orun pipeline, and the only workflow a product carries: `orun plan --changed`, then one job per lane. A pull request runs the verify lanes (the Worker built and dry-deployed per environment, both Terraform roots checked and planned, the migrations planned), except the bootstrap's own landings (`orun/BASE-*`), where `plan` alone runs and nothing waits for it — the landing was checked in the build box; a merge applies, migrates and deploys stage → prod. It plans nothing while `intent.yaml` names the placeholder workspace `ws_CHANGE_ME`, as this repository does. A manual run (Orunbase's Deploy button, or Run workflow on `main`) plans the environment and components it names under the push-to-main trigger, so they deploy as a merge deploys them | yes |
| `baseline.yml` | the baseline's own tiers (above) | no |
| `tag.yml` | cuts a `baseline-vN` tag (manual) | no |
