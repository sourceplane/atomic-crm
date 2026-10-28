import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { manifest } from "@saas/db/manifest";
import { as, migrate, signUp, supabaseShaped, USERS } from "./harness";

// Every migration db-migrate applies, by its runner, on a Supabase-shaped
// Postgres (fixtures/supabase-shape.sql): the CRM's schema as upstream's
// `supabase db push` leaves it, then what the app does through the Data API.
describe("the CRM's schema on a Supabase-shaped Postgres", () => {
  let db: PGlite;
  beforeAll(async () => {
    db = await supabaseShaped();
    const first = await migrate(db);
    expect(first.failed).toBeNull();
    expect(first.applied).toEqual(manifest.migrations.map((m) => m.id));
  }, 120_000);

  it("applies nothing the second time", async () => {
    const again = await migrate(db);
    expect(again.applied).toEqual([]);
    expect(again.skipped).toEqual(manifest.migrations.map((m) => m.id));
  });

  it("creates the CRM's tables and views", async () => {
    const { rows } = await db.query<{ relname: string; relkind: string }>(`
      select c.relname, c.relkind from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind in ('r', 'v') order by c.relname`);
    const tables = rows.filter((r) => r.relkind === "r").map((r) => r.relname);
    const views = rows.filter((r) => r.relkind === "v").map((r) => r.relname);
    expect(tables).toEqual(expect.arrayContaining([
      "companies", "configuration", "contact_notes", "contacts", "deal_notes", "deals",
      "favicons_excluded_domains", "sales", "tags", "tasks",
    ]));
    expect(views).toEqual(expect.arrayContaining(["activity_log", "companies_summary", "contacts_summary", "init_state"]));
  });

  it("leaves no table in public without row-level security", async () => {
    const { rows } = await db.query<{ relname: string }>(`
      select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`);
    expect(rows).toEqual([]);
  });

  it("creates the public attachments bucket and its three policies", async () => {
    const bucket = await db.query("select id, public from storage.buckets");
    expect(bucket.rows).toEqual([{ id: "attachments", public: true }]);
    const policies = await db.query<{ cmd: string }>(
      "select cmd from pg_policies where schemaname = 'storage' and tablename = 'objects' order by cmd",
    );
    expect(policies.rows.map((p) => p.cmd)).toEqual(["DELETE", "INSERT", "SELECT"]);
  });

  it("seeds the mail domains whose favicon is never fetched", async () => {
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from favicons_excluded_domains where domain in ('gmail.com', 'yahoo.com', 'hotmail.com')",
    );
    expect(rows[0]!.n).toBe(3);
  });

  it("makes the first user to sign up an administrator, and the next not", async () => {
    expect((await db.query<{ is_initialized: number }>("select is_initialized::int from init_state")).rows[0]).toEqual({ is_initialized: 0 });
    await signUp(db, USERS.first);
    await signUp(db, USERS.second, "John", "Roe");
    const { rows } = await db.query("select email::text, first_name, last_name, administrator from sales order by id");
    expect(rows).toEqual([
      { email: "jane@example.com", first_name: "Jane", last_name: "Doe", administrator: true },
      { email: "john@example.com", first_name: "John", last_name: "Roe", administrator: false },
    ]);
    expect((await db.query<{ is_initialized: number }>("select is_initialized::int from init_state")).rows[0]).toEqual({ is_initialized: 1 });
  });

  it("lets a signed-in user work with contacts, and a signed-out caller see none", async () => {
    const id = await as(db, "authenticated", USERS.first.id, async (tx) => {
      const company = await tx.query<{ id: number }>("insert into companies (name, sales_id) values ('Acme', 1) returning id");
      const contact = await tx.query<{ id: number }>(
        `insert into contacts (first_name, last_name, company_id, sales_id, email_jsonb)
         values ('Ada', 'Lovelace', $1, 1, '[{"email": "Ada@Example.com", "type": "Work"}]') returning id`,
        [company.rows[0]!.id],
      );
      return contact.rows[0]!.id;
    });
    const seen = await as(db, "authenticated", USERS.second.id, (tx) =>
      tx.query<{ first_name: string; email: string }>("select first_name, email_jsonb->0->>'email' as email from contacts where id = $1", [id]),
    );
    // upstream lowercases every email on save
    expect(seen.rows).toEqual([{ first_name: "Ada", email: "ada@example.com" }]);
    const summary = await as(db, "authenticated", USERS.first.id, (tx) =>
      tx.query<{ company_name: string }>("select company_name from contacts_summary where id = $1", [id]),
    );
    expect(summary.rows).toEqual([{ company_name: "Acme" }]);
    const anon = await as(db, "anon", null, (tx) => tx.query("select id from contacts").then((r) => r.rows, () => "denied"));
    expect(anon === "denied" || (Array.isArray(anon) && anon.length === 0)).toBe(true);
  });

  it("keeps auth.users' emails from the Data API roles", async () => {
    for (const role of ["anon", "authenticated"] as const) {
      await expect(
        as(db, role, role === "anon" ? null : USERS.first.id, (tx) => tx.query("select * from get_user_id_by_email('jane@example.com')")),
      ).rejects.toThrow(/permission denied/);
    }
  });

  it("queues a note's removed attachments for the Worker to delete", async () => {
    const attachment = (p: string) => JSON.stringify({ src: `https://x.supabase.co/storage/v1/object/public/attachments/${p}`, path: p, title: p });
    const noteId = await as(db, "authenticated", USERS.first.id, async (tx) => {
      const contact = await tx.query<{ id: number }>("select id from contacts limit 1");
      const note = await tx.query<{ id: number }>(
        "insert into contact_notes (contact_id, text, sales_id, attachments) values ($1, 'hello', 1, array[$2::jsonb, $3::jsonb]) returning id",
        [contact.rows[0]!.id, attachment("a.png"), attachment("b.pdf")],
      );
      await tx.query("update contact_notes set attachments = array[$2::jsonb] where id = $1", [note.rows[0]!.id, attachment("b.pdf")]);
      await tx.query("delete from contact_notes where id = $1", [note.rows[0]!.id]);
      return note.rows[0]!.id;
    });
    const { rows } = await db.query<{ payload: { type: string; old_record: { id: number; attachments: { path: string }[] }; record: { attachments: { path: string }[] } | null } }>(
      "select payload from private.note_attachment_cleanups order by id",
    );
    expect(rows.map((r) => r.payload.type)).toEqual(["UPDATE", "DELETE"]);
    expect(rows[0]!.payload.old_record.attachments.map((a) => a.path)).toEqual(["a.png", "b.pdf"]);
    expect(rows[0]!.payload.record!.attachments.map((a) => a.path)).toEqual(["b.pdf"]);
    expect(rows[1]!.payload.old_record).toMatchObject({ id: noteId });
    expect(rows[1]!.payload.record).toBeNull();
  });

  it("keeps the cleanup queue from the Data API roles", async () => {
    await expect(
      as(db, "authenticated", USERS.first.id, (tx) => tx.query("select * from private.note_attachment_cleanups")),
    ).rejects.toThrow(/permission denied/);
  });
});
