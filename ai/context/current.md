# atomic-crm — where this repository stands

The entry page for anyone (or any agent) picking this repository up. It is
this repository's own state and does not ship to a product built from it;
the two pages that do are [operations.md](operations.md) and
[deployment.md](deployment.md).

## What it is

Marmelab's Atomic CRM — a React-Admin single-page CRM over Supabase — on one
Cloudflare Worker with Static Assets, its six Supabase edge functions the
Worker's own routes, its Supabase project (Auth, the Data API, Storage,
Postgres) and a Hyperdrive config over that Postgres from Terraform, and its
schema — upstream's migration history — applied by db-migrate. It is
packaged as an Orun baseline: `orun new --blueprint repo-blueprint.yaml`
builds a new CRM in its own repository and takes it to live on stage and
prod in one landing (`01-product`: the Supabase project, then Hyperdrive
over its database, then the migrations, then the Worker), then records what
went live (`02-docs`). Inbound email (Postmark) is the owner's to connect
afterwards; the CRM deploys, signs its first user up as the administrator and
serves without it.

## Release

| | |
|---|---|
| Latest tag | `baseline-v1` (AT4, [#5](https://github.com/sourceplane/atomic-crm/pull/5) — the baseline) |
| Proven live | No. Everything short of the platform is proven offline in Baseline CI: the e2e tier applies the migrations with the product's own runner to a Supabase-shaped Postgres, builds in orun's staged job tree, serves the Worker against it and drives the functions. No bootstrap from a tag has run against a workspace: neither Terraform root has been applied, db-migrate has not run against a real project, nothing has deployed, and the card's seventeen minutes is unmeasured (AT-G) |

## Where to read

| Question | Page |
|---|---|
| What shipped, and every departure from upstream | `specs/epics/atomic-crm/IMPLEMENTATION-STATUS.md` |
| Why it is built this way | [decisions.md](decisions.md), then `specs/epics/atomic-crm/design.md` |
| What could still go wrong | [open-risks.md](open-risks.md), then `specs/epics/atomic-crm/risks-and-open-questions.md` |
| How to instantiate it | `BOOTSTRAP.md`, `docs/phases/` |
| What each component is | `<component>/docs/` beside each `component.yaml` — `apps/web`, `packages/db`, `infra/db-migrate`, `infra/terraform/{supabase,cloudflare-hyperdrive}`, `tests/{web,db}` (generated; `python3 tooling/catalog/gen-component-docs.py`) |

## Next

1. Bootstrap one product from `baseline-v1` against a workspace with
   Cloudflare and Supabase connected, and record its timings (closes AT-G).
