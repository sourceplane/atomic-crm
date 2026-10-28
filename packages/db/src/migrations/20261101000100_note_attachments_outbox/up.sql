-- Port: upstream's cleanup_note_attachments() posts a note's old and new
-- record to the delete_note_attachments edge function through pg_net, at a URL
-- it derives from the Supabase project's own functions endpoint. Here that
-- function is a route of the CRM's Worker, which the database has no address
-- for, so the trigger queues the same payload instead, and the Worker's Cron
-- Trigger drains the queue (apps/web/worker/cleanup.ts): the same paths, from
-- the same function's logic, removed through the same Storage API, within a
-- few minutes. Upstream skips the call when the change did not come through
-- the Data API (no Authorization header to forward); a queue needs no header,
-- so every change is cleaned up.
CREATE SCHEMA IF NOT EXISTS private;

CREATE TABLE IF NOT EXISTS private.note_attachment_cleanups (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  payload jsonb NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only the Worker (the owner, through Hyperdrive) reads it.
REVOKE ALL ON private.note_attachment_cleanups FROM anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.cleanup_note_attachments() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
    BEGIN
      INSERT INTO private.note_attachment_cleanups (payload)
      VALUES (
        jsonb_build_object(
          'old_record', to_jsonb(OLD),
          'record', to_jsonb(NEW),
          'type', TG_OP
        )
      );

      IF TG_OP = 'DELETE' THEN
        RETURN OLD;
      END IF;

      RETURN NEW;
    END;
    $$;

-- Upstream's helper that found the edge function's URL has no caller left.
DROP FUNCTION IF EXISTS public.get_note_attachments_function_url();
