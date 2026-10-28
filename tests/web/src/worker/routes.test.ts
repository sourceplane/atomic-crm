import { describe, expect, it, vi } from "vitest";
import worker, { functionFor, functions, health, type Env } from "@worker/index";

// The Worker in front of the app: upstream's six edge functions at their
// /functions/v1/<name> paths, the health check, and the app's assets for
// everything else (worker/index.ts).
const assets = { fetch: vi.fn(async () => new Response("<div id=\"root\"></div>")) };
const env = {
  ASSETS: assets,
  SUPABASE_URL: "http://127.0.0.1:54321",
  SB_PUBLISHABLE_KEY: "sb_publishable_test",
} as unknown as Env;
const call = (path: string, init?: RequestInit) =>
  worker.fetch(new Request(`https://crm.example.com${path}`, init), env);

describe("the Worker's routes", () => {
  it("routes each upstream function by the path supabase.functions.invoke calls", () => {
    expect(Object.keys(functions).sort()).toEqual([
      "delete_note_attachments",
      "mcp",
      "merge_contacts",
      "postmark",
      "update_password",
      "users",
    ]);
    for (const name of Object.keys(functions)) {
      expect(functionFor(`/functions/v1/${name}`)).toBe(functions[name]);
    }
    // the MCP server's own sub-paths (its OAuth resource metadata)
    expect(functionFor("/functions/v1/mcp/oauth-protected-resource")).toBe(functions.mcp);
  });

  it("names no function for anything else", () => {
    for (const path of ["/functions/v1/nope", "/functions/v1/__proto__", "/functions/v1/toString", "/functions/v2/users", "/users"]) {
      expect(functionFor(path)).toBeUndefined();
    }
  });

  it("answers an unknown function 404 without falling through to the app", async () => {
    const res = await call("/functions/v1/nope", { method: "POST" });
    expect(res.status).toBe(404);
    expect(assets.fetch).not.toHaveBeenCalled();
  });

  it("answers CORS preflight as upstream's OptionsMiddleware does", async () => {
    const res = await call("/functions/v1/users", { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("refuses a signed-out caller before doing anything", async () => {
    for (const [path, method] of [
      ["/functions/v1/update_password", "PATCH"],
      ["/functions/v1/users", "POST"],
      ["/functions/v1/merge_contacts", "POST"],
      ["/functions/v1/delete_note_attachments", "POST"],
    ]) {
      const res = await call(path, { method });
      expect(res.status, path).toBe(401);
    }
  });

  it("answers inbound email 503 until Postmark is configured", async () => {
    const res = await call("/functions/v1/postmark", { method: "POST", body: "{}" });
    expect(res.status).toBe(503);
    expect(await res.text()).toMatch(/POSTMARK_WEBHOOK_USER/);
  });

  it("reports how it is wired at /api/health", async () => {
    const res = await call("/api/health");
    expect(await res.json()).toEqual({ ok: true, supabase: true, database: false, admin: false });
    expect(health({ ...env, HYPERDRIVE: { connectionString: "postgres://x" }, SUPABASE_SERVICE_ROLE_KEY: "k" })).toEqual({
      ok: true,
      supabase: true,
      database: true,
      admin: true,
    });
  });

  it("drains the note-attachments queue on its schedule, given a database", async () => {
    const waited: Promise<unknown>[] = [];
    await worker.scheduled({}, env, { waitUntil: (p) => waited.push(p) });
    expect(waited).toEqual([]);
  });

  it("serves everything else from the app's assets", async () => {
    const res = await call("/");
    expect(await res.text()).toContain('<div id="root">');
    expect(assets.fetch).toHaveBeenCalledOnce();
  });
});
