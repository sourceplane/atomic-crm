# web

The CRM — Marmelab's Atomic CRM single-page app as the Static Assets of a Cloudflare Worker whose own routes are the ported Supabase edge functions, per environment

A Cloudflare Worker with Static Assets (server rendering plus static files), deployed per environment by its CI lane.

|              |                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------ |
| Type         | `cloudflare-workers-assets-turbo`                                                                                  |
| Source       | `apps/web`                                                                                                         |
| Package      | `@app/web`                                                                                                         |
| Environments | `dev`: `verify` · `stage`: `verify`, `deploy` on a push to `main` · `prod`: `verify`, `deploy` on a push to `main` |

## Depends on

- **supabase** — Provisions Supabase projects for stage and prod, points their Auth at the app, and wires the URL and keys into orun secrets
- **cloudflare-hyperdrive** — Provisions Cloudflare Hyperdrive resources for stage and prod Supabase Postgres databases
- **db-migrate** — Applies database migrations to stage and prod Supabase instances

## Depended on by

- (none)
