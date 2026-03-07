-- Add images column to issues table for storing image URLs
ALTER TABLE public.issues ADD COLUMN IF NOT EXISTS images text[] DEFAULT '{}';

-- Create storage bucket for issue images
INSERT INTO storage.buckets (id, name, public)
VALUES ('issue-images', 'issue-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for issue images
CREATE POLICY "Anyone can view issue images"
ON storage.objects FOR SELECT
USING (bucket_id = 'issue-images');

CREATE POLICY "Authenticated users can upload issue images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'issue-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their uploaded issue images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'issue-images' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their uploaded issue images"
ON storage.objects FOR DELETE
USING (bucket_id = 'issue-images' AND auth.role() = 'authenticated');