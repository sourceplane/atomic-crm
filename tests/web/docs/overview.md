# web-tests

The CRM's tests — upstream's component tests in a real browser, its edge-function tests, and the port's own (the Worker's routes, the functions' fetch, the build's project, the wrangler config) — run on every pull request

The test suite for **web**. It deploys nothing: its lane installs, builds and runs the tests.

|              |                      |
| ------------ | -------------------- |
| Type         | `turbo-package`      |
| Source       | `tests/web`          |
| Package      | `@app/web-tests`     |
| Environments | `dev`: `quick-check` |

## Depends on

- (none)

## Depended on by

- (none)
