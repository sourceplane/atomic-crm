# web — architecture

One Worker per environment, `atomic-crm-web-<env>`.

```
browser ──▶ Static Assets (dist/: the React-Admin SPA, hash-routed)
   │
   ├──▶ Supabase project: Auth, PostgREST (the data provider), Storage
   │
   └──▶ /functions/v1/<name> ──▶ this Worker (worker/index.ts)
                                   ├─ users, update_password, delete_note_attachments, postmark
                                   │    └─▶ Supabase admin API (service-role key, a Worker secret)
                                   └─ merge_contacts, mcp
                                        └─▶ Postgres through Hyperdrive (HYPERDRIVE binding)
```

- **The SPA** is upstream's (`src/`), built by Vite. A build inlines the
  project's URL and publishable key from the `vars` of the rendered
  `wrangler.jsonc` (`build-env.ts`), so the bundle and the Worker always
  name the same project.
- **The edge functions** are upstream's `supabase/functions`, in
  `worker/functions`, nearly verbatim: `Deno.env.get` and `Deno.serve` come
  from a two-function shim (`worker/functions/_shared/deno.ts`) and the
  `jsr:`/`npm:` imports are npm packages. The Supabase client's `fetch` sends
  `/functions/v1/*` to the page's own origin, so `supabase.functions.invoke`
  reaches them unchanged.
- **Postgres** is reached per request (Kysely over `pg` for
  `merge_contacts`, one client per query for the MCP server): a Worker may not
  reuse a socket another request opened, and Hyperdrive is the pool.
- `run_worker_first` sends only `/functions/*` and `/api/*` to the Worker;
  every other path is a file, or `index.html`.
