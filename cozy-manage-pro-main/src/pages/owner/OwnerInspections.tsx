import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { 
  ClipboardCheck, Calendar, Clock, Building2, Camera,
  Droplets, Thermometer, Lightbulb, Trees, Eye, Sparkles
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
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

interface CleaningRecord {
  id: string;
  property_id: string;
  cleaned_at: string;
  notes: string | null;
  property?: Property;
}

export default function OwnerInspections() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [cleaningRecords, setCleaningRecords] = useState<CleaningRecord[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedInspection, setSelectedInspection] = useState<Inspection | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<string>('all');

  const dateLocale = i18n.language === 'he' ? he : undefined;

  const checklistItems = [
    { key: 'water_flow_check', labelKey: 'inspections.checks.water', icon: Droplets },
    { key: 'moisture_check', labelKey: 'inspections.checks.moisture', icon: Droplets },
    { key: 'ac_filters_check', labelKey: 'inspections.checks.ac', icon: Thermometer },
    { key: 'electrical_lights_check', labelKey: 'inspections.checks.electrical', icon: Lightbulb },
    { key: 'garden_check', labelKey: 'inspections.checks.garden', icon: Trees },
  ];

  const fetchData = useCallback(async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      // Fetch owner's properties
      const { data: propertiesData, error: propertiesError } = await supabase
        .from('properties')
        .select('id, name, address')
        .eq('owner_id', user.id)
        .order('name');

      if (propertiesError) throw propertiesError;
      setProperties(propertiesData || []);

      if (propertiesData && propertiesData.length > 0) {
        const propertyIds = propertiesData.map(p => p.id);

        // Fetch inspections
        const { data: inspectionsData, error: inspectionsError } = await supabase
          .from('property_inspections')
          .select('*')
          .in('property_id', propertyIds)
          .order('inspection_date', { ascending: false });

        if (inspectionsError) throw inspectionsError;

        const inspectionsWithProperties = (inspectionsData || []).map(inspection => ({
          ...inspection,
          property: propertiesData.find(p => p.id === inspection.property_id)
        }));

        setInspections(inspectionsWithProperties);

        // Fetch cleaning records
        const { data: cleaningData, error: cleaningError } = await supabase
          .from('property_cleaning_records')
          .select('*')
          .in('property_id', propertyIds)
          .order('cleaned_at', { ascending: false });

        if (cleaningError) throw cleaningError;

        const cleaningWithProperties = (cleaningData || []).map(record => ({
          ...record,
          property: propertiesData.find(p => p.id === record.property_id)
        }));

        setCleaningRecords(cleaningWithProperties);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const getLatestCleaningByProperty = () => {
    const latestByProperty = new Map<string, CleaningRecord>();
    
    cleaningRecords.forEach(record => {
      const existing = latestByProperty.get(record.property_id);
      if (!existing || new Date(record.cleaned_at) > new Date(existing.cleaned_at)) {
        latestByProperty.set(record.property_id, record);
      }
    });
    
    return latestByProperty;
  };

  const filteredInspections = selectedProperty === 'all' 
    ? inspections 
    : inspections.filter(i => i.property_id === selectedProperty);

  const latestCleanings = getLatestCleaningByProperty();

  if (loading) {
    return (
      <div className="space-y-6 p-6" dir="rtl">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">{t('inspections.title')}</h1>
        <p className="text-muted-foreground">{t('inspections.subtitle')}</p>
      </div>

      {/* Cleaning Status Per Property */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          {t('inspections.cleaningStatus')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map(property => {
            const latestCleaning = latestCleanings.get(property.id);
            const daysSinceCleaning = latestCleaning 
              ? Math.floor((Date.now() - new Date(latestCleaning.cleaned_at).getTime()) / (1000 * 60 * 60 * 24))
              : null;
            
            return (
              <Card key={property.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {property.name}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {latestCleaning ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-green-500" />
                        <span className="text-sm">
                          {t('inspections.cleanedOn')}{format(new Date(latestCleaning.cleaned_at), 'dd/MM/yyyy', { locale: dateLocale })}
                        </span>
                      </div>
                      <Badge 
                        variant={daysSinceCleaning! <= 7 ? 'default' : daysSinceCleaning! <= 14 ? 'secondary' : 'destructive'}
                      >
                        {formatDistanceToNow(new Date(latestCleaning.cleaned_at), { locale: dateLocale, addSuffix: true })}
                      </Badge>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('inspections.noCleaning')}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Inspections History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            {t('inspections.inspectionHistory')}
          </h2>
          {properties.length > 1 && (
            <select 
              className="border rounded-md px-3 py-2 text-sm"
              value={selectedProperty}
              onChange={(e) => setSelectedProperty(e.target.value)}
            >
              <option value="all">{t('inspections.allProperties')}</option>
              {properties.map(property => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {filteredInspections.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ClipboardCheck className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">{t('inspections.noInspections')}</h3>
              <p className="text-muted-foreground text-sm">{t('inspections.inspectionsWillAppear')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredInspections.map(inspection => (
              <Card key={inspection.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        {inspection.property?.name}
                      </CardTitle>
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
                      {format(new Date(inspection.inspection_date), 'dd/MM/yyyy', { locale: dateLocale })}
                    </span>
                    {inspection.inspection_time && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {inspection.inspection_time}
                      </span>
                    )}
                  </div>

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
      </div>

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
                  {format(new Date(selectedInspection.inspection_date), 'dd/MM/yyyy', { locale: dateLocale })}
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
                      <span>{t(item.labelKey)}</span>
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
                        alt={`${t('inspections.photos')} ${index + 1}`}
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
