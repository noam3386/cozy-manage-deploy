-- Create a function that will call the edge function via pg_net
CREATE OR REPLACE FUNCTION public.notify_push_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  payload jsonb;
  supabase_url text;
  service_role_key text;
BEGIN
  -- Build the payload
  payload := jsonb_build_object(
    'type', TG_OP,
    'table', TG_TABLE_NAME,
    'record', to_jsonb(NEW),
    'old_record', CASE WHEN TG_OP = 'UPDATE' THEN to_jsonb(OLD) ELSE NULL END
  );

  -- Get the edge function URL from vault or use environment
  supabase_url := current_setting('app.settings.supabase_url', true);
  
  -- Make HTTP request to edge function using pg_net
  PERFORM net.http_post(
    url := 'https://ftwxfyjqjiqrqymrnazl.supabase.co/functions/v1/database-webhook-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := payload
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the transaction
    RAISE WARNING 'Push notification webhook failed: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create triggers for each table
DROP TRIGGER IF EXISTS push_notify_messages ON public.messages;
CREATE TRIGGER push_notify_messages
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_webhook();

DROP TRIGGER IF EXISTS push_notify_issues ON public.issues;
CREATE TRIGGER push_notify_issues
  AFTER INSERT OR UPDATE ON public.issues
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_webhook();

DROP TRIGGER IF EXISTS push_notify_inspections ON public.property_inspections;
CREATE TRIGGER push_notify_inspections
  AFTER INSERT ON public.property_inspections
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_webhook();

DROP TRIGGER IF EXISTS push_notify_cleaning ON public.property_cleaning_records;
CREATE TRIGGER push_notify_cleaning
  AFTER INSERT ON public.property_cleaning_records
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_webhook();

DROP TRIGGER IF EXISTS push_notify_arrivals ON public.arrivals_departures;
CREATE TRIGGER push_notify_arrivals
  AFTER INSERT ON public.arrivals_departures
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_webhook();

DROP TRIGGER IF EXISTS push_notify_service_requests ON public.service_requests;
CREATE TRIGGER push_notify_service_requests
  AFTER INSERT ON public.service_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_push_webhook();