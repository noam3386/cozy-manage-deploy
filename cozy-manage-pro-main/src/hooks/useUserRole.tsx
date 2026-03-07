import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

type AppRole = 'admin' | 'owner' | 'manager';

interface UserRoleHook {
  role: AppRole | null;
  loading: boolean;
  isAdmin: boolean;
  isOwner: boolean;
  isManager: boolean;
  refetch: () => Promise<void>;
}

export const useUserRole = (): UserRoleHook => {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loading, setLoading] = useState(true);

  const pickHighestRole = (roles: AppRole[]): AppRole | null => {
    if (roles.includes('admin')) return 'admin';
    if (roles.includes('manager')) return 'manager';
    if (roles.includes('owner')) return 'owner';
    return null;
  };

  const fetchRole = async () => {
    setLoading(true);

    if (!user) {
      setRole(null);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (error) {
      setRole(null);
      setLoading(false);
      return;
    }

    const roles = (data ?? []).map((r) => r.role as AppRole);
    setRole(pickHighestRole(roles));
    setLoading(false);
  };

  useEffect(() => {
    fetchRole();
  }, [user?.id]);

  return {
    role,
    loading,
    isAdmin: role === 'admin',
    isOwner: role === 'owner',
    isManager: role === 'manager',
    refetch: fetchRole,
  };
};
