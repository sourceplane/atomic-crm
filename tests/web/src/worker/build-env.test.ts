import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { supabaseBuildEnv } from "@app/build-env";

// A production build inlines the project the Worker is rendered for: the
// `vars` of apps/web/wrangler.jsonc (vite.config.ts).
const committed = path.resolve(__dirname, "../../../../apps/web/wrangler.jsonc");

describe("the build's Supabase project", () => {
  it("comes from the rendered wrangler config", () => {
    expect(supabaseBuildEnv({}, committed)).toEqual({
      VITE_SUPABASE_URL: "https://stage-project-ref.supabase.co",
      VITE_SB_PUBLISHABLE_KEY: "sb_publishable_fixture_stage",
    });
  });

  it("lets a value already in the environment win, as upstream's .env does", () => {
    expect(
      supabaseBuildEnv({ VITE_SUPABASE_URL: "http://127.0.0.1:54321" }, committed).VITE_SUPABASE_URL,
    ).toBe("http://127.0.0.1:54321");
  });

  it("reads a config with comments and trailing commas, and none at all", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "build-env-"));
    try {
      const file = path.join(dir, "wrangler.jsonc");
      writeFileSync(file, '{\n  // c\n  "vars": { "SUPABASE_URL": "https://x.supabase.co", /* k */ "SB_PUBLISHABLE_KEY": "k", },\n}\n');
      expect(supabaseBuildEnv({}, file)).toEqual({
        VITE_SUPABASE_URL: "https://x.supabase.co",
        VITE_SB_PUBLISHABLE_KEY: "k",
      });
      expect(supabaseBuildEnv({}, path.join(dir, "missing.jsonc"))).toEqual({});
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
