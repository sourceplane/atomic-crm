import { beforeEach, describe, expect, it, vi } from "vitest";

// The Cron Trigger's drain of the note-attachments queue (worker/cleanup.ts):
// upstream's getPathsToDelete picks the paths, the Storage admin API removes
// them, and the row goes — or stays, counted, when Storage refuses.
const storage = vi.hoisted(() => ({ remove: vi.fn(), bucket: "" }));
vi.mock("@worker/functions/_shared/supabaseAdmin", () => ({
  supabaseAdmin: {
    storage: {
      from: (bucket: string) => {
        storage.bucket = bucket;
        return { remove: storage.remove };
      },
    },
  },
}));

import { BATCH, MAX_ATTEMPTS, drainNoteAttachmentCleanups } from "@worker/cleanup";

const att = (path: string) => ({ src: `https://x.supabase.co/storage/v1/object/public/attachments/${path}`, path });
function fakeClient(rows: { id: number; payload: unknown }[]) {
  const queries: { text: string; params?: unknown[] }[] = [];
  return {
    queries,
    async query(text: string, params?: unknown[]) {
      queries.push({ text: text.replace(/\s+/g, " ").trim(), params });
      return { rows: /^\s*select/i.test(text) ? rows : [] };
    },
  };
}

describe("draining the note-attachments queue", () => {
  beforeEach(() => storage.remove.mockReset());

  it("removes what a change or a deletion left behind, then the rows", async () => {
    storage.remove.mockResolvedValue({ data: [], error: null });
    const client = fakeClient([
      { id: 1, payload: { type: "UPDATE", old_record: { attachments: [att("a.png"), att("b.pdf")] }, record: { attachments: [att("b.pdf")] } } },
      { id: 2, payload: { type: "DELETE", old_record: { attachments: [att("c.txt")] }, record: null } },
      { id: 3, payload: { type: "UPDATE", old_record: { attachments: [att("d.png")] }, record: { attachments: [att("d.png")] } } },
    ]);
    const result = await drainNoteAttachmentCleanups(client as never);
    expect(result).toEqual({ processed: 3, removed: 2, failed: 0 });
    expect(storage.bucket).toBe("attachments");
    expect(storage.remove.mock.calls).toEqual([[["a.png"]], [["c.txt"]]]);
    const texts = client.queries.map((q) => q.text);
    expect(texts[0]).toBe("begin");
    expect(texts[1]).toMatch(/for update skip locked/);
    expect(client.queries[1]!.params).toEqual([MAX_ATTEMPTS, BATCH]);
    expect(client.queries.filter((q) => q.text.startsWith("delete")).map((q) => q.params)).toEqual([[1], [2], [3]]);
    expect(texts.at(-1)).toBe("commit");
  });

  it("keeps a row Storage refused, with the attempt and the error", async () => {
    storage.remove.mockResolvedValue({ data: null, error: { message: "Bucket not found" } });
    const client = fakeClient([{ id: 7, payload: { type: "DELETE", old_record: { attachments: [att("x.png")] }, record: null } }]);
    expect(await drainNoteAttachmentCleanups(client as never)).toEqual({ processed: 1, removed: 0, failed: 1 });
    const update = client.queries.find((q) => q.text.startsWith("update"));
    expect(update?.params).toEqual([7, "Bucket not found"]);
    expect(client.queries.some((q) => q.text.startsWith("delete"))).toBe(false);
  });

  it("rolls back when the database fails, and does nothing without the service-role key", async () => {
    const broken = {
      queries: [] as string[],
      async query(text: string) {
        this.queries.push(text.trim());
        if (/^select/i.test(text.trim())) throw new Error("connection lost");
        return { rows: [] };
      },
    };
    await expect(drainNoteAttachmentCleanups(broken as never)).rejects.toThrow("connection lost");
    expect(broken.queries.at(-1)).toBe("rollback");

    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    try {
      const client = fakeClient([]);
      expect(await drainNoteAttachmentCleanups(client as never)).toMatchObject({ processed: 0, skipped: expect.stringMatching(/SERVICE_ROLE/) });
      expect(client.queries).toEqual([]);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
