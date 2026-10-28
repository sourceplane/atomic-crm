# db-tests

The migrations' tests — the manifest and its checksums, then every migration applied by db-migrate's runner to a Supabase-shaped Postgres in process (PGlite), twice, and what the app does through the Data API on it — run on every pull request

The test suite for **db**. It deploys nothing: its lane installs, builds and runs the tests.

|              |                      |
| ------------ | -------------------- |
| Type         | `turbo-package`      |
| Source       | `tests/db`           |
| Package      | `@app/db-tests`      |
| Environments | `dev`: `quick-check` |

## Depends on

- (none)

## Depended on by

- (none)
