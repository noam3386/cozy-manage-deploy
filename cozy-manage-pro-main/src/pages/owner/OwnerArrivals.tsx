import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { 
  PlaneLanding, PlaneTakeoff, Calendar, Users, Bed, Sparkles,
  Wind, Shirt, ChevronLeft, Check, Pencil
} from 'lucide-react';

type FormType = 'arrival' | 'departure' | null;

interface Property { id: string; name: string; address: string; }

interface ArrivalDeparture {
  id: string; type: string; date: string; status: string; property_id: string;
  time?: string; guest_count?: number; double_beds?: number; single_beds?: number;
  cleaning?: boolean; windows?: boolean; laundry?: boolean; notes?: string;
}

export default function OwnerArrivals() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [arrivals, setArrivals] = useState<ArrivalDeparture[]>([]);
  const [formType, setFormType] = useState<FormType>(null);
  const [submitting, setSubmitting] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('morning');
  const [guestCount, setGuestCount] = useState<string>('2');
  const [doubleBeds, setDoubleBeds] = useState<string>('1');
  const [singleBeds, setSingleBeds] = useState<string>('0');
  const [cleaning, setCleaning] = useState(true);
  const [windows, setWindows] = useState(false);
  const [laundry, setLaundry] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => { if (user) fetchData(); }, [user]);

  const fetchData = async () => {
    try {
      const { data: propertiesData } = await supabase.from('properties').select('id, name, address');
      if (propertiesData) setProperties(propertiesData);
      const { data: arrivalsData } = await supabase.from('arrivals_departures').select('*').order('date', { ascending: true });
      if (arrivalsData) setArrivals(arrivalsData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedProperty || !selectedDate) {
      toast.error(t('arrivals.selectPropertyDate'));
      return;
    }
    setSubmitting(true);
    try {
      const data = {
        property_id: selectedProperty, type: formType, date: selectedDate, time: selectedTime,
        guest_count: formType === 'arrival' ? (parseInt(guestCount) || 1) : null,
        double_beds: formType === 'arrival' ? (parseInt(doubleBeds) || 0) : 0,
        single_beds: formType === 'arrival' ? (parseInt(singleBeds) || 0) : 0,
        cleaning, windows, laundry, notes,
      };
      let error;
      if (editingId) {
        ({ error } = await supabase.from('arrivals_departures').update(data).eq('id', editingId));
      } else {
        ({ error } = await supabase.from('arrivals_departures').insert({ ...data, status: 'pending' }));
      }
      if (error) throw error;
      toast.success(editingId ? t('arrivals.updatedSuccess') : t('arrivals.requestSent'));
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error submitting:', error);
      toast.error(t('arrivals.requestError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (item: ArrivalDeparture) => {
    setEditingId(item.id);
    setFormType(item.type as FormType);
    setSelectedProperty(item.property_id);
    setSelectedDate(item.date);
    setSelectedTime(item.time || 'morning');
    setGuestCount(String(item.guest_count || 2));
    setDoubleBeds(String(item.double_beds || 0));
    setSingleBeds(String(item.single_beds || 0));
    setCleaning(item.cleaning ?? true);
    setWindows(item.windows ?? false);
    setLaundry(item.laundry ?? false);
    setNotes(item.notes || '');
  };

  const resetForm = () => {
    setFormType(null); setEditingId(null); setSelectedProperty(''); setSelectedDate('');
    setSelectedTime('morning'); setGuestCount('2'); setDoubleBeds('1'); setSingleBeds('0');
    setCleaning(true); setWindows(false); setLaundry(false); setNotes('');
  };

  const locale = i18n.language === 'he' ? 'he-IL' : i18n.language === 'fr' ? 'fr-FR' : 'en-US';

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-6 w-48" />
        <div className="grid sm:grid-cols-2 gap-6"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (formType) {
    const isArrival = formType === 'arrival';
    
    return (
      <div className="space-y-6 animate-fade-in">
        <Button variant="ghost" onClick={resetForm} className="gap-2">
          <ChevronLeft className="w-4 h-4" />{t('common.back')}
        </Button>
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-xl ${isArrival ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'}`}>
                {isArrival ? <PlaneLanding className="w-6 h-6" /> : <PlaneTakeoff className="w-6 h-6" />}
              </div>
              <div>
                <CardTitle>{editingId ? `${t('common.edit')} ` : ''}{isArrival ? t('arrivals.arrivalToProperty') : t('arrivals.departureFromProperty')}</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {isArrival ? t('arrivals.prepareForArrival') : t('arrivals.postDepartureArrangements')}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-3">{t('arrivals.selectProperty')}</label>
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
                <p className="text-muted-foreground">{t('arrivals.noProperties')}</p>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-3">
                  <Calendar className="w-4 h-4 inline ml-2" />{t('common.date')}
                </label>
                <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-3">{t('arrivals.estimatedTime')}</label>
                <select value={selectedTime} onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground">
                  <option value="morning">{t('arrivals.morning')}</option>
                  <option value="afternoon">{t('arrivals.afternoon')}</option>
                  <option value="evening">{t('arrivals.evening')}</option>
                  <option value="night">{t('arrivals.night')}</option>
                </select>
              </div>
            </div>

            {isArrival ? (
              <>
                <div>
                  <label className="block text-sm font-medium mb-3">
                    <Users className="w-4 h-4 inline ml-2" />{t('arrivals.guestCount')}
                  </label>
                  <input type="number" min="1" value={guestCount} onChange={(e) => setGuestCount(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-3">
                    <Bed className="w-4 h-4 inline ml-2" />{t('arrivals.bedPreparation')}
                  </label>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm text-muted-foreground">{t('arrivals.doubleBeds')}</label>
                      <input type="number" min="0" value={doubleBeds} onChange={(e) => setDoubleBeds(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground mt-1" />
                    </div>
                    <div>
                      <label className="text-sm text-muted-foreground">{t('arrivals.singleBeds')}</label>
                      <input type="number" min="0" value={singleBeds} onChange={(e) => setSingleBeds(e.target.value)}
                        className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground mt-1" />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-3">{t('arrivals.additionalServices')}</label>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                      <input type="checkbox" checked={cleaning} onChange={(e) => setCleaning(e.target.checked)} className="w-4 h-4" />
                      <Sparkles className="w-5 h-5 text-muted-foreground" />
                      <span>{t('arrivals.cleaningBefore')}</span>
                    </label>
                    <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                      <input type="checkbox" checked={windows} onChange={(e) => setWindows(e.target.checked)} className="w-4 h-4" />
                      <Wind className="w-5 h-5 text-muted-foreground" />
                      <span>{t('arrivals.windowCleaning')}</span>
                    </label>
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-sm font-medium mb-3">{t('arrivals.postDepartureServices')}</label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                    <input type="checkbox" checked={cleaning} onChange={(e) => setCleaning(e.target.checked)} className="w-4 h-4" />
                    <Sparkles className="w-5 h-5 text-muted-foreground" />
                    <span>{t('arrivals.cleaningAfter')}</span>
                  </label>
                  <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50 transition-colors">
                    <input type="checkbox" checked={laundry} onChange={(e) => setLaundry(e.target.checked)} className="w-4 h-4" />
                    <Shirt className="w-5 h-5 text-muted-foreground" />
                    <span>{t('arrivals.laundry')}</span>
                  </label>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-3">{t('common.notes')}</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder={t('services.notesPlaceholder')}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground resize-none" rows={3} />
            </div>

            <div className="flex gap-3 pt-4">
              <Button className="flex-1" size="lg" onClick={handleSubmit} disabled={submitting}>
                <Check className="w-4 h-4 ml-2" />
                {submitting ? t('arrivals.submitting') : editingId ? t('arrivals.saveChanges') : (isArrival ? t('arrivals.sendPrepRequest') : t('arrivals.sendArrangeRequest'))}
              </Button>
              <Button variant="outline" size="lg" onClick={resetForm}>{t('common.cancel')}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div><p className="text-muted-foreground">{t('arrivals.subtitle')}</p></div>

      <div className="grid sm:grid-cols-2 gap-6">
        <Card hover className="cursor-pointer group" onClick={() => setFormType('arrival')}>
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-success/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <PlaneLanding className="w-10 h-10 text-success" />
            </div>
            <h3 className="text-xl font-bold mb-2">{t('arrivals.arriving')}</h3>
            <p className="text-muted-foreground">{t('arrivals.arrivingDesc')}</p>
          </CardContent>
        </Card>

        <Card hover className="cursor-pointer group" onClick={() => setFormType('departure')}>
          <CardContent className="p-8 text-center">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-destructive/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <PlaneTakeoff className="w-10 h-10 text-destructive" />
            </div>
            <h3 className="text-xl font-bold mb-2">{t('arrivals.leaving')}</h3>
            <p className="text-muted-foreground">{t('arrivals.leavingDesc')}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('arrivals.upcomingEvents')}</CardTitle>
        </CardHeader>
        <CardContent>
          {arrivals.length > 0 ? (
            <div className="space-y-4">
              {arrivals.map((item) => {
                const property = properties.find(p => p.id === item.property_id);
                const isArrival = item.type === 'arrival';
                return (
                  <div key={item.id} className="flex items-center justify-between p-4 rounded-lg border group hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${isArrival ? 'bg-success/10' : 'bg-destructive/10'}`}>
                        {isArrival ? <PlaneLanding className="w-5 h-5 text-success" /> : <PlaneTakeoff className="w-5 h-5 text-destructive" />}
                      </div>
                      <div>
                        <p className="font-medium">{property?.name || t('inspections.unknownProperty')}</p>
                        <p className="text-sm text-muted-foreground">{formatDate(item.date)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleEdit(item)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Badge variant={item.status === 'confirmed' ? 'success' : 'warning'}>
                        {item.status === 'confirmed' ? t('arrivals.confirmed') : t('arrivals.pending')}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">{t('arrivals.noUpcomingEvents')}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
