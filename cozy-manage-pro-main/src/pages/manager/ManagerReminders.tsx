import { useTranslation } from 'react-i18next';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bell, ClipboardCheck, Wrench, CheckCircle, Clock, Building2, Settings2, X } from 'lucide-react';
import { format, addDays, isPast, isToday, differenceInDays } from 'date-fns';
import { he as heLocale } from 'date-fns/locale';
import { toast } from 'sonner';

interface Reminder {
  id: string;
  type: 'inspection' | 'cleaning';
  property_id: string;
  property_name: string;
  due_date: string;
  trigger_date: string;
  days_interval: number;
  is_done: boolean;
  note?: string;
}

interface Property {
  id: string;
  name: string;
  address: string;
}

interface ReminderSettings {
  property_id: string;
  inspection_interval_days: number;
}

export default function ManagerReminders() {
  const { t } = useTranslation();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [propertySettings, setPropertySettings] = useState<ReminderSettings[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [intervalDays, setIntervalDays] = useState<number>(14);

  const buildReminders = useCallback(async (props: Property[]) => {
    const all: Reminder[] = [];

    // Load saved settings from localStorage
    const savedSettings: ReminderSettings[] = JSON.parse(
      localStorage.getItem('reminder_settings') || '[]'
    );
    setPropertySettings(savedSettings);

    // 1. Inspection reminders - based on last inspection per property
    const { data: inspections } = await supabase
      .from('property_inspections')
      .select('property_id, inspection_date')
      .order('inspection_date', { ascending: false });

    if (inspections) {
      const lastByProperty: Record<string, string> = {};
      for (const ins of inspections) {
        if (!lastByProperty[ins.property_id]) {
          lastByProperty[ins.property_id] = ins.inspection_date;
        }
      }

      for (const prop of props) {
        const lastDate = lastByProperty[prop.id];
        const setting = savedSettings.find(s => s.property_id === prop.id);
        const interval = setting?.inspection_interval_days ?? 14;

        if (lastDate) {
          const dueDate = addDays(new Date(lastDate), interval);
          const savedDone = localStorage.getItem(`reminder_done_inspection_${prop.id}_${format(dueDate, 'yyyy-MM-dd')}`);
          all.push({
            id: `inspection_${prop.id}`,
            type: 'inspection',
            property_id: prop.id,
            property_name: prop.name,
            trigger_date: lastDate,
            due_date: format(dueDate, 'yyyy-MM-dd'),
            days_interval: interval,
            is_done: !!savedDone,
          });
        }
      }
    }

    // 2. Cleaning reminders - based on owner departure (type='departure') + 1 day
    const { data: departures } = await supabase
      .from('arrivals_departures')
      .select('property_id, date, type, notes')
      .eq('type', 'departure')
      .order('date', { ascending: false });

    if (departures) {
      const lastByProperty: Record<string, { date: string; notes: string | null }> = {};
      for (const dep of departures) {
        if (!lastByProperty[dep.property_id]) {
          lastByProperty[dep.property_id] = { date: dep.date, notes: dep.notes };
        }
      }

      for (const prop of props) {
        const dep = lastByProperty[prop.id];
        if (dep) {
          const dueDate = addDays(new Date(dep.date), 1);
          const savedDone = localStorage.getItem(`reminder_done_cleaning_${prop.id}_${format(dueDate, 'yyyy-MM-dd')}`);
          all.push({
            id: `cleaning_${prop.id}`,
            type: 'cleaning',
            property_id: prop.id,
            property_name: prop.name,
            trigger_date: dep.date,
            due_date: format(dueDate, 'yyyy-MM-dd'),
            days_interval: 1,
            is_done: !!savedDone,
            note: dep.notes || undefined,
          });
        }
      }
    }

    // Sort: not done first, then by due date
    all.sort((a, b) => {
      if (a.is_done !== b.is_done) return a.is_done ? 1 : -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

    setReminders(all);
    setLoading(false);
  }, []);

  useEffect(() => {
    const fetchProperties = async () => {
      const { data } = await supabase
        .from('properties')
        .select('id, name, address')
        .order('name');
      if (data) {
        setProperties(data);
        await buildReminders(data);
      }
    };
    fetchProperties();
  }, [buildReminders]);

  const markDone = (reminder: Reminder) => {
    const key = `reminder_done_${reminder.type}_${reminder.property_id}_${reminder.due_date}`;
    localStorage.setItem(key, '1');
    setReminders(prev => prev.map(r => r.id === reminder.id ? { ...r, is_done: true } : r));
    toast.success('התראה סומנה כטופלה');
  };

  const markUndone = (reminder: Reminder) => {
    const key = `reminder_done_${reminder.type}_${reminder.property_id}_${reminder.due_date}`;
    localStorage.removeItem(key);
    setReminders(prev => prev.map(r => r.id === reminder.id ? { ...r, is_done: false } : r));
  };

  const saveSettings = () => {
    const existing = propertySettings.filter(s => s.property_id !== selectedProperty);
    const updated = [...existing, { property_id: selectedProperty, inspection_interval_days: intervalDays }];
    localStorage.setItem('reminder_settings', JSON.stringify(updated));
    setPropertySettings(updated);
    setSettingsOpen(false);
    toast.success('הגדרות נשמרו');
    buildReminders(properties);
  };

  const getStatusBadge = (reminder: Reminder) => {
    if (reminder.is_done) return <Badge variant="outline" className="text-green-600 border-green-300">טופל</Badge>;
    const due = new Date(reminder.due_date);
    if (isToday(due)) return <Badge className="bg-orange-500">היום</Badge>;
    if (isPast(due)) return <Badge variant="destructive">באיחור</Badge>;
    const days = differenceInDays(due, new Date());
    if (days <= 3) return <Badge className="bg-yellow-500 text-white">בעוד {days} ימים</Badge>;
    return <Badge variant="secondary">בעוד {days} ימים</Badge>;
  };

  const pendingCount = reminders.filter(r => !r.is_done && (isPast(new Date(r.due_date)) || isToday(new Date(r.due_date)))).length;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-6 h-6 text-primary" />
            התראות ותזכורות
            {pendingCount > 0 && (
              <Badge variant="destructive" className="text-sm">{pendingCount}</Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">ניהול תזכורות אוטומטיות לבדיקות וניקיונות</p>
        </div>
        <Button variant="outline" onClick={() => setSettingsOpen(true)}>
          <Settings2 className="w-4 h-4 ml-2" />
          הגדרות תזכורות
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-4 flex items-center gap-3">
            <ClipboardCheck className="w-8 h-8 text-orange-500" />
            <div>
              <p className="text-2xl font-bold text-orange-700">
                {reminders.filter(r => r.type === 'inspection' && !r.is_done).length}
              </p>
              <p className="text-sm text-orange-600">בדיקות ממתינות</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Wrench className="w-8 h-8 text-blue-500" />
            <div>
              <p className="text-2xl font-bold text-blue-700">
                {reminders.filter(r => r.type === 'cleaning' && !r.is_done).length}
              </p>
              <p className="text-sm text-blue-600">ניקיונות ממתינים</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Reminders List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">טוען תזכורות...</div>
      ) : reminders.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>אין תזכורות פעילות</p>
            <p className="text-sm mt-1">תזכורות יופיעו אוטומטית לאחר בדיקות ויציאות בעלי נכסים</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reminders.map(reminder => (
            <Card
              key={reminder.id}
              className={`transition-opacity ${reminder.is_done ? 'opacity-50' : ''}`}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`p-2 rounded-lg ${reminder.type === 'inspection' ? 'bg-orange-100' : 'bg-blue-100'}`}>
                      {reminder.type === 'inspection'
                        ? <ClipboardCheck className="w-5 h-5 text-orange-600" />
                        : <Wrench className="w-5 h-5 text-blue-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{reminder.property_name}</span>
                        {getStatusBadge(reminder)}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {reminder.type === 'inspection'
                          ? `בדיקת נכס נדרשת • כל ${reminder.days_interval} ימים`
                          : 'ניקיון נדרש • יום לאחר יציאת בעל נכס'
                        }
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          תאריך יעד: {format(new Date(reminder.due_date), 'dd/MM/yyyy', { locale: heLocale })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          טריגר: {format(new Date(reminder.trigger_date), 'dd/MM/yyyy', { locale: heLocale })}
                        </span>
                      </div>
                      {reminder.note && (
                        <p className="text-xs text-muted-foreground mt-1 italic">הערה: {reminder.note}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    {reminder.is_done ? (
                      <Button size="sm" variant="ghost" onClick={() => markUndone(reminder)} className="text-muted-foreground">
                        <X className="w-4 h-4" />
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => markDone(reminder)} className="bg-green-600 hover:bg-green-700 text-white">
                        <CheckCircle className="w-4 h-4 ml-1" />
                        טופל
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>הגדרות תזכורות</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>בחר נכס</Label>
              <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר נכס..." />
                </SelectTrigger>
                <SelectContent>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>תדירות בדיקת נכס (ימים)</Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={intervalDays}
                onChange={e => setIntervalDays(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">ברירת מחדל: 14 ימים</p>
            </div>
            <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground space-y-1">
              <p>• תזכורת ניקיון: תמיד יום לאחר יציאת בעל נכס</p>
              <p>• תזכורת בדיקה: לפי התדירות שתגדיר</p>
            </div>
            <Button onClick={saveSettings} disabled={!selectedProperty} className="w-full">
              שמור הגדרות
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
