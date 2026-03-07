import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Plus, User, Mail, Phone, Building2, Edit, Trash2, Search, Link2, Send, Copy, Check, MessageCircle, Archive, ArchiveRestore, Eye, EyeOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Property {
  id: string;
  name: string;
  address: string;
  owner_id: string | null;
}

interface Owner {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  properties: Property[];
  archived?: boolean;
  archived_at?: string | null;
}

export default function ManagerOwners() {
  const { t } = useTranslation();
  const [owners, setOwners] = useState<Owner[]>([]);
  const [archivedOwners, setArchivedOwners] = useState<Owner[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [editingOwner, setEditingOwner] = useState<Owner | null>(null);
  const [ownerToArchive, setOwnerToArchive] = useState<Owner | null>(null);
  const [ownerToRestore, setOwnerToRestore] = useState<Owner | null>(null);
  const [archivePassword, setArchivePassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [assigningOwner, setAssigningOwner] = useState<Owner | null>(null);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [inviteLink, setInviteLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('active');
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch active owner profiles
      const { data: activeProfilesData, error: activeProfilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, archived, archived_at')
        .eq('role', 'owner')
        .eq('archived', false)
        .order('full_name');

      if (activeProfilesError) throw activeProfilesError;

      // Fetch archived owner profiles
      const { data: archivedProfilesData, error: archivedProfilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, archived, archived_at')
        .eq('role', 'owner')
        .eq('archived', true)
        .order('archived_at', { ascending: false });

      if (archivedProfilesError) throw archivedProfilesError;

      // Fetch all properties
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select('id, name, address, owner_id');

      if (propertiesError) throw propertiesError;

      setProperties(propertiesData || []);

      // Map properties to active owners
      const activeOwnersWithProperties = (activeProfilesData || []).map(profile => ({
        ...profile,
        properties: (propertiesData || []).filter(p => p.owner_id === profile.id)
      }));

      // Map properties to archived owners
      const archivedOwnersWithProperties = (archivedProfilesData || []).map(profile => ({
        ...profile,
        properties: (propertiesData || []).filter(p => p.owner_id === profile.id)
      }));

      setOwners(activeOwnersWithProperties);
      setArchivedOwners(archivedOwnersWithProperties);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingOwner) {
        // Update existing owner
        const { error } = await supabase
          .from('profiles')
          .update({
            full_name: formData.full_name || null,
            email: formData.email || null,
            phone: formData.phone || null
          })
          .eq('id', editingOwner.id);
        
        if (error) throw error;
        toast.success(t('owners.ownerUpdated'));
        setIsDialogOpen(false);
        resetForm();
        fetchData();
      } else {
        // Create invitation flow - generate invite link
        const baseUrl = window.location.origin;
        const inviteToken = btoa(JSON.stringify({
          email: formData.email,
          full_name: formData.full_name,
          phone: formData.phone,
          created_at: new Date().toISOString()
        }));
        const generatedLink = `${baseUrl}/auth?invite=${inviteToken}`;
        setInviteLink(generatedLink);
        setIsDialogOpen(false);
        setIsInviteDialogOpen(true);
      }
    } catch (error: any) {
      console.error('Error saving owner:', error);
      toast.error(t('owners.ownerSaveError'));
    }
  };

  const handleSendInvite = async () => {
    // For now, we'll create the user with a temporary password and show the invite link
    try {
      // Generate cryptographically secure temporary password
      const generateSecurePassword = () => {
        const array = new Uint8Array(16);
        crypto.getRandomValues(array);
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let password = '';
        for (let i = 0; i < 12; i++) {
          password += chars[array[i] % chars.length];
        }
        return password + 'A1!';
      };
      
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: generateSecurePassword(),
        options: {
          data: {
            full_name: formData.full_name,
            role: 'owner'
          },
          emailRedirectTo: `${window.location.origin}/auth`
        }
      });
      
      if (authError) throw authError;

      // Update phone if provided
      if (authData.user && formData.phone) {
        await supabase
          .from('profiles')
          .update({ phone: formData.phone })
          .eq('id', authData.user.id);
      }
      
      toast.success(t('owners.inviteSent'));
      setIsInviteDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      console.error('Error sending invite:', error);
      if (error.message?.includes('already registered')) {
        toast.error(t('owners.emailAlreadyExists'));
      } else {
        toast.error(t('owners.inviteError'));
      }
    }
  };

  const copyInviteLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      toast.success(t('owners.linkCopied'));
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      toast.error(t('owners.linkCopyError'));
    }
  };

  const sendWhatsApp = () => {
    const message = encodeURIComponent(`${t('owners.sendInviteDesc')}${formData.full_name || ''},\n\n${t('owners.inviteLink')}\n${inviteLink}`);
    const phone = formData.phone?.replace(/\D/g, '');
    const whatsappUrl = phone 
      ? `https://wa.me/${phone.startsWith('0') ? '972' + phone.slice(1) : phone}?text=${message}`
      : `https://wa.me/?text=${message}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleAssignProperties = async () => {
    if (!assigningOwner) return;
    
    try {
      const currentPropertyIds = assigningOwner.properties.map(p => p.id);
      const toRemove = currentPropertyIds.filter(id => !selectedPropertyIds.includes(id));
      const toAdd = selectedPropertyIds.filter(id => !currentPropertyIds.includes(id));

      if (toRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('properties')
          .update({ owner_id: null })
          .in('id', toRemove);
        
        if (removeError) throw removeError;
      }

      if (toAdd.length > 0) {
        const { error: addError } = await supabase
          .from('properties')
          .update({ owner_id: assigningOwner.id })
          .in('id', toAdd);
        
        if (addError) throw addError;
      }

      toast.success(t('owners.propertiesUpdated'));
      setIsAssignDialogOpen(false);
      setAssigningOwner(null);
      setSelectedPropertyIds([]);
      fetchData();
    } catch (error) {
      console.error('Error assigning properties:', error);
      toast.error(t('owners.propertiesUpdateError'));
    }
  };

  const handleArchive = async () => {
    if (!ownerToArchive) return;
    
    // Verify password by attempting to re-authenticate
    setArchiveLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error(t('common.error'));
        setArchiveLoading(false);
        return;
      }

      // Verify password by signing in
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: archivePassword
      });

      if (authError) {
        toast.error(t('owners.wrongPassword'));
        setArchiveLoading(false);
        return;
      }

      // Disconnect properties from the owner
      await supabase
        .from('properties')
        .update({ owner_id: null })
        .eq('owner_id', ownerToArchive.id);

      // Archive the owner (soft delete)
      const { error } = await supabase
        .from('profiles')
        .update({ 
          archived: true, 
          archived_at: new Date().toISOString() 
        })
        .eq('id', ownerToArchive.id);
      
      if (error) throw error;
      toast.success(t('owners.archived'));
      setOwnerToArchive(null);
      setArchivePassword('');
      fetchData();
    } catch (error) {
      console.error('Error archiving owner:', error);
      toast.error(t('owners.archiveError'));
    } finally {
      setArchiveLoading(false);
    }
  };

  const handleRestore = async () => {
    if (!ownerToRestore) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          archived: false, 
          archived_at: null 
        })
        .eq('id', ownerToRestore.id);
      
      if (error) throw error;
      toast.success(t('owners.restored'));
      setOwnerToRestore(null);
      fetchData();
    } catch (error) {
      console.error('Error restoring owner:', error);
      toast.error(t('owners.restoreError'));
    }
  };

  const handleEdit = (owner: Owner) => {
    setEditingOwner(owner);
    setFormData({
      full_name: owner.full_name || '',
      email: owner.email || '',
      phone: owner.phone || ''
    });
    setIsDialogOpen(true);
  };

  const openAssignDialog = (owner: Owner) => {
    setAssigningOwner(owner);
    setSelectedPropertyIds(owner.properties.map(p => p.id));
    setIsAssignDialogOpen(true);
  };

  const resetForm = () => {
    setEditingOwner(null);
    setFormData({
      full_name: '',
      email: '',
      phone: ''
    });
    setInviteLink('');
    setLinkCopied(false);
  };

  const filteredOwners = owners.filter(o => 
    o.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.phone?.includes(searchQuery)
  );

  const filteredArchivedOwners = archivedOwners.filter(o => 
    o.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    o.phone?.includes(searchQuery)
  );

  const getAvailableProperties = () => {
    if (!assigningOwner) return properties;
    return properties.filter(p => 
      p.owner_id === null || p.owner_id === assigningOwner.id
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("owners.searchOwners")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 ml-2" />
              {t("owners.newOwner")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingOwner ? t('owners.editOwner') : t('owners.addOwner')}</DialogTitle>
              {!editingOwner && (
                <DialogDescription>
                  {t("owners.addOwnerDesc")}
                </DialogDescription>
              )}
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">{t('owners.fullName')} *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">{t('owners.email')} *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  required
                  disabled={!!editingOwner}
                />
                {editingOwner && (
                  <p className="text-xs text-muted-foreground">{t('owners.emailReadonly')}</p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="phone">{t('owners.phone')}</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="05X-XXXXXXX"
                />
              </div>
              
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit">
                  {editingOwner ? t('common.update') : t('owners.continueToInvite')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Invite Dialog */}
      <Dialog open={isInviteDialogOpen} onOpenChange={(open) => {
        setIsInviteDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('owners.sendInvite')}</DialogTitle>
            <DialogDescription>
              {t('owners.sendInviteDesc')}{formData.full_name || ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm font-medium mb-2">{t('owners.ownerDetails')}</p>
              <p className="text-sm text-muted-foreground">{formData.full_name}</p>
              <p className="text-sm text-muted-foreground">{formData.email}</p>
              {formData.phone && <p className="text-sm text-muted-foreground">{formData.phone}</p>}
            </div>

            <div className="space-y-3">
              <Button onClick={handleSendInvite} className="w-full" variant="default">
                <Send className="h-4 w-4 ml-2" />
                {t("owners.sendViaEmail")}
              </Button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or</span>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={copyInviteLink} variant="outline" className="flex-1">
                  {linkCopied ? <Check className="h-4 w-4 ml-2" /> : <Copy className="h-4 w-4 ml-2" />}
                  {linkCopied ? t('owners.copied') : t('owners.copyLink')}
                </Button>
                <Button onClick={sendWhatsApp} variant="outline" className="flex-1 text-green-600 border-green-600 hover:bg-green-50">
                  {t("owners.sendViaWhatsApp")}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Properties Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={(open) => {
        setIsAssignDialogOpen(open);
        if (!open) {
          setAssigningOwner(null);
          setSelectedPropertyIds([]);
        }
      }}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('owners.assignProperties')} {assigningOwner?.full_name || ''}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {getAvailableProperties().length === 0 ? (
              <p className="text-muted-foreground text-center py-4">{t('owners.noProperties')}</p>
            ) : (
              <div className="space-y-2">
                {getAvailableProperties().map((property) => (
                  <label
                    key={property.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={selectedPropertyIds.includes(property.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedPropertyIds(prev => [...prev, property.id]);
                        } else {
                          setSelectedPropertyIds(prev => prev.filter(id => id !== property.id));
                        }
                      }}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{property.name}</p>
                      <p className="text-sm text-muted-foreground">{property.address}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button onClick={handleAssignProperties}>
                {t("owners.saveAssignment")}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog with Password */}
      <AlertDialog open={!!ownerToArchive} onOpenChange={(open) => {
        if (!open) {
          setOwnerToArchive(null);
          setArchivePassword('');
          setShowPassword(false);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('owners.archiveConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("owners.archiveDesc")}
              <br /><br />
              <strong>{t("owners.enterPassword")}</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={archivePassword}
                onChange={(e) => setArchivePassword(e.target.value)}
                placeholder={t("owners.enterPassword")}
                className="pl-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="iconSm"
                className="absolute left-2 top-1/2 -translate-y-1/2"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <Button
              onClick={handleArchive}
              disabled={!archivePassword || archiveLoading}
              variant="destructive"
            >
              {archiveLoading ? t('common.loading') : t('owners.archiveOwner')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Restore Confirmation Dialog */}
      <AlertDialog open={!!ownerToRestore} onOpenChange={(open) => !open && setOwnerToRestore(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('owners.restoreConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("owners.restoreDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>
              {t("owners.restore")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-xs grid-cols-2">
          <TabsTrigger value="active">{t('owners.activeTab')} ({owners.length})</TabsTrigger>
          <TabsTrigger value="archived">{t('owners.archivedTab')} ({archivedOwners.length})</TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="mt-4">
          {filteredOwners.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {searchQuery ? t('owners.noProperties') : t('owners.noProperties')}
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredOwners.map((owner) => (
                <Card key={owner.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{owner.full_name || t('common.notSpecified')}</CardTitle>
                          {owner.properties.length > 0 && (
                            <p className="text-sm text-muted-foreground">
                              {owner.properties.length} {t("nav.serviceRequests")}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="iconSm" onClick={() => openAssignDialog(owner)} title={t("owners.assignProperties")}>
                          <Link2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="iconSm" onClick={() => handleEdit(owner)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="iconSm" onClick={() => setOwnerToArchive(owner)} title={t("owners.archiveOwner")}>
                          <Archive className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {owner.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${owner.email}`} className="hover:text-primary truncate">{owner.email}</a>
                      </div>
                    )}
                    {owner.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${owner.phone}`} className="hover:text-primary">{owner.phone}</a>
                        <Button
                          variant="ghost"
                          size="iconSm"
                          className="h-6 w-6 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                          onClick={() => {
                            const phoneNum = owner.phone?.replace(/\D/g, '');
                            const whatsappUrl = phoneNum 
                              ? `https://wa.me/${phoneNum.startsWith('0') ? '972' + phoneNum.slice(1) : phoneNum}`
                              : '';
                            if (whatsappUrl) window.open(whatsappUrl, '_blank');
                          }}
                          title={t("common.sendWhatsApp")}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {owner.properties.length > 0 && (
                      <div className="pt-2 border-t mt-3">
                        <div className="flex flex-wrap gap-1">
                          {owner.properties.slice(0, 3).map((property) => (
                            <Badge key={property.id} variant="secondary" className="text-xs">
                              <Building2 className="h-3 w-3 ml-1" />
                              {property.name}
                            </Badge>
                          ))}
                          {owner.properties.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{owner.properties.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="archived" className="mt-4">
          {filteredArchivedOwners.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                {searchQuery ? t('owners.noProperties') : t('owners.noProperties')}
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredArchivedOwners.map((owner) => (
                <Card key={owner.id} className="hover:shadow-md transition-shadow opacity-75">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                          <User className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">{owner.full_name || t('common.notSpecified')}</CardTitle>
                          {owner.archived_at && (
                            <p className="text-xs text-muted-foreground">
                              {t('owners.archivedOn')} {new Date(owner.archived_at).toLocaleDateString('he-IL')}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="iconSm" onClick={() => setOwnerToRestore(owner)} title={t("owners.restore")}>
                        <ArchiveRestore className="h-4 w-4 text-primary" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {owner.email && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="h-4 w-4" />
                        <span className="truncate">{owner.email}</span>
                      </div>
                    )}
                    {owner.phone && (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="h-4 w-4" />
                        <span>{owner.phone}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
