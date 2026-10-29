# atomic-crm — open risks

What is not yet proven or not yet decided. The full write-up of every risk,
including the accepted and resolved ones, is
`specs/epics/atomic-crm/risks-and-open-questions.md`; this page lists only
what is still live, so it should be short.

| ID | Risk | State | What closes it |
|---|---|---|---|
| AT-G | No bootstrap has been timed (the card's seventeen minutes is summed from estimates); neither Terraform root has been applied from this repository and db-migrate has not run against a real project — so upstream's history applying through the Management API as `postgres` (storage policies, triggers on `auth.users`), and `wrangler secret bulk` on a Worker's first deploy, are proven only on a Supabase-shaped Postgres and offline | OPEN | One bootstrap from a tag against a workspace with Cloudflare and Supabase connected |
| AT-E | Supabase Auth's OAuth Server (what an MCP client signs in through) is not exposed by the Terraform provider | ACCEPTED | An owner step (README, "Optional services") until the provider manages it |

Accepted, and worth knowing before you change them: AT-A (the functions are
Worker routes), AT-B (a Postgres client per request), AT-C (the attachments
outbox), AT-D (no `pgjwt`; `http` and `pg_net` only where installed), AT-F
(the service-role key as a Worker secret).
