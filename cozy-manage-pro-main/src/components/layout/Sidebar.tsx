import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Building2,
  Calendar,
  Wrench,
  AlertTriangle,
  CreditCard,
  MessageSquare,
  LayoutDashboard,
  Inbox,
  ClipboardList,
  Users,
  Settings,
  LogOut,
  ChevronLeft,
  User,
  Phone,
  Mail,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/appStore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { useUserRole } from '@/hooks/useUserRole';
import { useInboxCount } from '@/hooks/useInboxCount';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface UserProfile {
  full_name: string | null;
  phone: string | null;
  email: string | null;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { role, loading: roleLoading } = useUserRole();
  const { currentRole } = useAppStore();
  const { count: inboxCount } = useInboxCount();
  const { toast } = useToast();

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const effectiveRole = !roleLoading && (role === 'manager' || role === 'admin') ? 'manager' : currentRole;
  const isManager = effectiveRole === 'manager';

  const ownerNavItems = [
    { label: t('nav.home'), href: '/owner', icon: <Home className="w-5 h-5" /> },
    { label: t('nav.myProperties'), href: '/owner/properties', icon: <Building2 className="w-5 h-5" /> },
    { label: t('nav.arrivalDeparture'), href: '/owner/arrivals', icon: <Calendar className="w-5 h-5" /> },
    { label: t('nav.services'), href: '/owner/services', icon: <Wrench className="w-5 h-5" /> },
    { label: t('nav.issues'), href: '/owner/issues', icon: <AlertTriangle className="w-5 h-5" /> },
    { label: t('nav.inspections'), href: '/owner/inspections', icon: <ClipboardList className="w-5 h-5" /> },
    { label: t('nav.payments'), href: '/owner/payments', icon: <CreditCard className="w-5 h-5" /> },
    { label: t('nav.messages'), href: '/owner/messages', icon: <MessageSquare className="w-5 h-5" /> },
    { label: t('nav.settings'), href: '/owner/settings', icon: <Settings className="w-5 h-5" /> },
  ];

  const managerNavItems = [
    { label: t('nav.dashboard'), href: '/manager', icon: <LayoutDashboard className="w-5 h-5" /> },
    { label: t('nav.owners'), href: '/manager/owners', icon: <Users className="w-5 h-5" /> },
    { label: t('nav.managedProperties'), href: '/manager/properties', icon: <Building2 className="w-5 h-5" /> },
    { label: t('nav.serviceRequests'), href: '/manager/requests', icon: <Inbox className="w-5 h-5" /> },
    { label: t('nav.messages'), href: '/manager/messages', icon: <MessageSquare className="w-5 h-5" /> },
    { label: t('nav.calendar'), href: '/manager/calendar', icon: <Calendar className="w-5 h-5" /> },
    { label: t('nav.apartmentInspections'), href: '/manager/inspections', icon: <ClipboardList className="w-5 h-5" /> },
    { label: t('nav.cleaningDates'), href: '/manager/cleaning', icon: <Wrench className="w-5 h-5" /> },
    { label: t('nav.propertyActions'), href: '/manager/actions', icon: <ClipboardList className="w-5 h-5" /> },
    { label: t('nav.vendors'), href: '/manager/vendors', icon: <Wrench className="w-5 h-5" /> },
  ];

  const navItems = effectiveRole === 'owner' ? ownerNavItems : managerNavItems;
  const roleLabel = effectiveRole === 'owner' ? t('roles.owner') : t('roles.manager');

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
    onClose();
    setTimeout(() => setEditDialogOpen(true), 100);
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

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (e) {
      // Ignore errors
    }
    navigate('/auth', { replace: true });
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-foreground/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      <aside 
        className={cn(
          "fixed top-0 right-0 h-full w-72 bg-sidebar text-sidebar-foreground z-50 transition-transform duration-300 ease-out lg:translate-x-0",
          isOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-sidebar-border">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-sidebar-primary-foreground">PropManager</h1>
                <p className="text-sm text-sidebar-foreground/70 mt-0.5">{roleLabel}</p>
              </div>
              <Button 
                variant="ghost" 
                size="iconSm"
                className="lg:hidden text-sidebar-foreground hover:bg-sidebar-accent"
                onClick={onClose}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
            </div>
          </div>
          
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const isActive = location.pathname === item.href;
              const showInboxBadge = isManager && item.href === '/manager/requests' && inboxCount > 0;
              
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={onClose}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200",
                    isActive 
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md" 
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  {item.icon}
                  <span className="font-medium flex-1">{item.label}</span>
                  {showInboxBadge && (
                    <Badge variant="destructive" className="text-xs px-2 py-0.5 min-w-[1.5rem] text-center">
                      {inboxCount}
                    </Badge>
                  )}
                </Link>
              );
            })}
          </nav>
          
          <div className="px-4 pb-2">
            <button
              onClick={openEditDialog}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-sidebar-accent/50 hover:bg-sidebar-accent transition-colors text-right"
            >
              <div className="w-10 h-10 rounded-full bg-sidebar-primary flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-sidebar-primary-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sidebar-foreground truncate">
                  {profile?.full_name || t('profile.user')}
                </p>
                <p className="text-xs text-sidebar-foreground/60 truncate">
                  {profile?.phone || t('profile.clickToEdit')}
                </p>
              </div>
            </button>
          </div>

          <div className="p-4 border-t border-sidebar-border space-y-2">
            <Link
              to={effectiveRole === 'manager' ? '/manager/settings' : '/owner/settings'}
              onClick={onClose}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
            >
              <Settings className="w-5 h-5" />
              <span className="font-medium">{t('nav.settings')}</span>
            </Link>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors w-full"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">{t('nav.signOut')}</span>
            </button>
          </div>
        </div>
      </aside>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{t('profile.editTitle')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">{t('settings.fullName')}</Label>
              <div className="relative">
                <User className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="edit-name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="pr-10"
                  placeholder={t('settings.enterFullName')}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-phone">{t('settings.phone')}</Label>
              <div className="relative">
                <Phone className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="edit-phone"
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
