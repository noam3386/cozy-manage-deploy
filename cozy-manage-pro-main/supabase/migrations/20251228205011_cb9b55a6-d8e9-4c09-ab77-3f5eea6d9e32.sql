-- Enable realtime for issues table
ALTER PUBLICATION supabase_realtime ADD TABLE public.issues;

-- Enable realtime for service_requests table
ALTER PUBLICATION supabase_realtime ADD TABLE public.service_requests;

-- Enable realtime for arrivals_departures table
ALTER PUBLICATION supabase_realtime ADD TABLE public.arrivals_departures;