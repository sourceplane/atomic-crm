# Epics

Orun-style work programs. Each epic is a folder carrying `epic.yaml` (the
declaration the platform reads: slug, key prefix, milestones with exit
criteria and task keys) beside its doc set. The pull request that adds the
folder is the adoption; the merge creates the epic in the workspace.

| Epic | Cluster | Status | What it is |
|------|---------|--------|------------|
| [`atomic-crm/`](./atomic-crm/) | **AT** | In progress | Marmelab's Atomic CRM — a React-Admin single-page CRM over Supabase — on one Cloudflare Worker with Static Assets, its six Supabase edge functions ported to the Worker's own routes, Supabase Auth, Postgres (through Hyperdrive) and Storage provisioned by Terraform, the schema applied by db-migrate; then an Orun baseline that instantiates it in one landing |

As-built ≠ intent: what shipped lives in each epic's `IMPLEMENTATION-STATUS.md`.
