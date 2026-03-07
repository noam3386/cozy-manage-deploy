import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export type PushPermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

// VAPID public key - this is safe to expose
const VAPID_PUBLIC_KEY = 'BE3xjqpZcr6cvIW_YD6K4NyOAbHlE0A6IHKY3yoLTJyf2XGCt9jkFaUNfKcAurkX53Rb8IATvXfx4KX_weU_P3A';

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray.buffer as ArrayBuffer;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<PushPermissionState>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    console.log('[Push] Initializing push notifications...');
    console.log('[Push] User:', user?.id || 'not logged in');
    
    if (!('Notification' in window)) {
      console.warn('[Push] Notifications not supported in this browser');
      setPermission('unsupported');
      return;
    }
    
    const currentPermission = Notification.permission as PushPermissionState;
    console.log('[Push] Current permission:', currentPermission);
    setPermission(currentPermission);
    
    // Register push service worker and check subscription
    if ('serviceWorker' in navigator) {
      console.log('[Push] Registering service worker...');
      navigator.serviceWorker.register('/sw-push.js', { scope: '/' })
        .then((registration) => {
          console.log('[Push] Service Worker registered successfully');
          console.log('[Push] SW scope:', registration.scope);
          console.log('[Push] SW state:', registration.active?.state || 'no active worker');
          if (user) {
            checkSubscription();
          }
        })
        .catch((error) => {
          console.error('[Push] Service Worker registration failed:', error);
        });
    } else {
      console.warn('[Push] Service Worker not supported');
    }
  }, [user]);

  const checkSubscription = useCallback(async () => {
    console.log('[Push] Checking existing subscription...');
    try {
      const registration = await navigator.serviceWorker.ready;
      console.log('[Push] Service Worker ready');
      const subscription = await (registration as any).pushManager.getSubscription();
      console.log('[Push] Existing subscription:', subscription ? 'found' : 'none');
      if (subscription) {
        console.log('[Push] Subscription endpoint:', subscription.endpoint.substring(0, 50) + '...');
      }
      setIsSubscribed(!!subscription);
    } catch (error) {
      console.error('[Push] Error checking subscription:', error);
    }
  }, []);

  const subscribeToWebPush = useCallback(async (): Promise<boolean> => {
    console.log('[Push] Starting web push subscription...');
    
    if (!user) {
      console.warn('[Push] Cannot subscribe - user not authenticated');
      return false;
    }
    console.log('[Push] User ID:', user.id);

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('[Push] Push messaging not supported');
      console.log('[Push] serviceWorker support:', 'serviceWorker' in navigator);
      console.log('[Push] PushManager support:', 'PushManager' in window);
      return false;
    }

    try {
      console.log('[Push] Waiting for service worker to be ready...');
      const registration = await navigator.serviceWorker.ready;
      console.log('[Push] Service Worker is ready');
      
      // Check for existing subscription
      console.log('[Push] Checking for existing subscription...');
      let subscription = await (registration as any).pushManager.getSubscription();
      
      if (subscription) {
        console.log('[Push] Found existing subscription');
      } else {
        console.log('[Push] No existing subscription, creating new one...');
        console.log('[Push] Using VAPID key:', VAPID_PUBLIC_KEY.substring(0, 20) + '...');
        
        try {
          subscription = await (registration as any).pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          });
          console.log('[Push] New subscription created successfully');
        } catch (subscribeError) {
          console.error('[Push] Failed to create subscription:', subscribeError);
          throw subscribeError;
        }
      }

      const subscriptionJson = subscription.toJSON();
      console.log('[Push] Subscription JSON:');
      console.log('[Push]   - endpoint:', subscriptionJson.endpoint?.substring(0, 50) + '...');
      console.log('[Push]   - p256dh:', subscriptionJson.keys?.p256dh?.substring(0, 20) + '...');
      console.log('[Push]   - auth:', subscriptionJson.keys?.auth?.substring(0, 10) + '...');
      
      // Save subscription to database
      console.log('[Push] Saving subscription to database...');
      console.log('[Push] User ID for insert:', user.id);
      
      // First, delete any existing subscription with this endpoint for this user
      const { error: deleteError } = await supabase
        .from('push_subscriptions')
        .delete()
        .eq('user_id', user.id);
      
      if (deleteError) {
        console.warn('[Push] Error deleting old subscriptions (non-fatal):', deleteError);
      }
      
      // Then insert the new subscription
      const { data: insertData, error } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: user.id,
          endpoint: subscriptionJson.endpoint!,
          p256dh: subscriptionJson.keys!.p256dh!,
          auth: subscriptionJson.keys!.auth!,
        })
        .select();

      console.log('[Push] Insert result:', insertData);
      
      if (error) {
        console.error('[Push] Error saving subscription to database:', error);
        console.error('[Push] Error code:', error.code);
        console.error('[Push] Error message:', error.message);
        console.error('[Push] Error details:', error.details);
        return false;
      }

      console.log('[Push] Subscription saved to database successfully');
      setIsSubscribed(true);
      return true;
    } catch (error) {
      console.error('[Push] Error in subscribeToWebPush:', error);
      return false;
    }
  }, [user]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    console.log('[Push] Requesting notification permission...');
    
    if (!('Notification' in window)) {
      console.warn('[Push] Notifications not supported');
      return false;
    }

    try {
      console.log('[Push] Current permission before request:', Notification.permission);
      const result = await Notification.requestPermission();
      console.log('[Push] Permission result:', result);
      setPermission(result as PushPermissionState);
      
      if (result === 'granted') {
        console.log('[Push] Permission granted, subscribing to web push...');
        const subscribeResult = await subscribeToWebPush();
        console.log('[Push] Subscribe result:', subscribeResult);
      } else {
        console.log('[Push] Permission not granted, skipping subscription');
      }
      
      return result === 'granted';
    } catch (error) {
      console.error('[Push] Error requesting notification permission:', error);
      return false;
    }
  }, [subscribeToWebPush]);

  const sendPushNotification = useCallback((title: string, options?: NotificationOptions) => {
    console.log('[Push] Sending local notification:', title);
    
    if (!('Notification' in window)) {
      console.warn('[Push] Notifications not supported');
      return;
    }

    if (Notification.permission !== 'granted') {
      console.warn('[Push] Notifications not permitted, current:', Notification.permission);
      return;
    }

    try {
      const notification = new Notification(title, {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        dir: 'rtl',
        lang: 'he',
        requireInteraction: false,
        ...options,
      });
      console.log('[Push] Local notification created');

      notification.onclick = () => {
        console.log('[Push] Notification clicked');
        window.focus();
        notification.close();
      };

      // Auto-close after 5 seconds
      setTimeout(() => notification.close(), 5000);
    } catch (error) {
      console.error('[Push] Error sending local notification:', error);
    }
  }, []);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    console.log('[Push] Unsubscribing from push notifications...');
    
    if (!user) {
      console.warn('[Push] Cannot unsubscribe - no user');
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await (registration as any).pushManager.getSubscription();
      
      if (subscription) {
        console.log('[Push] Unsubscribing from push manager...');
        await subscription.unsubscribe();
        console.log('[Push] Unsubscribed from push manager');
        
        // Remove from database
        console.log('[Push] Removing subscription from database...');
        const { error } = await supabase
          .from('push_subscriptions')
          .delete()
          .eq('endpoint', subscription.endpoint);
          
        if (error) {
          console.error('[Push] Error removing from database:', error);
        } else {
          console.log('[Push] Removed from database');
        }
      } else {
        console.log('[Push] No subscription to unsubscribe from');
      }
      
      setIsSubscribed(false);
      return true;
    } catch (error) {
      console.error('[Push] Error unsubscribing:', error);
      return false;
    }
  }, [user]);

  return {
    permission,
    requestPermission,
    sendPushNotification,
    subscribeToWebPush,
    unsubscribe,
    isSupported: permission !== 'unsupported',
    isGranted: permission === 'granted',
    isSubscribed,
  };
}
