// Port: the MCP function's `withPostgresClient()` (@supabase/server) keeps a
// pg pool for the life of the isolate. On a Worker a socket opened in one
// request cannot serve the next — the second request's query never returns —
// so this is the same middleware with a client per query instead, through
// the Hyperdrive binding (which is the pool). Same contract as upstream's:
// each query runs in its own transaction as the caller's role, with the
// caller's JWT claims set, so row-level security applies exactly as it does
// through PostgREST.
import { defineMiddleware } from "@supabase/middleware";
import pg from "pg";
import { databaseUrl } from "./deno";

export interface PostgresApi {
  query<T = Record<string, unknown>>(
    strings: TemplateStringsArray,
    ...values: unknown[]
  ): Promise<T[]>;
  queryRaw<T = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<T[]>;
}

const ROLES = new Set(["authenticated", "anon"]);

export function compileTemplate(strings: TemplateStringsArray, values: unknown[]) {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) text += `$${i + 1}${strings[i + 1]}`;
  return { text, values };
}

export function roleFor(claims: Record<string, unknown> | undefined): string | null {
  const role = claims?.role;
  if (role == null) return "anon";
  return typeof role === "string" && ROLES.has(role) ? role : null;
}

export const withRequestPostgres = defineMiddleware({
  key: "postgres",
  run: () => async (_req: Request, ctx: { jwtClaims?: Record<string, unknown> }) => {
    const role = roleFor(ctx.jwtClaims);
    if (!role) {
      return Response.json({ message: "Unsupported role" }, { status: 403 });
    }
    const claims = JSON.stringify(ctx.jwtClaims ?? {});
    const api: PostgresApi = {
      query(strings, ...values) {
        const { text, values: params } = compileTemplate(strings, values);
        return api.queryRaw(text, params);
      },
      async queryRaw(text, params) {
        const client = new pg.Client({ connectionString: databaseUrl() });
        await client.connect();
        try {
          await client.query("begin");
          await client.query("select set_config('request.jwt.claims', $1, true)", [claims]);
          await client.query(`set local role ${role}`);
          const res = await client.query(text, params as unknown[] | undefined);
          await client.query("commit");
          return res.rows;
        } catch (e) {
          await client.query("rollback").catch(() => {});
          throw e;
        } finally {
          await client.end().catch(() => {});
        }
      },
    };
    return { postgres: api };
  },
});
