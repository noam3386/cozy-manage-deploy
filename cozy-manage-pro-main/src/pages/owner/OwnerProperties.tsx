import { useEffect, useState } from 'react';
import { PropertyCard } from '@/components/properties/PropertyCard';
import { Button } from '@/components/ui/button';
import { Filter, Edit, User, Phone, Mail, Plus, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { getSignedImageUrl } from '@/hooks/useSignedImageUrl';
import { useTranslation } from 'react-i18next';

interface Property {
  id: string;
  name: string;
  address: string;
  status: string;
  size: number | null;
  floor: string | null;
  image_url: string | null;
  notes: string | null;
}

interface PropertySecurityCodes {
  property_id: string;
  door_code: string | null;
  safe_code: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

export default function OwnerProperties() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [securityCodes, setSecurityCodes] = useState<Record<string, PropertySecurityCodes>>({});
  const [profile, setProfile] = useState<Profile | null>(null);
  
  const [editPropertyOpen, setEditPropertyOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [propertyForm, setPropertyForm] = useState({
    name: '',
    address: '',
    floor: '',
    size: '',
    status: 'vacant',
    door_code: '',
    safe_code: '',
    notes: ''
  });
  
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: ''
  });

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [propertiesRes, profileRes, securityCodesRes] = await Promise.all([
        supabase.from('properties').select('*'),
        supabase.from('profiles').select('*').eq('id', user?.id).single(),
        supabase.from('property_security_codes').select('*')
      ]);
      
      if (propertiesRes.data) {
        const propertiesWithSignedUrls = await Promise.all(
          propertiesRes.data.map(async (p) => {
            if (p.image_url) {
              const signedUrl = await getSignedImageUrl(p.image_url, 'property-images');
              return { ...p, image_url: signedUrl };
            }
            return p;
          })
        );
        setProperties(propertiesWithSignedUrls);
      }
      if (profileRes.data) setProfile(profileRes.data);
      
      if (securityCodesRes.data) {
        const codesMap: Record<string, PropertySecurityCodes> = {};
        securityCodesRes.data.forEach((code) => {
          codesMap[code.property_id] = code;
        });
        setSecurityCodes(codesMap);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const openEditProperty = (property: Property) => {
    setEditingProperty(property);
    setIsAddingNew(false);
    const codes = securityCodes[property.id];
    setPropertyForm({
      name: property.name,
      address: property.address,
      floor: property.floor || '',
      size: property.size?.toString() || '',
      status: property.status,
      door_code: codes?.door_code || '',
      safe_code: codes?.safe_code || '',
      notes: property.notes || ''
    });
    setEditPropertyOpen(true);
  };

  const openAddProperty = () => {
    setEditingProperty(null);
    setIsAddingNew(true);
    setPropertyForm({
      name: '',
      address: '',
      floor: '',
      size: '',
      status: 'vacant',
      door_code: '',
      safe_code: '',
      notes: ''
    });
    setEditPropertyOpen(true);
  };

  const handleSaveProperty = async () => {
    if (!propertyForm.name || !propertyForm.address) {
      toast.error(t('properties.fillNameAddress'));
      return;
    }

    try {
      if (isAddingNew) {
        const { data: newProperty, error: propertyError } = await supabase
          .from('properties')
          .insert({
            name: propertyForm.name,
            address: propertyForm.address,
            floor: propertyForm.floor || null,
            size: propertyForm.size ? parseInt(propertyForm.size) : null,
            status: propertyForm.status,
            notes: propertyForm.notes || null,
            owner_id: user?.id
          })
          .select()
          .single();

        if (propertyError) throw propertyError;

        if (propertyForm.door_code || propertyForm.safe_code) {
          const { error: codesError } = await supabase
            .from('property_security_codes')
            .insert({
              property_id: newProperty.id,
              door_code: propertyForm.door_code || null,
              safe_code: propertyForm.safe_code || null
            });
          
          if (codesError) throw codesError;
        }

        toast.success(t('properties.propertyCreated'));
      } else if (editingProperty) {
        const { error: propertyError } = await supabase
          .from('properties')
          .update({
            name: propertyForm.name,
            address: propertyForm.address,
            floor: propertyForm.floor || null,
            size: propertyForm.size ? parseInt(propertyForm.size) : null,
            status: propertyForm.status,
            notes: propertyForm.notes || null
          })
          .eq('id', editingProperty.id);

        if (propertyError) throw propertyError;

        const existingCodes = securityCodes[editingProperty.id];
        if (existingCodes) {
          const { error: codesError } = await supabase
            .from('property_security_codes')
            .update({
              door_code: propertyForm.door_code || null,
              safe_code: propertyForm.safe_code || null
            })
            .eq('property_id', editingProperty.id);
          
          if (codesError) throw codesError;
        } else if (propertyForm.door_code || propertyForm.safe_code) {
          const { error: codesError } = await supabase
            .from('property_security_codes')
            .insert({
              property_id: editingProperty.id,
              door_code: propertyForm.door_code || null,
              safe_code: propertyForm.safe_code || null
            });
          
          if (codesError) throw codesError;
        }

        toast.success(t('properties.propertyUpdated'));
      }

      setEditPropertyOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving property:', error);
      toast.error(t('properties.propertySaveError'));
    }
  };

  const openEditProfile = () => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || '',
        phone: profile.phone || ''
      });
      setEditProfileOpen(true);
    }
  };

  const handleSaveProfile = async () => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileForm.full_name || null,
          phone: profileForm.phone || null
        })
        .eq('id', user?.id);

      if (error) throw error;

      toast.success(t('properties.detailsUpdated'));
      setEditProfileOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error(t('properties.detailsUpdateError'));
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Profile Card */}
      {profile && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="w-4 h-4" />
                {t('properties.myDetails')}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={openEditProfile}>
                <Edit className="w-4 h-4 ml-1" />
                {t('common.edit')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2 text-sm">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{profile.full_name || t('common.notSpecified')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-4 h-4 text-muted-foreground" />
                <span>{profile.email || t('common.notSpecified')}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <span>{profile.phone || t('common.notSpecified')}</span>
                {profile.phone && (
                  <button
                    onClick={() => {
                      const phoneNum = profile.phone?.replace(/\D/g, '');
                      const whatsappUrl = phoneNum 
                        ? `https://wa.me/${phoneNum.startsWith('0') ? '972' + phoneNum.slice(1) : phoneNum}`
                        : '';
                      if (whatsappUrl) window.open(whatsappUrl, '_blank');
                    }}
                    className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                    title={t('common.sendWhatsApp')}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground">{t('properties.manageAll')}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={openAddProperty}>
            <Plus className="w-4 h-4 ml-2" />
            {t('properties.addProperty')}
          </Button>
          <Button variant="outline" size="sm">
            <Filter className="w-4 h-4 ml-2" />
            {t('common.filter')}
          </Button>
        </div>
      </div>

      {/* Properties Grid */}
      {properties.length > 0 ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map((property, index) => (
            <div 
              key={property.id} 
              className="animate-slide-up relative group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 left-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 backdrop-blur-sm"
                onClick={() => openEditProperty(property)}
              >
                <Edit className="w-4 h-4" />
              </Button>
              <PropertyCard 
                property={{
                  id: property.id,
                  name: property.name,
                  address: property.address,
                  floor: property.floor || '',
                  size: property.size || 0,
                  status: property.status as 'occupied' | 'vacant' | 'preparing',
                  ownerId: user?.id || '',
                  image: property.image_url || undefined,
                }} 
              />
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">{t('properties.noProperties')}</p>
            <Button onClick={openAddProperty}>
              <Plus className="w-4 h-4 ml-2" />
              {t('properties.addFirstProperty')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Edit Property Dialog */}
      <Dialog open={editPropertyOpen} onOpenChange={setEditPropertyOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{isAddingNew ? t('properties.addPropertyTitle') : t('properties.editProperty')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('properties.propertyName')}</Label>
              <Input
                value={propertyForm.name}
                onChange={(e) => setPropertyForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder={t('properties.propertyNamePlaceholder')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('properties.address')}</Label>
              <Input
                value={propertyForm.address}
                onChange={(e) => setPropertyForm(prev => ({ ...prev, address: e.target.value }))}
                placeholder={t('properties.addressPlaceholder')}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('properties.floor')}</Label>
                <Input
                  value={propertyForm.floor}
                  onChange={(e) => setPropertyForm(prev => ({ ...prev, floor: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('properties.size')}</Label>
                <Input
                  type="number"
                  value={propertyForm.size}
                  onChange={(e) => setPropertyForm(prev => ({ ...prev, size: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('properties.status')}</Label>
              <Select
                value={propertyForm.status}
                onValueChange={(value) => setPropertyForm(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('properties.selectStatus')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="vacant">{t('properties.vacant')}</SelectItem>
                  <SelectItem value="occupied">{t('properties.occupied')}</SelectItem>
                  <SelectItem value="preparing">{t('properties.preparing')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('properties.doorCode')}</Label>
                <Input
                  value={propertyForm.door_code}
                  onChange={(e) => setPropertyForm(prev => ({ ...prev, door_code: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('properties.safeCode')}</Label>
                <Input
                  value={propertyForm.safe_code}
                  onChange={(e) => setPropertyForm(prev => ({ ...prev, safe_code: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('common.notes')}</Label>
              <Textarea
                value={propertyForm.notes}
                onChange={(e) => setPropertyForm(prev => ({ ...prev, notes: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setEditPropertyOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSaveProperty}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('properties.editPersonalDetails')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('settings.fullName')}</Label>
              <Input
                value={profileForm.full_name}
                onChange={(e) => setProfileForm(prev => ({ ...prev, full_name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('settings.phone')}</Label>
              <Input
                value={profileForm.phone}
                onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={() => setEditProfileOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSaveProfile}>
                {t('common.save')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
