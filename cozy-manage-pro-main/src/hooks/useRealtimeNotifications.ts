import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useNotificationSound } from './useNotificationSound';
import { usePushNotifications } from './usePushNotifications';
import { toast } from 'sonner';

interface UseRealtimeNotificationsOptions {
  enabled?: boolean;
  userRole?: 'owner' | 'manager' | 'admin' | null;
  userPropertyIds?: string[];
}

export function useRealtimeNotifications(options: UseRealtimeNotificationsOptions = {}) {
  const { enabled = true, userRole, userPropertyIds = [] } = options;
  const { playNotificationSound } = useNotificationSound();
  const { sendPushNotification, isGranted } = usePushNotifications();
  const isFirstLoad = useRef(true);

  const notify = useCallback((title: string, description: string) => {
    playNotificationSound();
    toast.info(title, {
      description,
      duration: 5000,
    });

    // Send push notification if permission granted and tab not focused
    if (isGranted && document.hidden) {
      sendPushNotification(title, {
        body: description,
        tag: `notification-${Date.now()}`,
      });
    }
  }, [playNotificationSound, sendPushNotification, isGranted]);

  useEffect(() => {
    if (!enabled) return;

    console.log('Realtime notifications setup:', { userRole, userPropertyIds });

    // Small delay to prevent notifications on initial load
    const timeout = setTimeout(() => {
      isFirstLoad.current = false;
    }, 2000);

    const channel = supabase
      .channel('realtime-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'arrivals_departures'
        },
        (payload) => {
          if (isFirstLoad.current) return;
          console.log('New arrival/departure:', payload);
          
          // For owners, only notify if it's for their property
          if (userRole === 'owner') {
            if (userPropertyIds.length > 0 && userPropertyIds.includes(payload.new.property_id)) {
              const type = payload.new.type === 'arrival' ? 'הגעה' : 'עזיבה';
              notify(`${type} חדשה נרשמה`, `תאריך: ${payload.new.date}`);
            }
          } else {
            const type = payload.new.type === 'arrival' ? 'הגעה' : 'עזיבה';
            notify(`${type} חדשה התקבלה`, `תאריך: ${payload.new.date}`);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'issues'
        },
        (payload) => {
          if (isFirstLoad.current) return;
          console.log('New issue:', payload);
          notify('תקלה חדשה התקבלה', payload.new.title);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'issues'
        },
        (payload) => {
          if (isFirstLoad.current) return;
          console.log('Issue updated:', payload);
          
          // Notify owners about status changes on their issues
          if (userRole === 'owner') {
            if (userPropertyIds.length > 0 && userPropertyIds.includes(payload.new.property_id)) {
              const statusMap: Record<string, string> = {
                'new': 'חדשה',
                'in_progress': 'בטיפול',
                'resolved': 'טופלה',
                'closed': 'נסגרה'
              };
              const status = statusMap[payload.new.status] || payload.new.status;
              notify('עדכון סטטוס תקלה', `"${payload.new.title}" - ${status}`);
            }
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'service_requests'
        },
        (payload) => {
          if (isFirstLoad.current) return;
          console.log('New service request:', payload);
          const typeMap: Record<string, string> = {
            'cleaning': 'ניקיון',
            'laundry': 'כביסה',
            'maintenance': 'תחזוקה',
            'supplies': 'ציוד'
          };
          const type = typeMap[payload.new.type] || payload.new.type;
          notify('בקשת שירות חדשה', `סוג: ${type}`);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'property_inspections'
        },
        (payload) => {
          if (isFirstLoad.current) return;
          console.log('New property inspection:', payload, 'userPropertyIds:', userPropertyIds);
          
          // For owners, only notify if the inspection is for their property
          if (userRole === 'owner') {
            if (userPropertyIds.length > 0 && userPropertyIds.includes(payload.new.property_id)) {
              notify('בדיקת נכס בוצעה', `בוצעה בדיקה בנכס שלך בתאריך ${payload.new.inspection_date}`);
            }
          } else {
            notify('בדיקת נכס חדשה', `תאריך: ${payload.new.inspection_date}`);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'property_cleaning_records'
        },
        (payload) => {
          if (isFirstLoad.current) return;
          console.log('New cleaning record:', payload, 'userPropertyIds:', userPropertyIds);
          
          // For owners, only notify if the cleaning is for their property
          if (userRole === 'owner') {
            if (userPropertyIds.length > 0 && userPropertyIds.includes(payload.new.property_id)) {
              notify('הנכס שלך נוקה', `תאריך: ${payload.new.cleaned_at?.split('T')[0]}`);
            }
          } else {
            notify('עדכון ניקיון', `תאריך: ${payload.new.cleaned_at?.split('T')[0]}`);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages'
        },
        (payload) => {
          if (isFirstLoad.current) return;
          console.log('New message:', payload, 'userPropertyIds:', userPropertyIds);
          
          // For owners, only notify if the message is for their property
          if (userRole === 'owner') {
            if (userPropertyIds.length > 0 && userPropertyIds.includes(payload.new.property_id)) {
              // Only notify if not sent by the owner themselves
              if (payload.new.sender_type !== 'owner') {
                notify('הודעה חדשה', 'קיבלת הודעה חדשה מהמנהל');
              }
            }
          } else {
            // Managers get notified about all messages from owners
            if (payload.new.sender_type === 'owner') {
              notify('הודעה חדשה', 'הודעה חדשה מבעל נכס');
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    return () => {
      clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [enabled, notify, userRole, userPropertyIds]);
}
