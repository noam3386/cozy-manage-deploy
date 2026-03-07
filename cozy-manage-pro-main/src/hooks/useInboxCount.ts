import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useInboxCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = async () => {
    try {
      // Count new issues
      const { count: issuesCount, error: issuesError } = await supabase
        .from('issues')
        .select('*', { count: 'exact', head: true })
        .in('status', ['new', 'reviewing']);

      // Count new service requests
      const { count: servicesCount, error: servicesError } = await supabase
        .from('service_requests')
        .select('*', { count: 'exact', head: true })
        .in('status', ['new', 'confirmed']);

      // Count pending arrivals
      const { count: arrivalsCount, error: arrivalsError } = await supabase
        .from('arrivals_departures')
        .select('*', { count: 'exact', head: true })
        .in('status', ['pending', 'confirmed']);

      const total = (issuesCount || 0) + (servicesCount || 0) + (arrivalsCount || 0);
      setCount(total);
    } catch (error) {
      console.error('Error fetching inbox count:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCount();

    // Subscribe to realtime updates
    const issuesChannel = supabase
      .channel('inbox-count-issues')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, fetchCount)
      .subscribe();

    const servicesChannel = supabase
      .channel('inbox-count-services')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, fetchCount)
      .subscribe();

    const arrivalsChannel = supabase
      .channel('inbox-count-arrivals')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'arrivals_departures' }, fetchCount)
      .subscribe();

    return () => {
      supabase.removeChannel(issuesChannel);
      supabase.removeChannel(servicesChannel);
      supabase.removeChannel(arrivalsChannel);
    };
  }, []);

  return { count, loading, refetch: fetchCount };
}
