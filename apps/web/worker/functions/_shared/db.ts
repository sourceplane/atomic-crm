import { databaseUrl } from "./deno";
import { CompiledQuery, Kysely, PostgresDialect, type Generated } from "kysely";
import pg from "pg";

export { CompiledQuery };

// Database schema types
export interface ContactsTable {
  id: Generated<number>;
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
  title: string | null;
  email_jsonb: any[] | null; // JSONB array
  phone_jsonb: any[] | null; // JSONB array
  background: string | null;
  avatar: any | null; // JSONB
  first_seen: Date | null;
  last_seen: Date | null;
  has_newsletter: boolean | null;
  status: string | null;
  tags: number[] | null;
  company_id: number | null;
  sales_id: number | null;
  linkedin_url: string | null;
}

interface TasksTable {
  id: Generated<number>;
  contact_id: number;
  type: string | null;
  text: string | null;
  due_date: Date;
  done_date: Date | null;
  sales_id: number | null;
}

interface ContactNotesTable {
  id: Generated<number>;
  contact_id: number;
  text: string | null;
  date: Date | null;
  sales_id: number | null;
  status: string | null;
  attachments: unknown[] | null; // JSONB array
}

interface DealsTable {
  id: Generated<number>;
  name: string;
  company_id: number | null;
  contact_ids: number[];
  categories: string[] | null;
  stage: string;
  description: string | null;
  amount: number | null;
  created_at: Date;
  updated_at: Date;
  archived_at: Date | null;
  expected_closing_date: Date | null;
  sales_id: number | null;
  index: number | null;
}

interface Database {
  contacts: ContactsTable;
  tasks: TasksTable;
  contact_notes: ContactNotesTable;
  deals: DealsTable;
}

// Port: upstream ran Kysely over a deno-postgres pool held for the life of
// the function. A Worker may not reuse a socket one request opened in
// another, so each request builds its own Kysely over `pg` through the
// Hyperdrive binding (Hyperdrive is the pool), and destroys it when done.
export function getDb(): Kysely<Database> {
  return new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new pg.Pool({ connectionString: databaseUrl(), max: 1 }),
    }),
  });
}
