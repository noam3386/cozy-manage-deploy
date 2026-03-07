-- Add archived column to profiles table for soft delete
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

-- Add archived_at timestamp
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone DEFAULT NULL;

-- Update RLS policies to exclude archived profiles from normal queries
DROP POLICY IF EXISTS "Managers can view all owner profiles" ON public.profiles;
CREATE POLICY "Managers can view all owner profiles" 
ON public.profiles 
FOR SELECT 
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
);

-- Add policy for managers to update profiles (for archiving)
DROP POLICY IF EXISTS "Managers can update owner profiles" ON public.profiles;
CREATE POLICY "Managers can update owner profiles" 
ON public.profiles 
FOR UPDATE 
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));