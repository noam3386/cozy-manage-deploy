-- Create storage bucket for property images
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-images', 'property-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to view property images (public bucket)
CREATE POLICY "Property images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-images');

-- Allow managers and admins to upload property images
CREATE POLICY "Managers can upload property images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'property-images' 
  AND (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'))
);

-- Allow managers and admins to update property images
CREATE POLICY "Managers can update property images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'property-images' 
  AND (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'))
);

-- Allow managers and admins to delete property images
CREATE POLICY "Managers can delete property images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'property-images' 
  AND (has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin'))
);

-- Add RLS policy for managers to delete properties
CREATE POLICY "Managers can delete properties"
ON public.properties FOR DELETE
USING (
  has_role(auth.uid(), 'manager') OR has_role(auth.uid(), 'admin')
);