import { Deno } from "../_shared/deno";
import { corsHeaders, OptionsMiddleware } from "../_shared/cors";
import { createErrorResponse } from "../_shared/utils";
import { supabaseAdmin } from "../_shared/supabaseAdmin";
import { AuthMiddleware, UserMiddleware } from "../_shared/authentication";

async function updatePassword(user: any) {
  const { data, error } = await supabaseAdmin.auth.resetPasswordForEmail(
    user.email,
  );

  if (!data || error) {
    return createErrorResponse(500, "Internal Server Error");
  }

  return new Response(
    JSON.stringify({
      data,
    }),
    {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    },
  );
}

export const handler = Deno.serve(async (req: Request) =>
  OptionsMiddleware(req, async (req) =>
    AuthMiddleware(req, async (req) =>
      UserMiddleware(req, async (req, user) => {
        if (req.method === "PATCH") {
          return updatePassword(user);
        }

        return createErrorResponse(405, "Method Not Allowed");
      }),
    ),
  ),
);
