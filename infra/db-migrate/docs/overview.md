# db-migrate

Applies database migrations to stage and prod Supabase instances

Applies this repository's ordered database migrations per environment: plan on pull requests, apply on merge to `main`.

|              |                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------ |
| Type         | `db-migrate`                                                                               |
| Source       | `infra/db-migrate`                                                                         |
| Environments | `stage`: `plan`, `apply` on a push to `main` · `prod`: `plan`, `apply` on a push to `main` |

## Depends on

- **db** — The database migrations and their runner (built by the db-migrate component before it plans or applies)
- **supabase** — Provisions Supabase projects for stage and prod, points their Auth at the app, and wires the URL and keys into orun secrets
- **cloudflare-hyperdrive** — Provisions Cloudflare Hyperdrive resources for stage and prod Supabase Postgres databases

## Depended on by

- **web** — The CRM — Marmelab's Atomic CRM single-page app as the Static Assets of a Cloudflare Worker whose own routes are the ported Supabase edge functions, per environment
