# web — architecture

Built by the turbo pipeline from `apps/web` and deployed with wrangler.

|                     |                                    |
| ------------------- | ---------------------------------- |
| Worker config       | `apps/web/wrangler.template.jsonc` |
| Entry               | `worker/index.ts`                  |
| Compatibility date  | `2026-10-01`                       |
| Compatibility flags | `nodejs_compat`                    |

## Bindings

| Binding      | Kind                         | Source                                       |
| ------------ | ---------------------------- | -------------------------------------------- |
| `HYPERDRIVE` | Hyperdrive (pooled Postgres) | `hyperdrive_id` from `cloudflare-hyperdrive` |
| `ASSETS`     | Static assets                | `dist`                                       |

Identifiers marked _from_ a component are filled in at deploy time from
that component's published outputs for the environment being deployed.

## Scheduled triggers

- `*/10 * * * *`

## Variables

`SB_PUBLISHABLE_KEY`, `SUPABASE_URL`.

## Wiring

Resolved at deploy time from secrets the infrastructure lanes publish (names only):

- `WIRING_CLOUDFLARE_HYPERDRIVE_PROD`
- `WIRING_CLOUDFLARE_HYPERDRIVE_STAGE`
- `WIRING_SUPABASE_PROD`
- `WIRING_SUPABASE_STAGE`

## Secrets resolved by the lane (names only)

- `SUPABASE_SERVICE_ROLE_KEY_PROD`
- `SUPABASE_SERVICE_ROLE_KEY_STAGE`
- `POSTMARK_WEBHOOK_AUTHORIZED_IPS` (optional)
- `POSTMARK_WEBHOOK_PASSWORD` (optional)
- `POSTMARK_WEBHOOK_USER` (optional)
- `VITE_INBOUND_EMAIL` (optional)
