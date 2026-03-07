import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Bell, BellRing, CheckCircle, XCircle, Loader2 } from 'lucide-react';

export function TestPushNotification() {
  const { permission, requestPermission, isSubscribed, subscribeToWebPush, isSupported } = usePushNotifications();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    try {
      const granted = await requestPermission();
      if (granted) {
        toast.success('התראות הופעלו בהצלחה!');
      } else {
        toast.error('ההרשאה נדחתה');
      }
    } catch (error) {
      toast.error('שגיאה בהפעלת התראות');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      const success = await subscribeToWebPush();
      if (success) {
        toast.success('נרשמת להתראות בהצלחה!');
      } else {
        toast.error('שגיאה בהרשמה');
      }
    } catch (error) {
      toast.error('שגיאה בהרשמה להתראות');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = async () => {
    if (!user) {
      toast.error('יש להתחבר תחילה');
      return;
    }

    setIsLoading(true);
    setTestResult(null);

    try {
      // Test local notification first
      if (Notification.permission === 'granted') {
        new Notification('בדיקת התראה מקומית', {
          body: 'אם אתה רואה את זה, ההתראות המקומיות עובדות!',
          icon: '/pwa-192x192.png',
          dir: 'rtl',
          lang: 'he',
        });
      }

      // Test server push notification
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          user_id: user.id,
          title: 'בדיקת Push התראה',
          body: 'אם אתה רואה את זה, Push התראות עובדות!',
          data: { test: true },
        },
      });

      console.log('Push test result:', data, error);

      if (error) {
        console.error('Push test error:', error);
        setTestResult('error');
        toast.error('שגיאה בשליחת התראה: ' + error.message);
      } else {
        setTestResult('success');
        toast.success('התראת בדיקה נשלחה!');
      }
    } catch (error) {
      console.error('Test notification error:', error);
      setTestResult('error');
      toast.error('שגיאה בבדיקת התראות');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isSupported) {
    return (
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <XCircle className="h-5 w-5 text-destructive" />
            התראות אינן נתמכות
          </CardTitle>
          <CardDescription>
            הדפדפן שלך לא תומך בהתראות Push
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          בדיקת התראות Push
        </CardTitle>
        <CardDescription>
          בדוק שהתראות Push עובדות במכשיר שלך
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2">
          <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
            <span>סטטוס הרשאה:</span>
            <span className={permission === 'granted' ? 'text-green-500' : 'text-muted-foreground'}>
              {permission === 'granted' ? 'מאושר' : permission === 'denied' ? 'נדחה' : 'לא נשאל'}
            </span>
          </div>
          <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
            <span>רישום Push:</span>
            <span className={isSubscribed ? 'text-green-500' : 'text-muted-foreground'}>
              {isSubscribed ? 'רשום' : 'לא רשום'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {permission !== 'granted' && (
            <Button onClick={handleEnableNotifications} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Bell className="h-4 w-4 mr-2" />}
              הפעל התראות
            </Button>
          )}
          
          {permission === 'granted' && !isSubscribed && (
            <Button onClick={handleSubscribe} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <BellRing className="h-4 w-4 mr-2" />}
              הירשם להתראות Push
            </Button>
          )}
          
          {permission === 'granted' && (
            <Button 
              variant={testResult === 'success' ? 'default' : testResult === 'error' ? 'destructive' : 'outline'} 
              onClick={handleTestNotification} 
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : testResult === 'success' ? (
                <CheckCircle className="h-4 w-4 mr-2" />
              ) : testResult === 'error' ? (
                <XCircle className="h-4 w-4 mr-2" />
              ) : (
                <BellRing className="h-4 w-4 mr-2" />
              )}
              שלח התראת בדיקה
            </Button>
          )}
        </div>

        {testResult === 'success' && (
          <p className="text-sm text-green-500 text-center">
            ✓ ההתראה נשלחה בהצלחה! בדוק אם קיבלת אותה.
          </p>
        )}
        {testResult === 'error' && (
          <p className="text-sm text-destructive text-center">
            ✗ אירעה שגיאה. בדוק את הקונסול לפרטים נוספים.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
