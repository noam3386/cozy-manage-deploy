import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { useAppStore } from '@/store/appStore';
import { Building2, Loader2, Mail, Lock, User, Eye, EyeOff, Phone, KeyRound } from 'lucide-react';
import { useTranslation } from 'react-i18next';

// *** קוד הגישה לנותני שירות — שנה אותו למשהו שרק אתה יודע ***
const VENDOR_ACCESS_CODE = 'VENDOR2025';

const Auth = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const setAppRole = useAppStore((s) => s.setRole);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  // Vendor signup
  const [vendorCode, setVendorCode] = useState('');
  const [isVendorSignup, setIsVendorSignup] = useState(false);
  const [vendorCodeError, setVendorCodeError] = useState(false);

  const redirectBasedOnRole = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    const roles = error ? [] : (data ?? []).map((r) => r.role as string);

    if (roles.includes('vendor')) {
      setAppRole('vendor' as any);
      navigate('/vendor', { replace: true });
    } else if (roles.includes('admin') || roles.includes('manager')) {
      setAppRole('manager');
      navigate('/manager', { replace: true });
    } else {
      setAppRole('owner');
      navigate('/owner', { replace: true });
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setTimeout(() => {
          redirectBasedOnRole(session.user.id);
        }, 0);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        redirectBasedOnRole(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, setAppRole]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      toast({
        title: t('auth.loginError'),
        description: error.message === 'Invalid login credentials'
          ? t('auth.invalidCredentials')
          : error.message,
        variant: 'destructive',
      });
    }

    setLoading(false);
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth`,
    });

    if (error) {
      toast({ title: t('common.error'), description: error.message, variant: 'destructive' });
    } else {
      toast({ title: t('auth.resetSent'), description: t('auth.resetSentDesc') });
      setResetMode(false);
      setResetEmail('');
    }

    setLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: t('common.error'), description: t('auth.passwordMismatch'), variant: 'destructive' });
      return;
    }

    // Validate vendor code if vendor signup
    if (isVendorSignup) {
      if (vendorCode.trim().toUpperCase() !== VENDOR_ACCESS_CODE) {
        setVendorCodeError(true);
        toast({ title: 'קוד שגוי', description: 'קוד הגישה לנותני שירות אינו נכון', variant: 'destructive' });
        return;
      }
      setVendorCodeError(false);
    }

    setLoading(true);

    const role = isVendorSignup ? 'vendor' : 'owner';
    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { full_name: fullName, role, phone },
      },
    });

    if (error) {
      let errorMessage = error.message;
      if (error.message.includes('already registered')) {
        errorMessage = t('auth.alreadyRegistered');
      }
      toast({ title: t('auth.signupError'), description: errorMessage, variant: 'destructive' });
    } else {
      // If vendor, insert role immediately (no email confirmation needed)
      if (isVendorSignup && data.user) {
        await supabase.from('user_roles').insert({ user_id: data.user.id, role: 'vendor' as any });
      }
      toast({ title: t('auth.signupSuccess'), description: t('auth.signupSuccessDesc') });
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md shadow-xl border-border/50">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Building2 className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">{t('auth.title')}</CardTitle>
          <CardDescription>{t('auth.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="login">{t('auth.login')}</TabsTrigger>
              <TabsTrigger value="signup">{t('auth.signup')}</TabsTrigger>
            </TabsList>

            {/* LOGIN TAB */}
            <TabsContent value="login">
              {resetMode ? (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">{t('auth.email')}</Label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="reset-email" type="email" placeholder="your@email.com"
                        value={resetEmail} onChange={(e) => setResetEmail(e.target.value)}
                        className="pr-10" required dir="ltr" />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                    {t('auth.resetPassword')}
                  </Button>
                  <Button type="button" variant="ghost" className="w-full" onClick={() => setResetMode(false)}>
                    {t('auth.backToLogin')}
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">{t('auth.email')}</Label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="login-email" type="email" placeholder="your@email.com"
                        value={email} onChange={(e) => setEmail(e.target.value)}
                        className="pr-10" required dir="ltr" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="login-password">{t('auth.password')}</Label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                        value={password} onChange={(e) => setPassword(e.target.value)}
                        className="pr-10 pl-10" required dir="ltr" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-3 text-muted-foreground hover:text-foreground transition-colors">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                    {t('auth.loginButton')}
                  </Button>
                  <button type="button" className="w-full text-sm text-primary hover:underline"
                    onClick={() => setResetMode(true)}>
                    {t('auth.forgotPassword')}
                  </button>
                </form>
              )}
            </TabsContent>

            {/* SIGNUP TAB */}
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4">

                {/* Toggle: owner / vendor */}
                <div className="flex rounded-lg border overflow-hidden text-sm">
                  <button type="button"
                    onClick={() => setIsVendorSignup(false)}
                    className={`flex-1 py-2 text-center transition-colors ${!isVendorSignup ? 'bg-primary text-primary-foreground font-semibold' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                    בעל נכס / מנהל
                  </button>
                  <button type="button"
                    onClick={() => setIsVendorSignup(true)}
                    className={`flex-1 py-2 text-center transition-colors ${isVendorSignup ? 'bg-primary text-primary-foreground font-semibold' : 'bg-background text-muted-foreground hover:bg-muted'}`}>
                    נותן שירות
                  </button>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-name">{t('auth.fullName')}</Label>
                  <div className="relative">
                    <User className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="signup-name" type="text" placeholder={t('auth.namePlaceholder')}
                      value={fullName} onChange={(e) => setFullName(e.target.value)}
                      className="pr-10" required />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-phone">{t('auth.phone')}</Label>
                  <div className="relative">
                    <Phone className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="signup-phone" type="tel" placeholder={t('auth.phonePlaceholder')}
                      value={phone} onChange={(e) => setPhone(e.target.value)}
                      className="pr-10" dir="ltr" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-email">{t('auth.email')}</Label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="signup-email" type="email" placeholder="your@email.com"
                      value={email} onChange={(e) => setEmail(e.target.value)}
                      className="pr-10" required dir="ltr" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-password">{t('auth.password')}</Label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="signup-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      className="pr-10 pl-10" required minLength={6} dir="ltr" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-3 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-confirm-password">{t('auth.confirmPassword')}</Label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input id="signup-confirm-password" type={showPassword ? 'text' : 'password'} placeholder="••••••••"
                      value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pr-10 pl-10" required minLength={6} dir="ltr" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-3 top-3 text-muted-foreground hover:text-foreground transition-colors">
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword && password !== confirmPassword && (
                    <p className="text-sm text-destructive">{t('auth.passwordMismatch')}</p>
                  )}
                </div>

                {/* Vendor access code field */}
                {isVendorSignup && (
                  <div className="space-y-2">
                    <Label htmlFor="vendor-code">קוד גישה לנותני שירות</Label>
                    <div className="relative">
                      <KeyRound className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input id="vendor-code" type="text" placeholder="קוד שקיבלת מהמנהל"
                        value={vendorCode} onChange={(e) => { setVendorCode(e.target.value); setVendorCodeError(false); }}
                        className={`pr-10 ${vendorCodeError ? 'border-destructive' : ''}`}
                        required dir="ltr" />
                    </div>
                    {vendorCodeError && <p className="text-xs text-destructive">קוד הגישה שגוי</p>}
                  </div>
                )}

                <Button type="submit" className="w-full"
                  disabled={loading || (confirmPassword !== '' && password !== confirmPassword)}>
                  {loading && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                  {t('auth.signupButton')}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
