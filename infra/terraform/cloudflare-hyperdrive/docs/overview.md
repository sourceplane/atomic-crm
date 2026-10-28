# cloudflare-hyperdrive

Provisions Cloudflare Hyperdrive resources for stage and prod Supabase Postgres databases

Terraform-managed infrastructure, planned and applied per environment by its CI lane.

|              |                                                                                                      |
| ------------ | ---------------------------------------------------------------------------------------------------- |
| Type         | `terraform`                                                                                          |
| Source       | `infra/terraform/cloudflare-hyperdrive`                                                              |
| Environments | `stage`: `plan-only`, `apply` on a push to `main` · `prod`: `plan-only`, `apply` on a push to `main` |

## Depends on

- **supabase** — Provisions Supabase projects for stage and prod, points their Auth at the app, and wires the URL and keys into orun secrets

## Depended on by

- **db-migrate** — Applies database migrations to stage and prod Supabase instances
- **web** — The CRM — Marmelab's Atomic CRM single-page app as the Static Assets of a Cloudflare Worker whose own routes are the ported Supabase edge functions, per environment
