import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { 
  Plus, 
  ClipboardCheck, 
  Calendar, 
  Clock, 
  Building2, 
  Camera,
  Droplets,
  Thermometer,
  Lightbulb,
  Trees,
  X,
  Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface Property {
  id: string;
  name: string;
  address: string;
}

interface Inspection {
  id: string;
  property_id: string;
  inspector_id: string;
  inspection_date: string;
  inspection_time: string | null;
  water_flow_check: boolean;
  moisture_check: boolean;
  ac_filters_check: boolean;
  electrical_lights_check: boolean;
  garden_check: boolean;
  notes: string | null;
  images: string[];
  status: string;
  created_at: string;
  property?: Property;
}

const checklistItems = [
  { key: 'water_flow_check', label: t('inspections.checks.water'), icon: Droplets },
  { key: 'moisture_check', label: t('inspections.checks.moisture'), icon: Droplets },
  { key: 'ac_filters_check', label: t('inspections.checks.ac'), icon: Thermometer },
  { key: 'electrical_lights_check', label: t('inspections.checks.electrical'), icon: Lightbulb },
  { key: 'garden_check', label: t('inspections.checks.garden'), icon: Trees },
];

export default function ManagerInspections() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [uploadingImages, setUploadingImages] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    property_id: '',
    inspection_date: format(new Date(), 'yyyy-MM-dd'),
    inspection_time: '',
    water_flow_check: false,
    moisture_check: false,
    ac_filters_check: false,
    electrical_lights_check: false,
    garden_check: false,
    notes: '',
  });
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch properties
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select('id, name, address')
        .order('name');

      if (propertiesError) throw propertiesError;
      setProperties(propertiesData || []);

      // Fetch inspections
      const { data: inspectionsData, error: inspectionsError } = await supabase
        .from('property_inspections')
        .select('*')
        .order('inspection_date', { ascending: false });

      if (inspectionsError) throw inspectionsError;

      // Merge property data
      const inspectionsWithProperties = (inspectionsData || []).map(inspection => ({
        ...inspection,
        property: propertiesData?.find(p => p.id === inspection.property_id)
      }));

      setInspections(inspectionsWithProperties);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} ${t('inspections.imageNotImage')}`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name} ${t('inspections.imageTooLarge')}`);
        return false;
      }
      return true;
    });

    setSelectedImages(prev => [...prev, ...validFiles]);
    
    // Create preview URLs
    validFiles.forEach(file => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrls(prev => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const uploadImages = async (): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    
    for (const file of selectedImages) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${formData.property_id}/${fileName}`;

      const { error } = await supabase.storage
        .from('inspection-images')
        .upload(filePath, file);

      if (error) {
        console.error('Error uploading image:', error);
        throw error;
      }

      uploadedUrls.push(filePath);
    }

    return uploadedUrls;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.property_id) {
      toast.error(t('inspections.selectPropertyRequired'));
      return;
    }

    setUploadingImages(true);
    try {
      let imageUrls: string[] = [];
      
      if (selectedImages.length > 0) {
        imageUrls = await uploadImages();
      }

      const { error } = await supabase
        .from('property_inspections')
        .insert({
          property_id: formData.property_id,
          inspector_id: user?.id,
          inspection_date: formData.inspection_date,
          inspection_time: formData.inspection_time || null,
          water_flow_check: formData.water_flow_check,
          moisture_check: formData.moisture_check,
          ac_filters_check: formData.ac_filters_check,
          electrical_lights_check: formData.electrical_lights_check,
          garden_check: formData.garden_check,
          notes: formData.notes || null,
          images: imageUrls,
        });

      if (error) throw error;

      toast.success(t('inspections.inspectionSaved'));
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving inspection:', error);
      toast.error(t('inspections.inspectionSaveError'));
    } finally {
      setUploadingImages(false);
    }
  };

  const resetForm = () => {
    setFormData({
      property_id: '',
      inspection_date: format(new Date(), 'yyyy-MM-dd'),
      inspection_time: '',
      water_flow_check: false,
      moisture_check: false,
      ac_filters_check: false,
      electrical_lights_check: false,
      garden_check: false,
      notes: '',
    });
    setSelectedImages([]);
    setPreviewUrls([]);
  };

  const getSignedUrls = async (paths: string[]): Promise<string[]> => {
    const urls: string[] = [];
    for (const path of paths) {
      const { data } = await supabase.storage
        .from('inspection-images')
        .createSignedUrl(path, 3600);
      if (data?.signedUrl) {
        urls.push(data.signedUrl);
      }
    }
    return urls;
  };

  const viewInspection = async (inspection: Inspection) => {
    if (inspection.images && inspection.images.length > 0) {
      const signedUrls = await getSignedUrls(inspection.images);
      setSelectedInspection({ ...inspection, images: signedUrls });
    } else {
      setSelectedInspection(inspection);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6" dir="rtl">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('pageTitles.apartmentInspections')}</h1>
          <p className="text-muted-foreground">{t('inspections.periodicInspections')}</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 ml-2" />
              {t('inspections.newInspection')}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ClipboardCheck className="h-5 w-5" />
                {t('inspections.newInspectionTitle')}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Property and DateTime */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t('inspections.selectProperty')} *</Label>
                  <Select 
                    value={formData.property_id} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, property_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("inspections.selectProperty")} />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map(property => (
                        <SelectItem key={property.id} value={property.id}>
                          {property.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>{t('inspections.inspectionDate')} *</Label>
                  <Input
                    type="date"
                    value={formData.inspection_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, inspection_date: e.target.value }))}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>{t('inspections.inspectionTime')}</Label>
                  <Input
                    type="time"
                    value={formData.inspection_time}
                    onChange={(e) => setFormData(prev => ({ ...prev, inspection_time: e.target.value }))}
                  />
                </div>
              </div>

              {/* Checklist */}
              <div className="space-y-4">
                <Label className="text-lg font-semibold">{t('inspections.checklist')}</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {checklistItems.map(item => (
                    <div 
                      key={item.key} 
                      className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Checkbox
                        id={item.key}
                        checked={formData[item.key as keyof typeof formData] as boolean}
                        onCheckedChange={(checked) => 
                          setFormData(prev => ({ ...prev, [item.key]: checked }))
                        }
                      />
                      <item.icon className="h-5 w-5 text-muted-foreground" />
                      <Label htmlFor={item.key} className="flex-1 cursor-pointer">
                        {item.label}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>{t('inspections.additionalNotes')}</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder={t("inspections.notesPlaceholder")}
                  rows={3}
                />
              </div>

              {/* Image Upload */}
              <div className="space-y-4">
                <Label className="flex items-center gap-2">
                  <Camera className="h-4 w-4" />
                  {t('inspections.photos')}
                </Label>
                
                <div className="border-2 border-dashed rounded-lg p-4">
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageSelect}
                    className="hidden"
                    id="image-upload"
                  />
                  <label 
                    htmlFor="image-upload" 
                    className="flex flex-col items-center justify-center cursor-pointer py-4"
                  >
                    <Camera className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">{t('inspections.clickToUpload')}</span>
                  </label>
                </div>

                {previewUrls.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {previewUrls.map((url, index) => (
                      <div key={index} className="relative">
                        <img 
                          src={url} 
                          alt={`Preview ${index + 1}`} 
                          className="w-full h-24 object-cover rounded-lg"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6"
                          onClick={() => removeImage(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit" disabled={uploadingImages}>
                  {uploadingImages ? t('inspections.saving') : t('inspections.saveInspection')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Inspections List */}
      {inspections.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">{t('inspections.noInspections')}</h3>
            <p className="text-muted-foreground text-sm">{t("inspections.firstInspection")}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {inspections.map(inspection => (
            <Card key={inspection.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {inspection.property?.name || t('inspections.unknownProperty')}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {inspection.property?.address}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    {inspection.status === 'completed' ? t('inspections.completed') : inspection.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(inspection.inspection_date), 'dd/MM/yyyy', { locale: he })}
                  </span>
                  {inspection.inspection_time && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {inspection.inspection_time}
                    </span>
                  )}
                </div>

                {/* Checklist Summary */}
                <div className="flex flex-wrap gap-1">
                  {inspection.water_flow_check && (
                    <Badge variant="outline" className="text-xs">{t('inspections.badges.water')}</Badge>
                  )}
                  {inspection.moisture_check && (
                    <Badge variant="outline" className="text-xs">{t('inspections.badges.moisture')}</Badge>
                  )}
                  {inspection.ac_filters_check && (
                    <Badge variant="outline" className="text-xs">{t('inspections.badges.ac')}</Badge>
                  )}
                  {inspection.electrical_lights_check && (
                    <Badge variant="outline" className="text-xs">{t('inspections.badges.electrical')}</Badge>
                  )}
                  {inspection.garden_check && (
                    <Badge variant="outline" className="text-xs">{t('inspections.badges.garden')}</Badge>
                  )}
                </div>

                {inspection.images && inspection.images.length > 0 && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Camera className="h-4 w-4" />
                    {inspection.images.length} {t('inspections.photos')}
                  </div>
                )}

                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => viewInspection(inspection)}
                >
                  <Eye className="h-4 w-4 ml-2" />
                  {t('inspections.viewDetails')}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* View Inspection Dialog */}
      <Dialog open={!!selectedInspection} onOpenChange={() => setSelectedInspection(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5" />
              {t('inspections.inspectionDetails')} - {selectedInspection?.property?.name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedInspection && (
            <div className="space-y-6">
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {format(new Date(selectedInspection.inspection_date), 'dd/MM/yyyy', { locale: he })}
                </span>
                {selectedInspection.inspection_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {selectedInspection.inspection_time}
                  </span>
                )}
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold">{t('inspections.inspectionResults')}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {checklistItems.map(item => (
                    <div 
                      key={item.key}
                      className={`flex items-center gap-2 p-2 rounded-lg ${
                        selectedInspection[item.key as keyof Inspection] 
                          ? 'bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300' 
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                      {selectedInspection[item.key as keyof Inspection] && <span>✓</span>}
                    </div>
                  ))}
                </div>
              </div>

              {selectedInspection.notes && (
                <div className="space-y-2">
                  <h4 className="font-semibold">{t('common.notes')}:</h4>
                  <p className="text-muted-foreground bg-muted p-3 rounded-lg">
                    {selectedInspection.notes}
                  </p>
                </div>
              )}

              {selectedInspection.images && selectedInspection.images.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold">{t('inspections.photos')}:</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {selectedInspection.images.map((url, index) => (
                      <img 
                        key={index}
                        src={url}
                        alt={`${t("inspections.photos")} ${index + 1}`}
                        className="w-full h-48 object-cover rounded-lg cursor-pointer hover:opacity-90"
                        onClick={() => window.open(url, '_blank')}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
