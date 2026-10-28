// The note-attachments clean-up upstream runs as a database webhook: its
// cleanup_note_attachments() trigger posted each changed or deleted note to
// the delete_note_attachments edge function through pg_net. The database has
// no address for this Worker, so the trigger queues the same payload in
// private.note_attachment_cleanups (packages/db, the outbox migration), and
// the Cron Trigger (wrangler.jsonc) drains it here — the paths chosen by
// upstream's own getPathsToDelete, removed through the same Storage API with
// the service-role key.
import pg from "pg";
import { supabaseAdmin } from "./functions/_shared/supabaseAdmin";
import { Deno, databaseUrl } from "./functions/_shared/deno";
import {
  ATTACHMENTS_BUCKET,
  getPathsToDelete,
  type WebhookPayload,
} from "./functions/delete_note_attachments/index";

/** A row is retried this many times, then left for a person to read. */
export const MAX_ATTEMPTS = 5;
/** Rows per run: a run holds their locks while it calls Storage. */
export const BATCH = 50;

export interface DrainResult {
  processed: number;
  removed: number;
  failed: number;
  skipped?: string;
}

type Row = { id: number | string; payload: WebhookPayload };

export async function drainNoteAttachmentCleanups(
  client: Pick<pg.Client, "query"> | null = null,
): Promise<DrainResult> {
  if (!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")) {
    return { processed: 0, removed: 0, failed: 0, skipped: "no SUPABASE_SERVICE_ROLE_KEY" };
  }
  const own = client ? null : new pg.Client({ connectionString: databaseUrl() });
  const db = client ?? own!;
  if (own) await own.connect();
  const result: DrainResult = { processed: 0, removed: 0, failed: 0 };
  try {
    await db.query("begin");
    const { rows } = await db.query<Row>(
      `select id, payload from private.note_attachment_cleanups
        where attempts < $1 order by id limit $2 for update skip locked`,
      [MAX_ATTEMPTS, BATCH],
    );
    for (const row of rows) {
      result.processed++;
      const paths = getPathsToDelete(row.payload);
      if (paths.length > 0) {
        const { error } = await supabaseAdmin.storage.from(ATTACHMENTS_BUCKET).remove(paths);
        if (error) {
          result.failed++;
          await db.query(
            `update private.note_attachment_cleanups
                set attempts = attempts + 1, last_error = $2 where id = $1`,
            [row.id, error.message ?? String(error)],
          );
          continue;
        }
        result.removed += paths.length;
      }
      await db.query("delete from private.note_attachment_cleanups where id = $1", [row.id]);
    }
    await db.query("commit");
    return result;
  } catch (e) {
    await db.query("rollback").catch(() => {});
    throw e;
  } finally {
    if (own) await own.end().catch(() => {});
  }
}
