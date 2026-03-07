import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Plus, Sparkles, Calendar, Building2, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';

interface Property {
  id: string;
  name: string;
  address: string;
}

interface CleaningRecord {
  id: string;
  property_id: string;
  cleaned_at: string;
  cleaned_by: string | null;
  notes: string | null;
  created_at: string;
  property?: Property;
}

export default function ManagerCleaningRecords() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<CleaningRecord[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  
  // Form state
  const [formData, setFormData] = useState({
    property_id: '',
    cleaned_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    notes: '',
  });

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

      // Fetch cleaning records
      const { data: recordsData, error: recordsError } = await supabase
        .from('property_cleaning_records')
        .select('*')
        .order('cleaned_at', { ascending: false });

      if (recordsError) throw recordsError;

      // Merge property data
      const recordsWithProperties = (recordsData || []).map(record => ({
        ...record,
        property: propertiesData?.find(p => p.id === record.property_id)
      }));

      setRecords(recordsWithProperties);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.property_id) {
      toast.error(t('inspections.selectPropertyRequired'));
      return;
    }

    try {
      const { error } = await supabase
        .from('property_cleaning_records')
        .insert({
          property_id: formData.property_id,
          cleaned_at: formData.cleaned_at,
          cleaned_by: user?.id,
          notes: formData.notes || null,
        });

      if (error) throw error;

      toast.success(t('cleaningRecords.cleaningSaved'));
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error saving cleaning record:', error);
      toast.error(t('cleaningRecords.cleaningSaveError'));
    }
  };

  const resetForm = () => {
    setFormData({
      property_id: '',
      cleaned_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      notes: '',
    });
  };

  // Get latest cleaning for each property
  const getLatestCleaningByProperty = () => {
    const latestByProperty = new Map<string, CleaningRecord>();
    
    records.forEach(record => {
      const existing = latestByProperty.get(record.property_id);
      if (!existing || new Date(record.cleaned_at) > new Date(existing.cleaned_at)) {
        latestByProperty.set(record.property_id, record);
      }
    });
    
    return Array.from(latestByProperty.values());
  };

  const filteredRecords = filter === 'all' 
    ? records 
    : records.filter(r => r.property_id === filter);

  const latestCleanings = getLatestCleaningByProperty();

  if (loading) {
    return (
      <div className="space-y-6 p-6" dir="rtl">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t('pageTitles.cleaningRecords')}</h1>
          <p className="text-muted-foreground">{t('cleaningRecords.subtitle')}</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 ml-2" />
              {t('cleaningRecords.updateCleaning')}
            </Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                {t('cleaningRecords.updateCleaningTitle')}
              </DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                {t("cleaningRecords.selectProperty")} *
                <Select 
                  value={formData.property_id} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, property_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("cleaningRecords.selectProperty")} />
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
                {t("cleaningRecords.cleaningDateTime")} *
                <Input
                  type="datetime-local"
                  value={formData.cleaned_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, cleaned_at: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                {t("common.notes")}
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder={t("common.notes")}
                  rows={2}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit">
                  {t('common.save')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Latest Cleaning Per Property Summary */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">{t('cleaningRecords.latestPerProperty')}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {properties.map(property => {
            const latestCleaning = latestCleanings.find(r => r.property_id === property.id);
            const daysSinceCleaning = latestCleaning 
              ? Math.floor((Date.now() - new Date(latestCleaning.cleaned_at).getTime()) / (1000 * 60 * 60 * 24))
              : null;
            
            return (
              <Card key={property.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {property.name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">{property.address}</p>
                </CardHeader>
                <CardContent>
                  {latestCleaning ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-green-500" />
                        <span className="text-sm">
                          {format(new Date(latestCleaning.cleaned_at), 'dd/MM/yyyy HH:mm', { locale: he })}
                        </span>
                      </div>
                      <Badge 
                        variant={daysSinceCleaning! <= 7 ? 'default' : daysSinceCleaning! <= 14 ? 'secondary' : 'destructive'}
                      >
                        {t('inspections.ago')} {formatDistanceToNow(new Date(latestCleaning.cleaned_at), { locale: he })}
                      </Badge>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">{t('cleaningRecords.noCleaning')}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Filter and History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('cleaningRecords.cleaningHistory')}</h2>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t("cleaningRecords.filterByProperty")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('calendar.allProperties')}</SelectItem>
              {properties.map(property => (
                <SelectItem key={property.id} value={property.id}>
                  {property.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {filteredRecords.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">{t('cleaningRecords.noRecords')}</h3>
              <p className="text-muted-foreground text-sm">{t("cleaningRecords.addFirstRecord")}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredRecords.map(record => (
              <Card key={record.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                      <Sparkles className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium">{record.property?.name}</p>
                      <p className="text-sm text-muted-foreground">{record.property?.address}</p>
                    </div>
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-4 w-4" />
                      {format(new Date(record.cleaned_at), 'dd/MM/yyyy', { locale: he })}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      {format(new Date(record.cleaned_at), 'HH:mm', { locale: he })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
