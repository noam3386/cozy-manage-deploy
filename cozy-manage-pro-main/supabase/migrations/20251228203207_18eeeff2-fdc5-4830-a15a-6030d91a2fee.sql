-- Allow managers to view ALL properties (not just assigned ones)
DROP POLICY IF EXISTS "Managers can view assigned properties" ON public.properties;
CREATE POLICY "Managers can view all properties" 
ON public.properties 
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Allow managers to view ALL issues
DROP POLICY IF EXISTS "Managers can view issues for assigned properties" ON public.issues;
CREATE POLICY "Managers can view all issues" 
ON public.issues 
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Allow managers to view ALL service requests
DROP POLICY IF EXISTS "Managers can view service requests for assigned properties" ON public.service_requests;
CREATE POLICY "Managers can view all service requests" 
ON public.service_requests 
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Allow managers to view ALL arrivals
DROP POLICY IF EXISTS "Managers can view arrivals for assigned properties" ON public.arrivals_departures;
CREATE POLICY "Managers can view all arrivals" 
ON public.arrivals_departures 
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Allow managers to view ALL tasks
DROP POLICY IF EXISTS "Managers can view tasks for assigned properties" ON public.tasks;
CREATE POLICY "Managers can view all tasks" 
ON public.tasks 
FOR SELECT 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Also update UPDATE policies for managers
DROP POLICY IF EXISTS "Managers can update issues for assigned properties" ON public.issues;
CREATE POLICY "Managers can update all issues" 
ON public.issues 
FOR UPDATE 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Managers can update service requests for assigned properties" ON public.service_requests;
CREATE POLICY "Managers can update all service requests" 
ON public.service_requests 
FOR UPDATE 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Managers can update arrivals for assigned properties" ON public.arrivals_departures;
CREATE POLICY "Managers can update all arrivals" 
ON public.arrivals_departures 
FOR UPDATE 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Managers can update tasks for assigned properties" ON public.tasks;
CREATE POLICY "Managers can update all tasks" 
ON public.tasks 
FOR UPDATE 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Managers can update assigned properties" ON public.properties;
CREATE POLICY "Managers can update all properties" 
ON public.properties 
FOR UPDATE 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));