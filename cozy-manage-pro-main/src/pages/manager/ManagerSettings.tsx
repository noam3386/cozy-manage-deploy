import { useTranslation } from 'react-i18next';
import { Bell, BellOff, Loader2, CheckCircle, XCircle, Bug } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function ManagerSettings() {
  const { t } = useTranslation();
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  
  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('he-IL');
    setDebugLogs(prev => [...prev, `[${timestamp}] ${message}`]);
  };
  const { user } = useAuth();
  const { 
    permission, 
    isSupported, 
    isGranted, 
    isSubscribed,
    requestPermission, 
    subscribeToWebPush,
    unsubscribe 
  } = usePushNotifications();
  
  const [testing, setTesting] = useState(false);

  const handleToggleNotifications = async () => {
    addLog('מתחיל הפעלה/ביטול התראות...');
    if (isSubscribed) {
      addLog('מבטל הרשמה...');
      const success = await unsubscribe();
      if (success) {
        addLog('✅ התראות בוטלו בהצלחה');
        toast.success(t('notifications.disabled'));
      } else {
        addLog('❌ שגיאה בביטול ההתראות');
        toast.error(t('common.error'));
      }
    } else {
      addLog('מבקש הרשאה להתראות...');
      addLog(`הרשאה נוכחית: ${permission}`);
      const success = await requestPermission();
      if (success) {
        addLog('✅ התראות הופעלו בהצלחה');
        toast.success(t('notifications.enabled'));
      } else if (permission === 'denied') {
        addLog('❌ ההתראות חסומות בדפדפן');
        toast.error(t('notifications.blockedDesc'));
      } else {
        addLog('❌ לא הצליח להפעיל התראות');
      }
    }
  };

  const checkDatabaseSubscription = async () => {
    addLog('בודק הרשמות בדאטאבייס...');
    if (!user) {
      addLog('❌ אין משתמש מחובר');
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', user.id);
      
      if (error) {
        addLog(`❌ שגיאת דאטאבייס: ${error.message}`);
      } else if (!data || data.length === 0) {
        addLog('⚠️ אין הרשמות בדאטאבייס עבור משתמש זה!');
        addLog('הבעיה: ההרשמה לא נשמרה. צריך להירשם מחדש.');
      } else {
        addLog(`✅ נמצאו ${data.length} הרשמות בדאטאבייס`);
        data.forEach((sub, i) => {
          addLog(`  [${i + 1}] endpoint: ${sub.endpoint.substring(0, 40)}...`);
        });
      }
    } catch (err) {
      addLog(`❌ Exception: ${err}`);
    }
  };

  const forceResubscribe = async () => {
    addLog('מתחיל הרשמה מחדש...');
    if (!user) {
      addLog('❌ אין משתמש מחובר');
      return;
    }
    
    setTesting(true);
    try {
      // First unsubscribe
      addLog('שלב 1: ביטול הרשמה קיימת...');
      await unsubscribe();
      
      // Wait a moment
      await new Promise(r => setTimeout(r, 500));
      
      // Then resubscribe
      addLog('שלב 2: הרשמה מחדש...');
      const success = await subscribeToWebPush();
      addLog(`תוצאה: ${success ? '✅ הצלחה' : '❌ כישלון'}`);
      
      if (success) {
        // Verify in database
        addLog('שלב 3: מאמת בדאטאבייס...');
        await new Promise(r => setTimeout(r, 500));
        await checkDatabaseSubscription();
        toast.success(t('common.success'));
      } else {
        toast.error(t('common.error'));
      }
    } catch (err) {
      addLog(`❌ Exception: ${err}`);
      toast.error(t('common.error'));
    } finally {
      setTesting(false);
    }
  };

  const sendTestNotification = async () => {
    addLog('מתחיל שליחת התראת בדיקה...');
    
    if (!user) {
      addLog('❌ אין משתמש מחובר');
      toast.error(t('common.error'));
      return;
    }
    addLog(`משתמש: ${user.id.substring(0, 8)}...`);

    setTesting(true);
    
    try {
      addLog('שולח התראה דרך Service Worker...');
      if (Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        addLog('✅ Service Worker מוכן');
        
        await registration.showNotification('בדיקת התראה 🔔', {
          body: 'זו התראה מקומית - אם אתה רואה אותה, התראות עובדות!',
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          dir: 'rtl',
          lang: 'he',
          tag: 'local-test'
        });
        addLog('✅ התראה נשלחה בהצלחה!');
      } else {
        addLog(`⚠️ אין הרשאה להתראות: ${Notification.permission}`);
      }

      toast.success(t('notifications.enabled'));
      
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      addLog(`❌ Exception: ${errorMsg}`);
      toast.error(t('common.error'));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("pageTitles.dashboard")}</h1>
        <p className="text-muted-foreground">{t("settings.systemSettings")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            {t("notifications.title")}
          </CardTitle>
          <CardDescription>
            {t("notifications.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isSupported ? (
            <div className="flex items-center gap-3 p-4 bg-destructive/10 text-destructive rounded-lg">
              <XCircle className="w-5 h-5 flex-shrink-0" />
              <p>{t('notifications.notSupported')}</p>
            </div>
          ) : (
            <>
              {/* Permission Status */}
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3">
                  {isSubscribed ? (
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  ) : permission === 'denied' ? (
                    <XCircle className="w-5 h-5 text-destructive" />
                  ) : (
                    <BellOff className="w-5 h-5 text-muted-foreground" />
                  )}
                  <div>
                    <p className="font-medium">
                      {isSubscribed 
                        ? t('notifications.active') 
                        : permission === 'denied' 
                          ? t('notifications.blocked')
                          : t('notifications.off')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isSubscribed 
                        ? t('notifications.activeDesc')
                        : permission === 'denied'
                          ? t('notifications.blockedDesc')
                          : t('notifications.offDesc')}
                    </p>
                  </div>
                </div>
                <Switch
                  checked={isSubscribed}
                  onCheckedChange={handleToggleNotifications}
                  disabled={permission === 'denied'}
                />
              </div>

              {/* Test Notification */}
              {isSubscribed && (
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">{t("notifications.test")}</Label>
                    <p className="text-sm text-muted-foreground">{t("notifications.testDesc")}</p>
                  </div>
                  <Button 
                    variant="outline" 
                    onClick={sendTestNotification}
                    disabled={testing}
                  >
                    {testing ? (
                      <>
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        {t("notifications.sending")}
                      </>
                    ) : (
                      <>
                        <Bell className="w-4 h-4 ml-2" />
                        {t("notifications.sendTest")}
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Instructions for denied permission */}
              {permission === 'denied' && (
                <div className="p-4 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg">
                  <p className="font-medium mb-2">{t("notifications.blockedDesc")}:</p>
                  <ol className="text-sm space-y-1 list-decimal list-inside">
                    <li>1. Click the lock/info icon in the address bar</li>
                    <li>2. Find "Notifications"</li>
                    <li>3. Change to "Allow"</li>
                    <li>4. Refresh the page</li>
                  </ol>
                </div>
              )}

              {/* Debug Panel */}
              <div className="border-t pt-4">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setShowDebug(!showDebug)}
                  className="text-muted-foreground"
                >
                  <Bug className="w-4 h-4 ml-2" />
                  {showDebug ? t("common.cancel") : "Debug"}
                </Button>
                
                {showDebug && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs space-y-1 p-3 bg-muted/30 rounded">
                      <p><strong>{t("common.status")}:</strong></p>
                      <p>• Permission: {permission}</p>
                      <p>• Supported: {isSupported ? t('common.yes') : t('common.no')}</p>
                      <p>• Granted: {isGranted ? t('common.yes') : t('common.no')}</p>
                      <p>• Subscribed: {isSubscribed ? t('common.yes') : t('common.no')}</p>
                      <p>• User: {user?.id?.substring(0, 8) || t('common.notSpecified')}...</p>
                    </div>
                    
                    {debugLogs.length > 0 && (
                      <ScrollArea className="h-48 rounded border bg-black/90 p-2">
                        <div className="text-xs font-mono text-green-400 space-y-1">
                          {debugLogs.map((log, i) => (
                            <div key={i} className="break-all">{log}</div>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                    
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setDebugLogs([])}
                      >
                        {t("common.delete")}
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={checkDatabaseSubscription}
                      >
                        DB
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={forceResubscribe}
                        disabled={testing}
                      >
                        {t("auth.signupButton")}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
