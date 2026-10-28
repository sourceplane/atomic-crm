import { describe, expect, it } from "vitest";
import { compileTemplate, roleFor } from "@worker/functions/_shared/requestPostgres";

// The MCP server's per-request Postgres (the port of @supabase/server's
// withPostgresClient): the same query API and the same role rule.
describe("the MCP server's Postgres", () => {
  it("compiles a tagged query to numbered parameters, never inlining a value", () => {
    const id = "1; drop table tasks";
    const strings = Object.assign(["UPDATE tasks SET done_date = NOW() WHERE id = ", " AND x = ", ""], {
      raw: [],
    }) as unknown as TemplateStringsArray;
    expect(compileTemplate(strings, [id, 2])).toEqual({
      text: "UPDATE tasks SET done_date = NOW() WHERE id = $1 AND x = $2",
      values: [id, 2],
    });
  });

  it("runs as the caller's role, anon without one, and refuses any other", () => {
    expect(roleFor({ role: "authenticated" })).toBe("authenticated");
    expect(roleFor({})).toBe("anon");
    expect(roleFor(undefined)).toBe("anon");
    expect(roleFor({ role: "service_role" })).toBeNull();
    expect(roleFor({ role: "postgres" })).toBeNull();
  });
});
