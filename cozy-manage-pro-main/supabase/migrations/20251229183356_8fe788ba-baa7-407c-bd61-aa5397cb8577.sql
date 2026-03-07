-- Create a separate table for security codes with strict RLS
-- Only property owners can view/update their own security codes (not managers)

CREATE TABLE public.property_security_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL UNIQUE,
  door_code TEXT,
  safe_code TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.property_security_codes ENABLE ROW LEVEL SECURITY;

-- Create strict RLS policies - ONLY property owners can access their security codes
-- Managers should NOT have access to these sensitive codes

CREATE POLICY "Owners can view their property security codes"
ON public.property_security_codes
FOR SELECT
USING (
  property_id IN (
    SELECT id FROM public.properties WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Owners can insert security codes for their properties"
ON public.property_security_codes
FOR INSERT
WITH CHECK (
  property_id IN (
    SELECT id FROM public.properties WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Owners can update their property security codes"
ON public.property_security_codes
FOR UPDATE
USING (
  property_id IN (
    SELECT id FROM public.properties WHERE owner_id = auth.uid()
  )
);

CREATE POLICY "Owners can delete their property security codes"
ON public.property_security_codes
FOR DELETE
USING (
  property_id IN (
    SELECT id FROM public.properties WHERE owner_id = auth.uid()
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_property_security_codes_updated_at
BEFORE UPDATE ON public.property_security_codes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migrate existing security codes from properties to the new table
INSERT INTO public.property_security_codes (property_id, door_code, safe_code)
SELECT id, door_code, safe_code
FROM public.properties
WHERE door_code IS NOT NULL OR safe_code IS NOT NULL;

-- Remove security code columns from properties table (they should no longer be there)
ALTER TABLE public.properties DROP COLUMN IF EXISTS door_code;
ALTER TABLE public.properties DROP COLUMN IF EXISTS safe_code;