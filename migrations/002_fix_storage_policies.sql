-- ============================================================
-- Fix: Rename storage policies to avoid conflicts with existing policies
-- Run this ONLY if 001 failed on storage policies
-- ============================================================

-- Drop conflicting policies if they exist (safe to run)
DROP POLICY IF EXISTS "Authenticated users can upload" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view media" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own uploads" ON storage.objects;

-- Create bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('project-v2-media', 'project-v2-media', true, 52428800)
ON CONFLICT (id) DO NOTHING;

-- Recreate with unique prefixed names
CREATE POLICY "project_v2_authenticated_upload"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'project-v2-media' AND auth.role() = 'authenticated');

CREATE POLICY "project_v2_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'project-v2-media');

CREATE POLICY "project_v2_owner_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'project-v2-media' AND auth.uid()::text = (storage.foldername(name))[1]);
