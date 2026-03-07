import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { 
  Sparkles, Droplets, Wind, Bed, Shirt, Wrench, Package,
  ChevronLeft, Calendar, Clock, Check
} from 'lucide-react';

interface Property {
  id: string;
  name: string;
  address: string;
}

interface Service {
  id: string;
  icon: React.ReactNode;
  priceFrom: number | null;
  category: 'cleaning' | 'maintenance' | 'preparation';
  type: string;
}

const serviceIcons: Record<string, any> = {
  'cleaning-regular': Sparkles,
  'cleaning-deep': Droplets,
  windows: Wind,
  beds: Bed,
  laundry: Shirt,
  maintenance: Wrench,
  supplies: Package,
};

const serviceCategories: Record<string, 'cleaning' | 'maintenance' | 'preparation'> = {
  'cleaning-regular': 'cleaning',
  'cleaning-deep': 'cleaning',
  windows: 'cleaning',
  beds: 'preparation',
  laundry: 'cleaning',
  maintenance: 'maintenance',
  supplies: 'preparation',
};

const serviceTypes: Record<string, string> = {
  'cleaning-regular': 'cleaning',
  'cleaning-deep': 'deep_cleaning',
  windows: 'windows',
  beds: 'beds',
  laundry: 'laundry',
  maintenance: 'maintenance',
  supplies: 'other',
};

const serviceKeys = ['cleaning-regular', 'cleaning-deep', 'windows', 'beds', 'laundry', 'maintenance', 'supplies'];

export default function OwnerServices() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedServiceKey, setSelectedServiceKey] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('08:00 - 12:00');
  const [notes, setNotes] = useState('');
  const [step, setStep] = useState<'list' | 'form'>('list');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) fetchProperties();
  }, [user]);

  const fetchProperties = async () => {
    try {
      const { data } = await supabase.from('properties').select('id, name, address');
      if (data) setProperties(data);
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleServiceSelect = (key: string) => {
    setSelectedServiceKey(key);
    setStep('form');
  };

  const handleBack = () => {
    setStep('list');
    setSelectedServiceKey(null);
    setSelectedProperty('');
    setSelectedDate('');
    setNotes('');
  };

  const handleSubmit = async () => {
    if (!selectedServiceKey || !selectedProperty || !selectedDate) {
      toast.error(t('services.fillRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('service_requests').insert({
        property_id: selectedProperty,
        type: serviceTypes[selectedServiceKey],
        date: selectedDate,
        time: selectedTime,
        notes,
        status: 'new',
      });
      if (error) throw error;
      toast.success(t('services.requestSent'));
      handleBack();
    } catch (error) {
      console.error('Error submitting service request:', error);
      toast.error(t('services.requestError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-48" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (<Skeleton key={i} className="h-32" />))}
        </div>
      </div>
    );
  }

  if (step === 'form' && selectedServiceKey) {
    const Icon = serviceIcons[selectedServiceKey];
    return (
      <div className="space-y-6 animate-fade-in">
        <Button variant="ghost" onClick={handleBack} className="gap-2">
          <ChevronLeft className="w-4 h-4" />
          {t('services.backToServices')}
        </Button>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10 text-primary"><Icon className="w-6 h-6" /></div>
              <div>
                <CardTitle>{t(`services.types.${selectedServiceKey}`)}</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-3">{t('services.selectProperty')}</label>
              {properties.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  {properties.map((property) => (
                    <button key={property.id} onClick={() => setSelectedProperty(property.id)}
                      className={`p-4 rounded-lg border text-right transition-all ${
                        selectedProperty === property.id ? 'border-primary bg-primary/5 shadow-md' : 'border-border hover:border-primary/50'
                      }`}>
                      <p className="font-medium">{property.name}</p>
                      <p className="text-sm text-muted-foreground">{property.address}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground">{t('services.noProperties')}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">{t('services.selectDate')}</label>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full pr-10 pl-4 py-3 rounded-lg border border-input bg-background text-foreground" />
                </div>
                <div className="relative flex-1">
                  <Clock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <select value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full pr-10 pl-4 py-3 rounded-lg border border-input bg-background text-foreground appearance-none">
                    <option>08:00 - 12:00</option>
                    <option>12:00 - 16:00</option>
                    <option>16:00 - 20:00</option>
                  </select>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">{t('services.frequency')}</label>
              <div className="flex flex-wrap gap-2">
                {['oneTime', 'weekly', 'biWeekly', 'monthly'].map((freq) => (
                  <Button key={freq} variant="outline" size="sm">{t(`services.${freq}`)}</Button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-3">{t('services.notesOptional')}</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder={t('services.notesPlaceholder')}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground resize-none" rows={3} />
            </div>

            <div className="flex gap-3 pt-4">
              <Button className="flex-1" size="lg" onClick={handleSubmit} disabled={submitting}>
                <Check className="w-4 h-4 ml-2" />
                {submitting ? t('services.submitting') : t('services.orderService')}
              </Button>
              <Button variant="outline" size="lg" onClick={handleBack}>{t('common.cancel')}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const renderServiceCards = (category: string, categoryLabel: string, colorClass: string) => {
    const keys = serviceKeys.filter(k => serviceCategories[k] === category);
    if (keys.length === 0) return null;
    return (
      <div>
        <h3 className="text-lg font-semibold mb-4">{categoryLabel}</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {keys.map((key, index) => {
            const Icon = serviceIcons[key];
            return (
              <Card key={key} hover className="cursor-pointer animate-slide-up"
                style={{ animationDelay: `${index * 0.05}s` }} onClick={() => handleServiceSelect(key)}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl ${colorClass} shrink-0`}><Icon className="w-6 h-6" /></div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold">{t(`services.types.${key}`)}</h4>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{t(`services.descriptions.${key}`)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div><p className="text-muted-foreground">{t('services.selectService')}</p></div>
      <div className="space-y-6">
        {renderServiceCards('cleaning', t('services.cleaningCategory'), 'bg-primary/10 text-primary')}
        {renderServiceCards('preparation', t('services.preparationCategory'), 'bg-success/10 text-success')}
        {renderServiceCards('maintenance', t('services.maintenanceCategory'), 'bg-warning/10 text-warning')}
      </div>
    </div>
  );
}
