-- ============================================================
-- AI Roleplay Chat - Project V2 - Initial Migration
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- ============================================================
-- 1. PROFILES TABLE
-- ============================================================
CREATE TABLE project_v2_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  age INTEGER CHECK (age >= 13 AND age <= 120),
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE project_v2_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read any profile"
  ON project_v2_profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON project_v2_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON project_v2_profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================
-- 2. CONVERSATIONS TABLE (1-on-1 between two users or user+AI)
-- ============================================================
CREATE TABLE project_v2_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  participant_2 UUID REFERENCES auth.users(id) ON DELETE CASCADE, -- NULL for AI bot conversations
  bot_id TEXT, -- e.g. 'vance', 'kira' etc. NULL for user-to-user
  last_message_text TEXT DEFAULT '',
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT chk_conversation_type CHECK (
    (participant_2 IS NOT NULL AND bot_id IS NULL) OR
    (participant_2 IS NULL AND bot_id IS NOT NULL)
  )
);

CREATE INDEX idx_conv_p1 ON project_v2_conversations(participant_1);
CREATE INDEX idx_conv_p2 ON project_v2_conversations(participant_2);
CREATE INDEX idx_conv_last_msg ON project_v2_conversations(last_message_at DESC);

ALTER TABLE project_v2_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own conversations"
  ON project_v2_conversations FOR SELECT
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

CREATE POLICY "Users can create conversations"
  ON project_v2_conversations FOR INSERT
  WITH CHECK (auth.uid() = participant_1);

CREATE POLICY "Users can update own conversations"
  ON project_v2_conversations FOR UPDATE
  USING (auth.uid() = participant_1 OR auth.uid() = participant_2);

-- ============================================================
-- 3. MESSAGES TABLE (text + media)
-- ============================================================
CREATE TYPE project_v2_message_type AS ENUM ('text', 'image', 'audio', 'video', 'document');

CREATE TABLE project_v2_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES project_v2_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'assistant')),
  content TEXT DEFAULT '',
  message_type project_v2_message_type NOT NULL DEFAULT 'text',
  media_url TEXT, -- Supabase storage URL for media/documents
  media_name TEXT, -- Original filename for documents
  media_size INTEGER, -- File size in bytes
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_msg_conv ON project_v2_messages(conversation_id, created_at);
CREATE INDEX idx_msg_sender ON project_v2_messages(sender_id);

ALTER TABLE project_v2_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read messages in their conversations"
  ON project_v2_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_v2_conversations c
      WHERE c.id = conversation_id
      AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );

CREATE POLICY "Users can insert messages in their conversations"
  ON project_v2_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM project_v2_conversations c
      WHERE c.id = conversation_id
      AND (c.participant_1 = auth.uid() OR c.participant_2 = auth.uid())
    )
  );

-- ============================================================
-- 4. FUNCTION: Auto-update conversation last_message on insert
-- ============================================================
CREATE OR REPLACE FUNCTION project_v2_update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE project_v2_conversations
  SET last_message_text = CASE
        WHEN NEW.message_type = 'text' THEN LEFT(NEW.content, 100)
        WHEN NEW.message_type = 'image' THEN '📷 Photo'
        WHEN NEW.message_type = 'audio' THEN '🎵 Audio'
        WHEN NEW.message_type = 'video' THEN '🎬 Video'
        WHEN NEW.message_type = 'document' THEN '📄 ' || COALESCE(NEW.media_name, 'Document')
      END,
      last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_update_last_message
  AFTER INSERT ON project_v2_messages
  FOR EACH ROW
  EXECUTE FUNCTION project_v2_update_conversation_last_message();

-- ============================================================
-- 5. FUNCTION: Auto-update profile updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION project_v2_update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profile_updated_at
  BEFORE UPDATE ON project_v2_profiles
  FOR EACH ROW
  EXECUTE FUNCTION project_v2_update_updated_at();

-- ============================================================
-- 6. ENABLE REALTIME for messages and conversations
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE project_v2_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE project_v2_conversations;

-- ============================================================
-- 7. STORAGE BUCKET
-- ============================================================
-- Create this bucket in Supabase Dashboard > Storage:
--
--   Bucket name: project-v2-media
--   Public: true (so URLs are accessible)
--   File size limit: 50MB
--   Allowed MIME types: image/*, audio/*, video/*, application/pdf,
--     application/msword, application/vnd.openxmlformats-officedocument.*,
--     application/vnd.ms-excel, text/plain, text/csv
--
-- Then run these storage policies in the SQL editor:

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('project-v2-media', 'project-v2-media', true, 52428800)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "project_v2_authenticated_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'project-v2-media' AND auth.role() = 'authenticated');

CREATE POLICY "project_v2_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-v2-media');

CREATE POLICY "project_v2_owner_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'project-v2-media' AND auth.uid()::text = (storage.foldername(name))[1]);
