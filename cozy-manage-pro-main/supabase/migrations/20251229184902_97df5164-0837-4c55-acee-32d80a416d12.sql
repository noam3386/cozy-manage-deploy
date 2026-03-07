-- Fix handle_new_user_role() to ONLY allow 'owner' role from signups
-- This prevents privilege escalation attacks where users inject 'admin' role in metadata
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role text;
BEGIN
  requested_role := NEW.raw_user_meta_data ->> 'role';
  
  -- Only allow 'owner' or 'manager' roles from signup
  -- 'admin' role can ONLY be assigned by existing admins via admin panel
  IF requested_role IS NULL OR requested_role NOT IN ('owner', 'manager') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'owner'::app_role);
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, requested_role::app_role);
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix handle_new_user() to validate role from metadata
-- Also prevents storing 'admin' role in profiles from signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_role text;
  safe_role text;
BEGIN
  requested_role := NEW.raw_user_meta_data ->> 'role';
  
  -- Only allow 'owner' or 'manager' roles from signup
  IF requested_role IS NULL OR requested_role NOT IN ('owner', 'manager') THEN
    safe_role := 'owner';
  ELSE
    safe_role := requested_role;
  END IF;
  
  INSERT INTO public.profiles (id, full_name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.email),
    NEW.email,
    safe_role
  );
  RETURN NEW;
END;
$$;