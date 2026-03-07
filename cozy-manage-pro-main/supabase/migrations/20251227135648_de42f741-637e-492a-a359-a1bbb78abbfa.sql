-- Create vendors table
CREATE TABLE public.vendors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  company_name TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  specialty TEXT[] DEFAULT '{}',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Managers can view all vendors
CREATE POLICY "Managers can view vendors"
ON public.vendors
FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Managers can insert vendors
CREATE POLICY "Managers can insert vendors"
ON public.vendors
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Managers can update vendors
CREATE POLICY "Managers can update vendors"
ON public.vendors
FOR UPDATE
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Managers can delete vendors
CREATE POLICY "Managers can delete vendors"
ON public.vendors
FOR DELETE
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_vendors_updated_at
BEFORE UPDATE ON public.vendors
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add RLS policy for managers to insert properties for owners
CREATE POLICY "Managers can insert properties for assigned clients"
ON public.properties
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Add RLS policy for managers to update properties they manage
CREATE POLICY "Managers can update assigned properties"
ON public.properties
FOR UPDATE
USING (id IN (
  SELECT property_id FROM manager_properties WHERE manager_id = auth.uid()
) OR has_role(auth.uid(), 'admin'::app_role));

-- Add policy for managers to view profiles for creating properties
CREATE POLICY "Managers can view all owner profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));