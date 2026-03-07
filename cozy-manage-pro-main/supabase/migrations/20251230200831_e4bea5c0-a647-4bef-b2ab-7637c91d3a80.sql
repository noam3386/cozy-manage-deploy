-- Fix #1: Make property-images bucket private and update policies
-- This prevents unauthorized access to property images

-- Update bucket to private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'property-images';

-- Remove the public SELECT policy
DROP POLICY IF EXISTS "Property images are publicly accessible" ON storage.objects;

-- Create authenticated access policy - any logged-in user can view property images
-- (RLS on properties table already controls who can see which properties)
CREATE POLICY "Authenticated users can view property images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'property-images' 
  AND auth.role() = 'authenticated'
);

-- Also apply same treatment to issue-images bucket
UPDATE storage.buckets 
SET public = false 
WHERE id = 'issue-images';

-- Drop any public policy on issue-images if exists
DROP POLICY IF EXISTS "Issue images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view issue images" ON storage.objects;

-- Create authenticated access policy for issue images
CREATE POLICY "Authenticated users can view issue images"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'issue-images' 
  AND auth.role() = 'authenticated'
);