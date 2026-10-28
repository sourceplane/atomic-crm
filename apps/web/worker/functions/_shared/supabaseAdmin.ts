import { Deno } from "./deno";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

export const supabaseAdmin: SupabaseClient = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  // TODO - When Supabase finally provides the project's secret key to the functions, we'll need to use it here instead of the service role key.
  // See https://supabase.com/docs/guides/functions/auth#get-api-details
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
