-- ============================================================
-- Talkr - Migration 003: Enable Supabase Realtime
-- Run this in: Supabase Dashboard > SQL Editor
--
-- PURPOSE: Enables postgres_changes subscriptions so the chat
-- UI receives live inserts/updates without polling.
--
-- If you ran 001_initial_schema.sql already, the last two ALTER
-- PUBLICATION lines were already executed. This migration is safe
-- to re-run; the DO $$ blocks check for existence before acting.
-- ============================================================


-- ============================================================
-- STEP 1: Enable Realtime on the tables
-- ============================================================
-- Adds both tables to the built-in supabase_realtime publication.
-- The chat page subscribes to:
--   • project_v2_messages  → live incoming messages (INSERT)
--   • project_v2_conversations → sidebar last-message refresh (*)

DO $$
BEGIN
  -- project_v2_messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'project_v2_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE project_v2_messages;
    RAISE NOTICE 'Added project_v2_messages to supabase_realtime';
  ELSE
    RAISE NOTICE 'project_v2_messages already in supabase_realtime — skipped';
  END IF;

  -- project_v2_conversations
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename  = 'project_v2_conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE project_v2_conversations;
    RAISE NOTICE 'Added project_v2_conversations to supabase_realtime';
  ELSE
    RAISE NOTICE 'project_v2_conversations already in supabase_realtime — skipped';
  END IF;
END $$;


-- ============================================================
-- STEP 2: Set REPLICA IDENTITY so UPDATE/DELETE payloads
--         include the full old row (needed for payload.old)
-- ============================================================
ALTER TABLE project_v2_messages      REPLICA IDENTITY FULL;
ALTER TABLE project_v2_conversations REPLICA IDENTITY FULL;
ALTER TABLE project_v2_profiles      REPLICA IDENTITY FULL;


-- ============================================================
-- STEP 3: Grant realtime schema access to authenticated users
--         (Supabase requires this for RLS-protected tables)
-- ============================================================
GRANT SELECT ON project_v2_messages      TO authenticated;
GRANT SELECT ON project_v2_conversations TO authenticated;
GRANT SELECT ON project_v2_profiles      TO authenticated;


-- ============================================================
-- STEP 4: Verify — run this SELECT after the migration to
--         confirm all three tables are in the publication
-- ============================================================
-- SELECT schemaname, tablename
-- FROM   pg_publication_tables
-- WHERE  pubname = 'supabase_realtime'
--   AND  tablename LIKE 'project_v2%'
-- ORDER  BY tablename;
--
-- Expected output:
--   public | project_v2_conversations
--   public | project_v2_messages
--
-- ============================================================
-- DONE. Realtime is now active.
-- The Supabase JS client in the app subscribes using:
--
--   supabase_client
--     .channel('messages:<conversation_id>')
--     .on('postgres_changes', { event: 'INSERT', schema: 'public',
--         table: 'project_v2_messages',
--         filter: 'conversation_id=eq.<id>' }, handler)
--     .subscribe()
--
--   supabase_client
--     .channel('global_conversations')
--     .on('postgres_changes', { event: '*', schema: 'public',
--         table: 'project_v2_conversations' }, handler)
--     .subscribe()
-- ============================================================
