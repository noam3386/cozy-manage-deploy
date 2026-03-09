import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAppStore } from '@/store/appStore';
import { useUserRole } from '@/hooks/useUserRole';
import { useRealtimeNotifications } from '@/hooks/useRealtimeNotifications';
import { PushNotificationPrompt } from '@/components/PushNotificationPrompt';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useTranslation } from 'react-i18next';

const pageTitleKeys: Record<string, string> = {
  '/owner': 'pageTitles.welcome',
  '/owner/properties': 'pageTitles.myProperties',
  '/owner/arrivals': 'pageTitles.arrivalDeparture',
  '/owner/services': 'pageTitles.services',
  '/owner/issues': 'pageTitles.issues',
  '/owner/payments': 'pageTitles.payments',
  '/owner/messages': 'pageTitles.messages',
  '/owner/inspections': 'pageTitles.inspections',
  '/manager': 'pageTitles.dashboard',
  '/manager/owners': 'pageTitles.owners',
  '/manager/properties': 'pageTitles.managedProperties',
  '/manager/requests': 'pageTitles.serviceRequests',
  '/manager/messages': 'pageTitles.messages',
  '/manager/calendar': 'pageTitles.calendar',
  '/manager/actions': 'pageTitles.propertyActions',
  '/manager/vendors': 'pageTitles.vendors',
  '/manager/inspections': 'pageTitles.apartmentInspections',
  '/manager/cleaning-records': 'pageTitles.cleaningRecords',
  '/manager/reminders': 'pageTitles.reminders',
  '/manager/vendor-tasks': 'pageTitles.vendorTasks',
  '/vendor': 'pageTitles.vendorDashboard',
};

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ownerPropertyIds, setOwnerPropertyIds] = useState<string[]>([]);
  const location = useLocation();
  const navigate = useNavigate();
  const { currentRole, setRole } = useAppStore();
  const { role, loading: roleLoading } = useUserRole();
  const { user } = useAuth();
  const { t } = useTranslation();

  // Fetch owner property IDs for notifications
  useEffect(() => {
    async function fetchOwnerProperties() {
      if (!user || role !== 'owner') {
        setOwnerPropertyIds([]);
        return;
      }

      const { data } = await supabase
        .from('properties')
        .select('id')
        .eq('owner_id', user.id);

      if (data) {
        setOwnerPropertyIds(data.map(p => p.id));
      }
    }

    fetchOwnerProperties();
  }, [user, role]);
  
  // Enable realtime notifications with sound
  useRealtimeNotifications({ 
    enabled: true,
    userRole: role,
    userPropertyIds: ownerPropertyIds
  });

  const effectiveRole = role === 'manager' || role === 'admin' ? 'manager' : 'owner';
  const titleKey = pageTitleKeys[location.pathname];
  const pageTitle = titleKey ? t(titleKey) : '';

  // Keep UI role in sync with backend role
  useEffect(() => {
    if (roleLoading) return;
    if (currentRole !== effectiveRole) {
      setRole(effectiveRole);
    }
  }, [currentRole, effectiveRole, roleLoading, setRole]);

  // Redirect to correct dashboard when role changes
  useEffect(() => {
    if (roleLoading) return;

    const isOwnerPath = location.pathname.startsWith('/owner');
    const isManagerPath = location.pathname.startsWith('/manager');

    if (effectiveRole === 'owner' && isManagerPath) {
      navigate('/owner', { replace: true });
    } else if (effectiveRole === 'manager' && isOwnerPath) {
      navigate('/manager', { replace: true });
    }
  }, [effectiveRole, roleLoading, location.pathname, navigate]);

  return (
    <div className="min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="lg:mr-72">
        <Header onMenuClick={() => setSidebarOpen(true)} title={pageTitle} />
        
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>

      {/* Push notification permission prompt for managers */}
      <PushNotificationPrompt />
    </div>
  );
}
