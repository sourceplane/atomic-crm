# web-tests — architecture

Two Vitest projects, as upstream's `vitest.config.ts` has:

- **app** — upstream's tests of the React-Admin app and the Storybook stories
  they render, in `src/upstream`, mirroring `apps/web/src` (a test's
  relative import of app code is an `@/` import here). They run in a real
  browser: Playwright's Chromium headless shell, which `pnpm test` installs
  first, as upstream's CI does.
- **worker** — in Node: upstream's edge-function tests (`src/functions`)
  and the port's own (`src/worker`): the Worker's routes, the Supabase
  client's fetch that sends function calls to the Worker, the build's
  Supabase project, the committed wrangler render, the MCP server's
  Postgres. `cloudflare:workers` is stood in for by `src/stubs`.
