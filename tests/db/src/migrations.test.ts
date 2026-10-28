import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { manifest } from "@saas/db/manifest";
import { buildPlan, runMigrations } from "@saas/db/runner";
import { migrationsDir } from "./harness";

describe("the migration manifest (packages/db)", () => {
  it("starts with the control migration and names every file with its checksum", () => {
    expect(manifest.migrations[0]?.id).toBe("000_control_baseline");
    for (const entry of manifest.migrations) {
      const file = readFileSync(path.join(migrationsDir, entry.path));
      expect(createHash("sha256").update(file).digest("hex"), entry.id).toBe(entry.checksum);
    }
  });

  it("lists every migration directory, once, in timestamp order after the control migration", () => {
    const dirs = readdirSync(migrationsDir).sort();
    expect(manifest.migrations.map((m) => path.dirname(m.path)).sort()).toEqual(dirs);
    const ids = manifest.migrations.slice(1).map((m) => m.id);
    expect(ids).toEqual([...ids].sort());
    expect(new Set(manifest.migrations.map((m) => m.id)).size).toBe(manifest.migrations.length);
  });

  it("carries upstream's history, then its seed, then the port's own", () => {
    const ids = manifest.migrations.map((m) => m.id);
    expect(ids[1]).toBe("20240730075029_init_db");
    expect(ids.indexOf("20261026120000_deal_categories")).toBe(ids.length - 3);
    expect(ids.slice(-2)).toEqual(["20261101000000_seed", "20261101000100_note_attachments_outbox"]);
  });

  it("marks every edit to an upstream migration in the file", () => {
    const edited = ["20260127140209_imports", "20260128165057_sso_handling", "20260304104600_note_attachments_trigger", "20260309112831_fix_security_warnings"];
    for (const entry of manifest.migrations) {
      const sql = readFileSync(path.join(migrationsDir, entry.path), "utf8");
      if (edited.includes(entry.id)) expect(sql, entry.id).toMatch(/^-- Port: /m);
      expect(sql, entry.id).not.toMatch(/create extension[^;]*pgjwt/i);
    }
    expect(existsSync(path.join(migrationsDir, "000_control/up.sql"))).toBe(true);
  });

  it("plans every migration as pending offline", async () => {
    const result = await runMigrations(manifest, { mode: "plan", migrationsDir, adapter: null });
    expect(result.failed).toBeNull();
    expect(result.applied).toEqual(manifest.migrations.map((m) => m.id));
  });

  it("skips what the database already recorded", () => {
    const applied = new Map([[manifest.migrations[0]!.id, manifest.migrations[0]!.checksum]]);
    const plan = buildPlan(manifest, applied, migrationsDir);
    expect(plan.alreadyApplied).toEqual([manifest.migrations[0]!.id]);
    expect(plan.pending.map((m) => m.id)).toEqual(manifest.migrations.slice(1).map((m) => m.id));
    expect(plan.checksumMismatches).toEqual([]);
  });
});
