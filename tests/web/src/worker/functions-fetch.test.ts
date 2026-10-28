import { describe, expect, it, vi } from "vitest";
import { functionsFetch } from "@/components/crm/providers/supabase/supabase";

// supabase.functions.invoke calls <project>/functions/v1/<name>; the port
// sends those calls to the Worker that served the page, and nothing else.
const SUPABASE = "https://abcdefghijklmnopqrst.supabase.co";
const ORIGIN = "https://atomic-crm-web-stage.example.workers.dev";

describe("the Supabase client's fetch", () => {
  it("sends a function call to the page's own origin, same path and request", async () => {
    const seen = vi.fn(async () => new Response("ok"));
    const f = functionsFetch(SUPABASE, ORIGIN, seen as unknown as typeof fetch);
    const init = { method: "PATCH", headers: { authorization: "Bearer t", apikey: "k" } };
    await f(`${SUPABASE}/functions/v1/update_password`, init);
    expect(seen).toHaveBeenCalledWith(`${ORIGIN}/functions/v1/update_password`, init);
  });

  it("keeps a Request's method, headers and body", async () => {
    const seen = vi.fn(async (_input: RequestInfo | URL) => new Response("ok"));
    const f = functionsFetch(`${SUPABASE}/`, ORIGIN, seen as unknown as typeof fetch);
    await f(
      new Request(`${SUPABASE}/functions/v1/merge_contacts`, {
        method: "POST",
        headers: { authorization: "Bearer t" },
        body: JSON.stringify({ loserId: 1, winnerId: 2 }),
      }),
    );
    const sent = seen.mock.calls[0][0] as Request;
    expect(sent.url).toBe(`${ORIGIN}/functions/v1/merge_contacts`);
    expect(sent.method).toBe("POST");
    expect(sent.headers.get("authorization")).toBe("Bearer t");
    expect(await sent.json()).toEqual({ loserId: 1, winnerId: 2 });
  });

  it("leaves Auth, the Data API and Storage on the Supabase project", async () => {
    const seen = vi.fn(async () => new Response("ok"));
    const f = functionsFetch(SUPABASE, ORIGIN, seen as unknown as typeof fetch);
    for (const url of [
      `${SUPABASE}/auth/v1/token?grant_type=password`,
      `${SUPABASE}/rest/v1/contacts?select=*`,
      `${SUPABASE}/storage/v1/object/attachments/a.png`,
      new URL(`${SUPABASE}/rest/v1/sales`),
    ]) {
      await f(url);
      expect(seen).toHaveBeenLastCalledWith(url, undefined);
    }
  });
});
