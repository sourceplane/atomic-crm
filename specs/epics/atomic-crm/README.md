# Epic: atomic-crm (AT)

**Atomic CRM is Marmelab's open-source CRM: contacts, companies, a deals kanban, tasks and notes in a React-Admin single-page app whose data, sign-in and files are a Supabase project, with six Supabase edge functions (Deno) for what the browser cannot do itself. On Cloudflare the app is one Worker with Static Assets: the SPA is its assets, and the edge functions are the Worker's own routes at the same `/functions/v1/<name>` paths — Orun has no way to deploy a Supabase edge function, and a Worker route needs nothing it does not already have. Supabase stays Supabase: Auth, PostgREST, Storage and the Postgres the schema lives in, provisioned by Terraform, the schema applied by db-migrate.**

The port keeps the app, its screens and its data model. It adds the Worker, the functions' port, the Terraform roots, the migrations and the deploy contract.

## Status

| Field | Value |
|-------|-------|
| Status | In progress |
| Cluster | **AT** (AT0–AT4) |
| Owner(s) | `apps/web` (the SPA and the Worker) · `tests/web` · `infra/terraform/{supabase,cloudflare-hyperdrive}` · `packages/db` + `infra/db-migrate` · `tests/db` |
| Builds on | `supabase-starter` (the Supabase root with Auth pointed at the Worker), `saas-starter` (the Hyperdrive root, db-migrate through the Management API), `cron-starter` (a Cron Trigger on the app's Worker) |
| Upstream | [marmelab/atomic-crm](https://github.com/marmelab/atomic-crm) (MIT) |
| Changes | The Workers build, the edge functions as Worker routes, the note-attachments clean-up as an outbox the Worker's Cron Trigger drains, the Terraform roots, the migrations, the deploy contract |
| Gate | AT1 is the first user-visible rung. AT2 applies only with a linked workspace; verified by `terraform validate` and a real Postgres in the e2e |

## Read order

1. `design.md` — what maps to what, the Worker, the data flow, what is out of scope
2. `implementation-plan.md` — the milestones and what "done" means for each
3. `risks-and-open-questions.md` — what could go wrong and what was decided
4. `IMPLEMENTATION-STATUS.md` — what actually shipped (kept distinct from intent)

## Milestones at a glance

| Milestone | What it lands | Done when |
|---|---|---|
| AT0 — the spec | intent, CI, tooling, the spec index, this doc set and the task contracts | merged on `main` |
| AT1 — the CRM on Workers | `apps/web` (the SPA, the Worker and its function routes), the rendered wrangler config, `tests/web` | the Worker builds, serves the SPA and answers every function route under `wrangler dev` |
| AT2 — Supabase from Terraform, the schema through db-migrate | `infra/terraform/{supabase,cloudflare-hyperdrive}`, `packages/db`, `infra/db-migrate`, `tests/db` | the roots validate; the migrations apply to a Supabase-shaped Postgres twice, the second applying nothing |
| AT3 — ready to instantiate | README, as-built status | a reader can run, test, preview and deploy it |
| AT4 — a baseline | card, build document (one landing), rename, bootstrap tooling, tests | a new CRM goes from nothing to live; Baseline CI green |
