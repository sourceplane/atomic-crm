# web-tests — runbook

| Symptom | Fix |
|---|---|
| `app` fails with "Executable doesn't exist" | `pnpm exec playwright install chromium-headless-shell` (the `test` script does this) |
| the wrangler-config test fails | `pnpm --filter @app/web run wire:fixture`, and commit `apps/web/wrangler.jsonc` |
| a function test fails after an upstream sync | compare the function with upstream's `supabase/functions/<name>`: the port changes only the imports, the env shim and the handler export |
