import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Phone, Mail, MapPin, Building2, Edit, Trash2, Search, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

interface Vendor {
  id: string;
  name: string;
  company_name: string | null;
  phone: string;
  email: string | null;
  address: string | null;
  specialty: string[];
  notes: string | null;
}

export default function ManagerVendors() {
  const { t } = useTranslation();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    company_name: '',
    phone: '',
    email: '',
    address: '',
    specialty: '',
    notes: ''
  });

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      const { data, error } = await supabase
        .from('vendors')
        .select('*')
        .order('name');

      if (error) throw error;
      setVendors(data || []);
    } catch (error) {
      console.error('Error fetching vendors:', error);
      toast.error(t('vendors.vendorsLoadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const vendorData = {
        name: formData.name,
        company_name: formData.company_name || null,
        phone: formData.phone,
        email: formData.email || null,
        address: formData.address || null,
        specialty: formData.specialty ? formData.specialty.split(',').map(s => s.trim()) : [],
        notes: formData.notes || null
      };

      if (editingVendor) {
        const { error } = await supabase
          .from('vendors')
          .update(vendorData)
          .eq('id', editingVendor.id);
        
        if (error) throw error;
        toast.success(t('vendors.vendorUpdated'));
      } else {
        const { error } = await supabase
          .from('vendors')
          .insert(vendorData);
        
        if (error) throw error;
        toast.success(t('vendors.vendorAdded'));
      }

      setIsDialogOpen(false);
      resetForm();
      fetchVendors();
    } catch (error) {
      console.error('Error saving vendor:', error);
      toast.error(t('vendors.vendorSaveError'));
    }
  };

  const handleEdit = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      company_name: vendor.company_name || '',
      phone: vendor.phone,
      email: vendor.email || '',
      address: vendor.address || '',
      specialty: vendor.specialty?.join(', ') || '',
      notes: vendor.notes || ''
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t('vendors.deleteConfirm'))) return;
    
    try {
      const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success(t('vendors.vendorDeleted'));
      fetchVendors();
    } catch (error) {
      console.error('Error deleting vendor:', error);
      toast.error(t('vendors.vendorDeleteError'));
    }
  };

  const resetForm = () => {
    setEditingVendor(null);
    setFormData({
      name: '',
      company_name: '',
      phone: '',
      email: '',
      address: '',
      specialty: '',
      notes: ''
    });
  };

  const filteredVendors = vendors.filter(v => 
    v.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.company_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.specialty?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
  );

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
            placeholder={t("vendors.searchVendors")}
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
              <Plus className="h-4 w-4 ml-2" />{t("vendors.newVendor")}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editingVendor ? t('vendors.editVendor') : t('vendors.addVendor')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">{t('vendors.vendorName')} *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="company_name">{t('vendors.companyName')}</Label>
                  <Input
                    id="company_name"
                    value={formData.company_name}
                    onChange={(e) => setFormData(prev => ({ ...prev, company_name: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">{t('vendors.phone')} *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">{t('vendors.email')}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">{t('vendors.address')}</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="specialty">{t('vendors.specialties')}</Label>
                <Input
                  id="specialty"
                  placeholder={t("vendors.specialtiesPlaceholder")}
                  value={formData.specialty}
                  onChange={(e) => setFormData(prev => ({ ...prev, specialty: e.target.value }))}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">{t('common.notes')}</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
              
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>{t("common.cancel")}
                </Button>
                <Button type="submit">
                  {editingVendor ? t('common.update') : t('common.add')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {filteredVendors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {searchQuery ? t('vendors.noMatchingVendors') : t('vendors.noVendors')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVendors.map((vendor) => (
            <Card key={vendor.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{vendor.name}</CardTitle>
                    {vendor.company_name && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Building2 className="h-3 w-3" />
                        {vendor.company_name}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="iconSm" onClick={() => handleEdit(vendor)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="iconSm" onClick={() => handleDelete(vendor.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${vendor.phone}`} className="hover:text-primary">{vendor.phone}</a>
                  <button
                    onClick={() => {
                      const phoneNum = vendor.phone?.replace(/\D/g, '');
                      const whatsappUrl = phoneNum 
                        ? `https://wa.me/${phoneNum.startsWith('0') ? '972' + phoneNum.slice(1) : phoneNum}`
                        : '';
                      if (whatsappUrl) window.open(whatsappUrl, '_blank');
                    }}
                    className="p-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded"
                    title={t("common.sendWhatsApp")}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </button>
                </div>
                {vendor.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a href={`mailto:${vendor.email}`} className="hover:text-primary truncate">{vendor.email}</a>
                  </div>
                )}
                {vendor.address && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">{vendor.address}</span>
                  </div>
                )}
                {vendor.specialty && vendor.specialty.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2">
                    {vendor.specialty.map((spec, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{spec}</Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
