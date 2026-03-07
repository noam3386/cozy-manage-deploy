-- Add storage policy for owners to view inspection images
CREATE POLICY "Owners can view inspection images of their properties"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'inspection-images'
  AND EXISTS (
    SELECT 1 FROM properties p
    WHERE p.owner_id = auth.uid()
    AND (storage.foldername(name))[1] = p.id::text
  )
);

-- Enable realtime for property_inspections and property_cleaning_records
ALTER PUBLICATION supabase_realtime ADD TABLE public.property_inspections;
ALTER PUBLICATION supabase_realtime ADD TABLE public.property_cleaning_records;