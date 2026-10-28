import { readFileSync } from "node:fs";
import * as path from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { unaccent } from "@electric-sql/pglite/contrib/unaccent";
import type { MigrationEntry } from "@saas/db";
import { manifest } from "@saas/db/manifest";
import { runMigrations, type AppliedMigration, type MigrationAdapter } from "@saas/db/runner";

// A Supabase-shaped Postgres in process (PGlite: Postgres compiled to WASM,
// with the contrib extensions upstream's schema creates), the migrations
// applied by the same runner db-migrate runs.
export const migrationsDir = path.resolve(__dirname, "../../../packages/db/src/migrations");
const shape = readFileSync(path.join(__dirname, "fixtures/supabase-shape.sql"), "utf8");

export async function supabaseShaped(): Promise<PGlite> {
  const db = new PGlite({ extensions: { citext, pgcrypto, unaccent } });
  await db.exec(shape);
  return db;
}

/** The runner's adapter over PGlite (the Management API's, in process). */
export class PGliteAdapter implements MigrationAdapter {
  constructor(private readonly db: PGlite) {}
  async connect() {}
  async disconnect() {}
  async acquireAdvisoryLock() {
    return true;
  }
  async releaseAdvisoryLock() {}
  async getAppliedMigrations(): Promise<AppliedMigration[]> {
    try {
      const { rows } = await this.db.query<AppliedMigration>(
        "select id, context, checksum, applied_at::text as applied_at from _migrations.applied order by id",
      );
      return rows;
    } catch (e) {
      if (String(e).includes("does not exist")) return [];
      throw e;
    }
  }
  async beginTransaction() {
    await this.db.exec("begin");
  }
  async commitTransaction() {
    await this.db.exec("commit");
  }
  async rollbackTransaction() {
    await this.db.exec("rollback");
  }
  async executeSql(sql: string) {
    await this.db.exec(sql);
  }
  async recordMigration(entry: MigrationEntry) {
    await this.db.query(
      "insert into _migrations.applied (id, context, checksum) values ($1, $2, $3) on conflict (id) do nothing",
      [entry.id, entry.context, entry.checksum],
    );
  }
}

export function migrate(db: PGlite) {
  return runMigrations(manifest, { mode: "apply", migrationsDir, adapter: new PGliteAdapter(db) });
}

export const USERS = {
  first: { id: "11111111-1111-4111-8111-111111111111", email: "jane@example.com" },
  second: { id: "22222222-2222-4222-8222-222222222222", email: "john@example.com" },
};

/** Sign a user up as Supabase Auth does: a row in auth.users. */
export async function signUp(db: PGlite, user: { id: string; email: string }, first = "Jane", last = "Doe") {
  await db.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)", [
    user.id,
    user.email,
    JSON.stringify({ first_name: first, last_name: last }),
  ]);
}

/**
 * Run `fn` as PostgREST runs a request: in a transaction, as the request's
 * role, with its JWT claims set.
 */
export function as<T>(
  db: PGlite,
  role: "anon" | "authenticated",
  sub: string | null,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    const claims = sub ? { sub, role } : { role };
    await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    await tx.exec(`set local role ${role}`);
    return fn(tx);
  });
}
