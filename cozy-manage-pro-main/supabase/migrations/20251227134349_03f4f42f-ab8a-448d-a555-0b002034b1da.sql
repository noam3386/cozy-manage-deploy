-- Create a table to link managers to properties they manage
CREATE TABLE public.manager_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (manager_id, property_id)
);

-- Enable RLS
ALTER TABLE public.manager_properties ENABLE ROW LEVEL SECURITY;

-- Managers can view their own assignments
CREATE POLICY "Managers can view their assignments"
ON public.manager_properties
FOR SELECT
USING (manager_id = auth.uid());

-- Admins can manage all assignments
CREATE POLICY "Admins can insert assignments"
ON public.manager_properties
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete assignments"
ON public.manager_properties
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Update properties RLS to allow managers to view properties they manage
CREATE POLICY "Managers can view assigned properties"
ON public.properties
FOR SELECT
USING (
  id IN (
    SELECT property_id FROM public.manager_properties WHERE manager_id = auth.uid()
  )
);

-- Allow managers to view profiles of property owners they manage
CREATE POLICY "Managers can view owner profiles"
ON public.profiles
FOR SELECT
USING (
  id IN (
    SELECT p.owner_id 
    FROM public.properties p
    JOIN public.manager_properties mp ON mp.property_id = p.id
    WHERE mp.manager_id = auth.uid()
  )
);

-- Allow managers to view arrivals for assigned properties
CREATE POLICY "Managers can view arrivals for assigned properties"
ON public.arrivals_departures
FOR SELECT
USING (
  property_id IN (
    SELECT property_id FROM public.manager_properties WHERE manager_id = auth.uid()
  )
);

-- Allow managers to update arrivals for assigned properties
CREATE POLICY "Managers can update arrivals for assigned properties"
ON public.arrivals_departures
FOR UPDATE
USING (
  property_id IN (
    SELECT property_id FROM public.manager_properties WHERE manager_id = auth.uid()
  )
);

-- Allow managers to view issues for assigned properties
CREATE POLICY "Managers can view issues for assigned properties"
ON public.issues
FOR SELECT
USING (
  property_id IN (
    SELECT property_id FROM public.manager_properties WHERE manager_id = auth.uid()
  )
);

-- Allow managers to update issues for assigned properties
CREATE POLICY "Managers can update issues for assigned properties"
ON public.issues
FOR UPDATE
USING (
  property_id IN (
    SELECT property_id FROM public.manager_properties WHERE manager_id = auth.uid()
  )
);

-- Allow managers to view tasks for assigned properties
CREATE POLICY "Managers can view tasks for assigned properties"
ON public.tasks
FOR SELECT
USING (
  property_id IN (
    SELECT property_id FROM public.manager_properties WHERE manager_id = auth.uid()
  )
);

-- Allow managers to update tasks for assigned properties
CREATE POLICY "Managers can update tasks for assigned properties"
ON public.tasks
FOR UPDATE
USING (
  property_id IN (
    SELECT property_id FROM public.manager_properties WHERE manager_id = auth.uid()
  )
);

-- Allow managers to view service requests for assigned properties
CREATE POLICY "Managers can view service requests for assigned properties"
ON public.service_requests
FOR SELECT
USING (
  property_id IN (
    SELECT property_id FROM public.manager_properties WHERE manager_id = auth.uid()
  )
);

-- Allow managers to update service requests for assigned properties
CREATE POLICY "Managers can update service requests for assigned properties"
ON public.service_requests
FOR UPDATE
USING (
  property_id IN (
    SELECT property_id FROM public.manager_properties WHERE manager_id = auth.uid()
  )
);