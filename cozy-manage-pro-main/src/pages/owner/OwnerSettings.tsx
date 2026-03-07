import { Bell, BellOff, Loader2, CheckCircle, XCircle, Bug, User, Phone, Mail, Globe } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '@/components/LanguageSelector';

interface UserProfile {
  full_name: string | null;
  phone: string | null;
  email: string | null;
}

export default function OwnerSettings() {
  const { t } = useTranslation();
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  
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

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, phone, email')
        .eq('id', user.id)
        .single();
      if (data) {
        setProfile(data);
        setEditName(data.full_name || '');
        setEditPhone(data.phone || '');
      }
    };
    fetchProfile();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: editName, phone: editPhone })
        .eq('id', user.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, full_name: editName, phone: editPhone } : null);
      toast.success(t('settings.profileUpdated'));
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(t('settings.profileError'));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleToggleNotifications = async () => {
    addLog('Toggle notifications...');
    if (isSubscribed) {
      const success = await unsubscribe();
      if (success) {
        toast.success(t('notifications.disabled'));
      } else {
        toast.error('Error');
      }
    } else {
      const success = await requestPermission();
      if (success) {
        toast.success(t('notifications.enabled'));
      } else if (permission === 'denied') {
        toast.error(t('notifications.blockedDesc'));
      }
    }
  };

  const checkDatabaseSubscription = async () => {
    addLog('Checking DB subscriptions...');
    if (!user) { addLog('❌ No user'); return; }
    try {
      const { data, error } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', user.id);
      if (error) { addLog(`❌ DB error: ${error.message}`); }
      else if (!data || data.length === 0) { addLog('⚠️ No subscriptions found'); }
      else { addLog(`✅ Found ${data.length} subscriptions`); }
    } catch (err) { addLog(`❌ Exception: ${err}`); }
  };

  const forceResubscribe = async () => {
    if (!user) return;
    setTesting(true);
    try {
      await unsubscribe();
      await new Promise(r => setTimeout(r, 500));
      const success = await subscribeToWebPush();
      if (success) { await checkDatabaseSubscription(); toast.success('Re-subscribed'); }
      else { toast.error('Re-subscribe failed'); }
    } catch (err) { toast.error('Error'); }
    finally { setTesting(false); }
  };

  const sendTestNotification = async () => {
    if (!user) { toast.error('Not logged in'); return; }
    setTesting(true);
    try {
      if (Notification.permission === 'granted') {
        const registration = await navigator.serviceWorker.ready;
        await registration.showNotification('Test 🔔', {
          body: 'Local test notification',
          icon: '/pwa-192x192.png',
          badge: '/pwa-192x192.png',
          tag: 'local-test'
        });
      }
      toast.success('Test notification sent');
    } catch (err) { toast.error('Error sending notification'); }
    finally { setTesting(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
        <p className="text-muted-foreground">{t('settings.subtitle')}</p>
      </div>

      {/* Language Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            {t('settings.languageTitle')}
          </CardTitle>
          <CardDescription>{t('settings.languageDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <LanguageSelector />
        </CardContent>
      </Card>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            {t('settings.profileTitle')}
          </CardTitle>
          <CardDescription>{t('settings.profileDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t('settings.fullName')}</Label>
            <div className="relative">
              <User className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="name" value={editName} onChange={(e) => setEditName(e.target.value)} className="pr-10" placeholder={t('settings.enterFullName')} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{t('settings.phone')}</Label>
            <div className="relative">
              <Phone className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input id="phone" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} className="pr-10" placeholder={t('settings.enterPhone')} dir="ltr" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t('settings.email')}</Label>
            <div className="relative">
              <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input value={profile?.email || user?.email || ''} className="pr-10 bg-muted" disabled dir="ltr" />
            </div>
            <p className="text-xs text-muted-foreground">{t('settings.emailReadonly')}</p>
          </div>
          <Button onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile ? (<><Loader2 className="w-4 h-4 ml-2 animate-spin" />{t('settings.saving')}</>) : t('settings.saveChanges')}
          </Button>
        </CardContent>
      </Card>

      {/* Push Notifications Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            {t('notifications.title')}
          </CardTitle>
          <CardDescription>{t('notifications.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isSupported ? (
            <div className="flex items-center gap-3 p-4 bg-destructive/10 text-destructive rounded-lg">
              <XCircle className="w-5 h-5 flex-shrink-0" />
              <p>{t('notifications.notSupported')}</p>
            </div>
          ) : (
            <>
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
                      {isSubscribed ? t('notifications.active') : permission === 'denied' ? t('notifications.blocked') : t('notifications.off')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {isSubscribed ? t('notifications.activeDesc') : permission === 'denied' ? t('notifications.blockedDesc') : t('notifications.offDesc')}
                    </p>
                  </div>
                </div>
                <Switch checked={isSubscribed} onCheckedChange={handleToggleNotifications} disabled={permission === 'denied'} />
              </div>

              {isSubscribed && (
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base">{t('notifications.test')}</Label>
                    <p className="text-sm text-muted-foreground">{t('notifications.testDesc')}</p>
                  </div>
                  <Button variant="outline" onClick={sendTestNotification} disabled={testing}>
                    {testing ? (<><Loader2 className="w-4 h-4 ml-2 animate-spin" />{t('notifications.sending')}</>) : (<><Bell className="w-4 h-4 ml-2" />{t('notifications.sendTest')}</>)}
                  </Button>
                </div>
              )}

              {/* Debug Panel */}
              <div className="border-t pt-4">
                <Button variant="ghost" size="sm" onClick={() => setShowDebug(!showDebug)} className="text-muted-foreground">
                  <Bug className="w-4 h-4 ml-2" />
                  {showDebug ? 'Hide Logs' : 'Show Logs'}
                </Button>
                
                {showDebug && (
                  <div className="mt-3 space-y-2">
                    <div className="text-xs space-y-1 p-3 bg-muted/30 rounded">
                      <p><strong>Status:</strong></p>
                      <p>• Permission: {permission}</p>
                      <p>• Supported: {isSupported ? 'Yes' : 'No'}</p>
                      <p>• Granted: {isGranted ? 'Yes' : 'No'}</p>
                      <p>• Subscribed: {isSubscribed ? 'Yes' : 'No'}</p>
                      <p>• User: {user?.id?.substring(0, 8) || 'N/A'}...</p>
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
                      <Button variant="outline" size="sm" onClick={() => setDebugLogs([])}>Clear</Button>
                      <Button variant="outline" size="sm" onClick={checkDatabaseSubscription}>Check DB</Button>
                      <Button variant="outline" size="sm" onClick={forceResubscribe} disabled={testing}>Re-subscribe</Button>
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