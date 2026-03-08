import { useState, useEffect } from 'react';
import { Menu, Bell, User, Phone, Mail } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useInboxCount } from '@/hooks/useInboxCount';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import { LanguageSelector } from '@/components/LanguageSelector';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface HeaderProps {
  onMenuClick: () => void;
  title?: string;
}

interface UserProfile {
  full_name: string | null;
  phone: string | null;
  email: string | null;
}

export function Header({ onMenuClick, title }: HeaderProps) {
  const { t } = useTranslation();
  const { count } = useInboxCount();
  const { user } = useAuth();
  const { role } = useUserRole();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const effectiveRole = role === 'manager' || role === 'admin' ? 'manager' : 'owner';

  // Fetch user profile
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
      }
    };
    fetchProfile();
  }, [user]);

  const openEditDialog = () => {
    setEditName(profile?.full_name || '');
    setEditPhone(profile?.phone || '');
    setEditDialogOpen(true);
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: editName, phone: editPhone })
        .eq('id', user.id);

      if (error) throw error;

      setProfile(prev => prev ? { ...prev, full_name: editName, phone: editPhone } : null);
      setEditDialogOpen(false);
      toast({ title: t('settings.profileUpdated') });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({ title: t('settings.profileError'), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const getInitial = () => {
    if (profile?.full_name) return profile.full_name.charAt(0).toUpperCase();
    if (user?.email) return user.email.charAt(0).toUpperCase();
    return 'U';
  };
  
  return (
    <>
      <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between h-16 px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon" 
              className="lg:hidden"
              onClick={onMenuClick}
            >
              <Menu className="w-5 h-5" />
            </Button>
            {title && (
              <h1 className="text-xl font-semibold text-foreground">{title}</h1>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <LanguageSelector />
            <Link to={effectiveRole === 'manager' ? '/manager/requests' : '/owner/messages'}>
              <Button variant="ghost" size="icon" className="relative">
                <Bell className="w-5 h-5" />
                {count > 0 && (
                  <Badge 
                    variant="destructive" 
                    className="absolute -top-1 -right-1 w-5 h-5 p-0 flex items-center justify-center text-[10px]"
                  >
                    {count > 9 ? '9+' : count}
                  </Badge>
                )}
              </Button>
            </Link>
            
            <button
              onClick={openEditDialog}
              className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-medium hover:bg-primary/90 transition-colors cursor-pointer"
            >
              {getInitial()}
            </button>
          </div>
        </div>
      </header>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{t('profile.editTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="header-edit-name">{t('settings.fullName')}</Label>
              <div className="relative">
                <User className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="header-edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="pr-10"
                  placeholder={t('settings.enterFullName')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="header-edit-phone">{t('settings.phone')}</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="header-edit-phone"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="pr-10"
                  placeholder={t('settings.enterPhone')}
                  dir="ltr"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('settings.email')}</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  value={profile?.email || user?.email || ''}
                  className="pr-10 bg-muted"
                  disabled
                  dir="ltr"
                />
              </div>
              <p className="text-xs text-muted-foreground">{t('settings.emailReadonly')}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveProfile} disabled={saving} className="flex-1">
              {saving ? t('settings.saving') : t('profile.save')}
            </Button>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              {t('profile.cancel')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
