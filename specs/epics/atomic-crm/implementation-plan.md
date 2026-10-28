# atomic-crm — implementation plan

| Milestone | Task | Lands | Done when |
|---|---|---|---|
| AT0 — the spec | AT-1 | intent.yaml (placeholder workspace), ci.yml (turso-starter's, byte for byte, with the manual-deploy contract), the root workspace, the shared tooling, the spec index, this doc set, the task contracts | merged on `main` |
| AT1 — the CRM on Workers | AT-2 | `apps/web` (the SPA, the Worker, the function routes), `wrangler.template.jsonc` + fixture + committed render, `component.yaml`; `tests/web` | it type-checks, lints, tests and builds; the dry run fits Workers Free; `wrangler dev` serves the SPA and the routes |
| AT2 — the data plane | AT-3 | `infra/terraform/{supabase,cloudflare-hyperdrive}`, `packages/db` (migrations, the Management-API runner), `infra/db-migrate`, `tests/db`, the Worker's dependsOn and wiring | `terraform validate` passes for both roots; the migrations apply to a Supabase-shaped Postgres twice, the second applying nothing |
| AT3 — ready to instantiate | AT-4 | README (run, test, preview, deploy, the mapping table), as-built status | a reader can take it from clone to a deploy |
| AT4 — a baseline | AT-5 | blueprint.yaml, repo-blueprint.yaml, `.baseline/`, `tooling/{rebrand,bootstrap,catalog}`, `hooks/`, `docs/phases/`, `ai/context/`, `testing/`, baseline.yml, tag.yml | Baseline CI green: every contract test, the docs check, the leak gate, the placement tier and the e2e |
