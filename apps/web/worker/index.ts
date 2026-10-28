// The CRM's Worker. Its Static Assets are the single-page app Vite builds
// (dist/), served without running this code; what does run here is what
// wrangler.jsonc's `run_worker_first` sends: the six Supabase edge functions
// upstream deploys to the Supabase project, as this Worker's own routes at the
// same /functions/v1/<name> paths (supabase.functions.invoke is pointed at
// this origin, src/components/crm/providers/supabase/supabase.ts), and the
// health check the deploy smoke-tests.
import { handler as deleteNoteAttachments } from "./functions/delete_note_attachments/index";
import { handler as mcp } from "./functions/mcp/index";
import { handler as mergeContacts } from "./functions/merge_contacts/index";
import { handler as postmark } from "./functions/postmark/index";
import { handler as updatePassword } from "./functions/update_password/index";
import { handler as users } from "./functions/users/index";

type Handler = (req: Request) => Response | Promise<Response>;

export interface Env {
  ASSETS: { fetch(req: Request): Promise<Response> };
  HYPERDRIVE?: { connectionString: string };
  SUPABASE_URL?: string;
  SB_PUBLISHABLE_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
}

export const functions: Record<string, Handler> = {
  delete_note_attachments: deleteNoteAttachments,
  mcp,
  merge_contacts: mergeContacts,
  postmark,
  update_password: updatePassword,
  users,
};

const FUNCTION_PATH = /^\/functions\/v1\/([a-z_]+)(?:\/.*)?$/;

/** The function a path names, or undefined. */
export function functionFor(pathname: string): Handler | undefined {
  const name = FUNCTION_PATH.exec(pathname)?.[1];
  return name && Object.hasOwn(functions, name) ? functions[name] : undefined;
}

/** What the deploy's smoke test reads: the Worker answers, and is wired. */
export function health(env: Env) {
  return {
    ok: true,
    supabase: Boolean(env.SUPABASE_URL && env.SB_PUBLISHABLE_KEY),
    database: Boolean(env.HYPERDRIVE),
    admin: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
  };
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(req.url);
    const fn = functionFor(pathname);
    if (fn) return fn(req);
    if (pathname.startsWith("/functions/")) {
      return Response.json({ status: 404, message: "No such function" }, { status: 404 });
    }
    if (pathname === "/api/health") return Response.json(health(env));
    return env.ASSETS.fetch(req);
  },
};
