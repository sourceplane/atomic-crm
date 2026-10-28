// The port's stand-in for the two Deno APIs the edge functions use, so their
// code reads as it does upstream (supabase/functions in marmelab/atomic-crm).
//
// - Deno.env.get(name): the Worker's own vars and secrets (wrangler.jsonc vars,
//   Worker secrets), read through `cloudflare:workers` so a module can read
//   them at load time as it did on Supabase's runtime. An empty value reads as
//   unset, as an unset Supabase secret does.
// - Deno.serve(handler): hands the handler back instead of starting a server;
//   each function exports it as `handler`, and worker/index.ts routes
//   /functions/v1/<name> to it — the path supabase.functions.invoke calls.
import { env } from "cloudflare:workers";

type Handler = (req: Request) => Response | Promise<Response>;

export const Deno = {
  env: {
    get(name: string): string | undefined {
      const value = (env as unknown as Record<string, unknown>)[name];
      return typeof value === "string" && value !== "" ? value : undefined;
    },
  },
  serve<H extends Handler>(handler: H): H {
    return handler;
  },
};

/**
 * The database the functions connect to: the Worker's Hyperdrive binding
 * (the Supabase project's Postgres, pooled at the edge), or SUPABASE_DB_URL
 * where there is no binding (tests). Upstream read SUPABASE_DB_URL, which
 * Supabase's runtime sets for every function.
 */
export function databaseUrl(): string {
  const hyperdrive = (env as unknown as { HYPERDRIVE?: { connectionString: string } })
    .HYPERDRIVE;
  const url = hyperdrive?.connectionString ?? Deno.env.get("SUPABASE_DB_URL");
  if (!url) throw new Error("No database: the Worker has no HYPERDRIVE binding");
  return url;
}
