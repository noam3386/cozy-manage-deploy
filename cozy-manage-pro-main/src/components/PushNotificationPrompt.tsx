import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useUserRole } from '@/hooks/useUserRole';

export function PushNotificationPrompt() {
  const { t } = useTranslation();
  const { permission, requestPermission, isSupported } = usePushNotifications();
  const { role } = useUserRole();
  const [dismissed, setDismissed] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    // Only show for managers who haven't granted permission yet
    const wasDissmissed = localStorage.getItem('push-notification-dismissed');
    if (
      isSupported &&
      permission === 'default' &&
      (role === 'manager' || role === 'admin') &&
      !wasDissmissed
    ) {
      // Show after a short delay
      const timeout = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timeout);
    }
  }, [isSupported, permission, role]);

  const handleAllow = async () => {
    await requestPermission();
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('push-notification-dismissed', 'true');
    setDismissed(true);
    setShowPrompt(false);
  };

  if (!showPrompt || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
            <Bell className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground mb-1">{t("notifications.title")}</h3>
            <p className="text-sm text-muted-foreground mb-3">
              {t("notifications.description")}
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAllow}>
                {t("notifications.sendTest")}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleDismiss}>
                {t("common.cancel")}
              </Button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
