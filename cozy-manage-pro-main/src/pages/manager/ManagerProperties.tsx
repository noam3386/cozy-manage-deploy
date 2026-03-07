import { useTranslation } from 'react-i18next';
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Home, User, Edit, Search, MapPin, Link2, Trash2, Upload, Image, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { getSignedImageUrl } from '@/hooks/useSignedImageUrl';
interface Owner {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface Property {
  id: string;
  name: string;
  address: string;
  floor: string | null;
  size: number | null;
  status: string;
  owner_id: string | null;
  notes: string | null;
  image_url: string | null;
  owner?: Owner;
}

export default function ManagerProperties() {
  const navigate = useNavigate();
  const [properties, setProperties] = useState<Property[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<Property | null>(null);
  const [propertyToDelete, setPropertyToDelete] = useState<Property | null>(null);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    floor: '',
    size: '',
    status: 'vacant',
    owner_id: '',
    notes: '',
    image_url: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select('*')
        .order('name');

      if (propertiesError) throw propertiesError;

      const { data: ownersData, error: ownersError } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('role', 'owner')
        .eq('archived', false);

      if (ownersError) throw ownersError;
      
      setOwners(ownersData || []);

      const ownersMap = (ownersData || []).reduce((acc, owner) => {
        acc[owner.id] = owner;
        return acc;
      }, {} as Record<string, Owner>);

      // Generate signed URLs for all property images
      const propertiesWithSignedUrls = await Promise.all(
        (propertiesData || []).map(async (p) => {
          let signedImageUrl = p.image_url;
          if (p.image_url) {
            signedImageUrl = await getSignedImageUrl(p.image_url, 'property-images');
          }
          return {
            ...p,
            image_url: signedImageUrl,
            owner: p.owner_id ? ownersMap[p.owner_id] : undefined
          };
        })
      );

      setProperties(propertiesWithSignedUrls);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      toast.error(t('inspections.imageNotImage'));
      return;
    }

    // Validate file extension
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
    const rawExtension = file.name.split('.').pop();
    const fileExt = rawExtension?.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!fileExt || !allowedExtensions.includes(fileExt)) {
      toast.error(t('inspections.imageNotImage'));
      return;
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(t('inspections.imageTooLarge'));
      return;
    }

    // Preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    setUploading(true);
    try {
      // Generate secure random filename
      const randomBytes = new Uint8Array(8);
      crypto.getRandomValues(randomBytes);
      const randomString = Array.from(randomBytes, b => b.toString(16).padStart(2, '0')).join('');
      const fileName = `${Date.now()}-${randomString}.${fileExt}`;
      const filePath = `properties/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('property-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Store the path in database (not the full URL) for easier signed URL generation
      // But for backwards compatibility, we'll store a reference URL that can be parsed
      const { data: { publicUrl } } = supabase.storage
        .from('property-images')
        .getPublicUrl(filePath);

      // Get a signed URL for immediate preview
      const signedUrl = await getSignedImageUrl(publicUrl, 'property-images');
      setImagePreview(signedUrl);
      
      // Store the public URL pattern in database (will be converted to signed URL when fetched)
      setFormData(prev => ({ ...prev, image_url: publicUrl }));
      toast.success(t('common.success'));
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error(t('common.error'));
      setImagePreview(null);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const propertyData = {
        name: formData.name,
        address: formData.address,
        floor: formData.floor || null,
        size: formData.size ? parseInt(formData.size) : null,
        status: formData.status,
        owner_id: formData.owner_id || null,
        notes: formData.notes || null,
        image_url: formData.image_url || null
      };

      if (editingProperty) {
        const { error } = await supabase
          .from('properties')
          .update(propertyData)
          .eq('id', editingProperty.id);
        
        if (error) throw error;
        toast.success(t('properties.propertyUpdated'));
      } else {
        const { error } = await supabase
          .from('properties')
          .insert(propertyData);
        
        if (error) throw error;
        toast.success(t('properties.propertyCreated'));
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving property:', error);
      toast.error(t('properties.propertySaveError'));
    }
  };

  const handleDelete = async () => {
    if (!propertyToDelete) return;
    
    try {
      const { error } = await supabase
        .from('properties')
        .delete()
        .eq('id', propertyToDelete.id);
      
      if (error) throw error;
      toast.success(t('properties.propertyDeleted'));
      setPropertyToDelete(null);
      fetchData();
    } catch (error) {
      console.error('Error deleting property:', error);
      toast.error(t('properties.propertyDeleteError'));
    }
  };

  const handleEdit = (property: Property) => {
    setEditingProperty(property);
    setFormData({
      name: property.name,
      address: property.address,
      floor: property.floor || '',
      size: property.size?.toString() || '',
      status: property.status,
      owner_id: property.owner_id || '',
      notes: property.notes || '',
      image_url: property.image_url || ''
    });
    setImagePreview(property.image_url || null);
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setEditingProperty(null);
    setImagePreview(null);
    setFormData({
      name: '',
      address: '',
      floor: '',
      size: '',
      status: 'vacant',
      owner_id: '',
      notes: '',
      image_url: ''
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'occupied':
        return <Badge variant="default">{t('properties.occupied')}</Badge>;
      case 'vacant':
        return <Badge variant="secondary">{t('properties.vacant')}</Badge>;
      case 'preparing':
        return <Badge variant="outline" className="border-amber-500 text-amber-600">{t('properties.preparing')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredProperties = properties.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.owner?.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
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
            placeholder={t("properties.searchProperties")}
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
              {t('properties.newProperty')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingProperty ? t('properties.editProperty') : t('properties.addPropertyTitle')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Image Upload */}
              <div className="space-y-2">
                <Label>{t('properties.propertyImage')}</Label>
                <div className="flex items-center gap-4">
                  <div 
                    className="w-24 h-24 rounded-lg border-2 border-dashed border-muted-foreground/25 flex items-center justify-center overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {imagePreview ? (
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Image className="h-8 w-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      <Upload className="h-4 w-4 ml-2" />
                      {uploading ? t('properties.uploading') : t('properties.uploadImage')}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                    <p className="text-xs text-muted-foreground mt-1">{t('properties.imageSize')}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">{t('properties.propertyName')} *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="address">{t('properties.address')} *</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="floor">{t('properties.floor')}</Label>
                  <Input
                    id="floor"
                    value={formData.floor}
                    onChange={(e) => setFormData(prev => ({ ...prev, floor: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="size">{t("properties.size")}</Label>
                  <Input
                    id="size"
                    type="number"
                    value={formData.size}
                    onChange={(e) => setFormData(prev => ({ ...prev, size: e.target.value }))}
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="status">{t('properties.status')}</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vacant">{t('properties.vacant')}</SelectItem>
                      <SelectItem value="occupied">{t('properties.occupied')}</SelectItem>
                      <SelectItem value="preparing">{t('properties.preparing')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="owner_id">{t('properties.owner')}</Label>
                  <Select
                    value={formData.owner_id || "none"}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, owner_id: value === "none" ? "" : value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("properties.owner")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('properties.noAssignment')}</SelectItem>
                      {owners.map((owner) => (
                        <SelectItem key={owner.id} value={owner.id}>
                          {owner.full_name || owner.email}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              
              {/* Security codes removed - only accessible by property owners */}
              
              <div className="space-y-2">
                <Label htmlFor="notes">{t('common.notes')}</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                />
              </div>
              
              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={uploading}>
                  {editingProperty ? t('common.update') : t('common.add')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!propertyToDelete} onOpenChange={(open) => !open && setPropertyToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('properties.deleteConfirm')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("properties.deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('common.delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {filteredProperties.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {searchQuery ? t('properties.noProperties') : t('properties.noProperties')}
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProperties.map((property) => (
            <Card key={property.id} className="hover:shadow-md transition-shadow overflow-hidden">
              {property.image_url && (
                <div className="h-32 w-full overflow-hidden">
                  <img 
                    src={property.image_url} 
                    alt={property.name} 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {!property.image_url && (
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Home className="h-5 w-5 text-primary" />
                      </div>
                    )}
                    <div>
                      <CardTitle className="text-lg">{property.name}</CardTitle>
                      {getStatusBadge(property.status)}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => navigate(`/manager/properties/${property.id}`)} title={t("properties.viewDetails")}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(property)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setPropertyToDelete(property)} className="text-destructive hover:text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{property.address}</span>
                </div>
                {property.floor && (
                  <p className="text-sm text-muted-foreground">{t('properties.floor')} {property.floor}</p>
                )}
                {property.size && (
                  <p className="text-sm text-muted-foreground">{property.size} sqm</p>
                )}
                {property.owner && (
                  <div className="flex items-center gap-2 text-sm pt-2 border-t">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span>{property.owner.full_name || property.owner.email}</span>
                  </div>
                )}
                {!property.owner && (
                  <div className="flex items-center gap-2 text-sm pt-2 border-t text-muted-foreground">
                    <Link2 className="h-4 w-4" />
                    <span>{t('properties.notAssigned')}</span>
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