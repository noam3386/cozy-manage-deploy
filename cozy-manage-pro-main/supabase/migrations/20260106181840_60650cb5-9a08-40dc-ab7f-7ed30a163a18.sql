-- Create property inspections table
CREATE TABLE public.property_inspections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  inspector_id UUID NOT NULL,
  inspection_date DATE NOT NULL,
  inspection_time TEXT,
  
  -- Checklist items (boolean for each)
  water_flow_check BOOLEAN DEFAULT false,
  moisture_check BOOLEAN DEFAULT false,
  ac_filters_check BOOLEAN DEFAULT false,
  electrical_lights_check BOOLEAN DEFAULT false,
  garden_check BOOLEAN DEFAULT false,
  
  -- Notes and images
  notes TEXT,
  images TEXT[] DEFAULT '{}',
  
  -- Status
  status TEXT NOT NULL DEFAULT 'completed',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create cleaning records table
CREATE TABLE public.property_cleaning_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  cleaned_at TIMESTAMP WITH TIME ZONE NOT NULL,
  cleaned_by UUID,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.property_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_cleaning_records ENABLE ROW LEVEL SECURITY;

-- RLS policies for property_inspections
CREATE POLICY "Managers can insert inspections"
ON public.property_inspections
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can update inspections"
ON public.property_inspections
FOR UPDATE
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view all inspections"
ON public.property_inspections
FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can view inspections for their properties"
ON public.property_inspections
FOR SELECT
USING (property_id IN (
  SELECT id FROM properties WHERE owner_id = auth.uid()
));

CREATE POLICY "Managers can delete inspections"
ON public.property_inspections
FOR DELETE
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for property_cleaning_records
CREATE POLICY "Managers can insert cleaning records"
ON public.property_cleaning_records
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can update cleaning records"
ON public.property_cleaning_records
FOR UPDATE
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Managers can view all cleaning records"
ON public.property_cleaning_records
FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can view cleaning records for their properties"
ON public.property_cleaning_records
FOR SELECT
USING (property_id IN (
  SELECT id FROM properties WHERE owner_id = auth.uid()
));

-- Create storage bucket for inspection images
INSERT INTO storage.buckets (id, name, public) VALUES ('inspection-images', 'inspection-images', false);

-- Storage policies for inspection images
CREATE POLICY "Managers can upload inspection images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'inspection-images' 
  AND (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('manager', 'admin'))
  )
);

CREATE POLICY "Managers can view inspection images"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'inspection-images'
  AND (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('manager', 'admin'))
  )
);

CREATE POLICY "Owners can view inspection images for their properties"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'inspection-images'
);

CREATE POLICY "Managers can delete inspection images"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'inspection-images'
  AND (
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('manager', 'admin'))
  )
);

-- Add triggers for updated_at
CREATE TRIGGER update_property_inspections_updated_at
BEFORE UPDATE ON public.property_inspections
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();