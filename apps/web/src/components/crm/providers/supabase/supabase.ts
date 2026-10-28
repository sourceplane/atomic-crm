import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";

let supabaseClient: SupabaseClient | null = null;

const FUNCTIONS_PATH = "/functions/v1/";

/**
 * Port: upstream deploys its edge functions to the Supabase project, so
 * `supabase.functions.invoke(name)` calls <project>/functions/v1/<name>. Here
 * they are routes of the Worker that serves this page (worker/index.ts), so a
 * call to the project's functions URL goes to this origin instead — same
 * path, same headers (the user's access token and the publishable key).
 */
export const functionsFetch =
  (supabaseUrl: string, origin: string, fetchImpl: typeof fetch = fetch): typeof fetch =>
  (input, init) => {
    const base = supabaseUrl.replace(/\/+$/, "") + FUNCTIONS_PATH;
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (!url.startsWith(base)) return fetchImpl(input, init);
    const target = origin + FUNCTIONS_PATH + url.slice(base.length);
    return input instanceof Request
      ? fetchImpl(new Request(target, input), init)
      : fetchImpl(target, init);
  };

export const getSupabaseClient = () => {
  if (!supabaseClient) {
    supabaseClient = createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SB_PUBLISHABLE_KEY,
      {
        global: {
          fetch: functionsFetch(
            import.meta.env.VITE_SUPABASE_URL,
            window.location.origin,
          ),
        },
      },
    );
  }
  return supabaseClient;
};
