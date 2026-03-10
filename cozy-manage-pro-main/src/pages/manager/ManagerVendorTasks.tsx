import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import {
  Plus, Wrench, Users, ClipboardList, Send, Settings2,
  CheckCircle, Clock, AlertTriangle, Package, Building2,
  Bell, Trash2, Eye
} from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface Vendor { id: string; name: string; phone: string; email: string | null; specialty: string[] | null; }
interface Property { id: string; name: string; address: string; }
interface VendorTask {
  id: string; vendor_id: string; property_id: string; title: string;
  description: string | null; scheduled_date: string; status: string;
  service_type: string; vendor?: Vendor; property?: Property;
}
interface AutoRule {
  id: string; vendor_id: string; property_id: string; service_type: string;
  trigger_type: string; trigger_days: number; is_active: boolean;
  vendor?: Vendor; property?: Property;
}
interface TaskReport {
  id: string; task_id: string; missing_supplies: string[];
  issues: string[]; notes: string | null; submitted_at: string;
}

export default function ManagerVendorTasks() {
  const { user } = useAuth();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tasks, setTasks] = useState<VendorTask[]>([]);
  const [autoRules, setAutoRules] = useState<AutoRule[]>([]);
  const [reports, setReports] = useState<TaskReport[]>([]);
  const [loading, setLoading] = useState(true);

  // New task dialog
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskForm, setTaskForm] = useState({ vendor_id: '', property_id: '', title: '', description: '', scheduled_date: '', scheduled_time: '', service_type: 'cleaning' });

  // New vendor user dialog
  const [vendorUserOpen, setVendorUserOpen] = useState(false);
  const [vendorUserForm, setVendorUserForm] = useState({ vendor_id: '', email: '', password: '' });

  // Auto rules dialog
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({ vendor_id: '', property_id: '', service_type: 'cleaning', trigger_type: 'after_departure', trigger_days: 1 });

  // Report view dialog
  const [reportOpen, setReportOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<TaskReport | null>(null);

  const [submitting, setSubmitting] = useState(false);

  const fetchAll = useCallback(async () => {
    const [v, p, t, r, rep] = await Promise.all([
      supabase.from('vendors').select('id, name, phone, email, specialty').order('name'),
      supabase.from('properties').select('id, name, address').order('name'),
      supabase.from('vendor_tasks').select('*, vendors(name,phone), properties(name,address)').order('scheduled_date', { ascending: false }),
      supabase.from('vendor_automation_rules').select('*, vendors(name), properties(name)').order('created_at', { ascending: false }),
      supabase.from('vendor_task_reports').select('*').order('submitted_at', { ascending: false }),
    ]);
    if (v.data) setVendors(v.data);
    if (p.data) setProperties(p.data);
    if (t.data) setTasks(t.data.map(x => ({ ...x, vendor: x.vendors as any, property: x.properties as any })));
    if (r.data) setAutoRules(r.data.map(x => ({ ...x, vendor: x.vendors as any, property: x.properties as any })));
    if (rep.data) setReports(rep.data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const createTask = async () => {
    if (!taskForm.vendor_id || !taskForm.property_id || !taskForm.title || !taskForm.scheduled_date) {
      toast.error('נא למלא את כל השדות'); return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('vendor_tasks').insert({
      vendor_id: taskForm.vendor_id,
      property_id: taskForm.property_id,
      title: taskForm.title,
      description: taskForm.description || null,
      scheduled_date: taskForm.scheduled_date,
      scheduled_time: taskForm.scheduled_time || null,
      service_type: taskForm.service_type,
      status: 'pending',
      trigger_type: 'manual',
      created_by: user?.id,
    });
    if (!error) {
      toast.success('משימה נוצרה בהצלחה');
      setTaskOpen(false);
      setTaskForm({ vendor_id: '', property_id: '', title: '', description: '', scheduled_date: '', scheduled_time: '', service_type: 'cleaning' });
      fetchAll();
    } else toast.error('שגיאה ביצירת משימה');
    setSubmitting(false);
  };

  const createVendorUser = async () => {
    if (!vendorUserForm.vendor_id || !vendorUserForm.email || !vendorUserForm.password) {
      toast.error('נא למלא את כל השדות'); return;
    }
    setSubmitting(true);
    // Create user via Supabase Auth Admin (using edge function or direct)
    const { data, error } = await supabase.auth.admin.createUser({
      email: vendorUserForm.email,
      password: vendorUserForm.password,
      email_confirm: true,
    });
    if (error || !data.user) {
      toast.error('שגיאה ביצירת משתמש: ' + (error?.message || ''));
      setSubmitting(false); return;
    }
    // Assign vendor role
    await supabase.from('user_roles').insert({ user_id: data.user.id, role: 'vendor' as any });
    // Link to vendor
    const vendor = vendors.find(v => v.id === vendorUserForm.vendor_id);
    await supabase.from('vendor_assignments').insert({
      vendor_id: vendorUserForm.vendor_id,
      property_id: properties[0]?.id, // will be updated per property assignment
      user_id: data.user.id,
      service_type: vendor?.specialty?.[0] || 'cleaning',
    });
    toast.success('משתמש נותן שירות נוצר בהצלחה!');
    setVendorUserOpen(false);
    setVendorUserForm({ vendor_id: '', email: '', password: '' });
    setSubmitting(false);
  };

  const createRule = async () => {
    if (!ruleForm.vendor_id || !ruleForm.property_id) {
      toast.error('נא לבחור נותן שירות ונכס'); return;
    }
    const { error } = await supabase.from('vendor_automation_rules').insert({
      ...ruleForm,
      created_by: user?.id,
    });
    if (!error) {
      toast.success('כלל אוטומציה נוצר');
      setRuleOpen(false);
      setRuleForm({ vendor_id: '', property_id: '', service_type: 'cleaning', trigger_type: 'after_departure', trigger_days: 1 });
      fetchAll();
    } else toast.error('שגיאה ביצירת כלל');
  };

  const deleteRule = async (id: string) => {
    await supabase.from('vendor_automation_rules').delete().eq('id', id);
    setAutoRules(prev => prev.filter(r => r.id !== id));
    toast.success('כלל נמחק');
  };

  const statusBadge = (s: string) => {
    if (s === 'done') return <Badge className="bg-green-500 text-xs">הושלם</Badge>;
    if (s === 'in_progress') return <Badge className="bg-blue-500 text-xs">בביצוע</Badge>;
    return <Badge variant="outline" className="text-xs">ממתין</Badge>;
  };

  if (loading) return <div className="p-6 text-muted-foreground">טוען...</div>;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" />
            ניהול נותני שירות
          </h1>
          <p className="text-muted-foreground text-sm mt-0.5">משימות, אוטומציות ודוחות</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" onClick={() => setVendorUserOpen(true)}>
            <Plus className="w-4 h-4 ml-1" />
            הוסף משתמש לנותן שירות
          </Button>
          <Button variant="outline" onClick={() => setRuleOpen(true)}>
            <Bell className="w-4 h-4 ml-1" />
            כלל אוטומציה
          </Button>
          <Button onClick={() => setTaskOpen(true)}>
            <Plus className="w-4 h-4 ml-1" />
            משימה חדשה
          </Button>
        </div>
      </div>

      <Tabs defaultValue="tasks">
        <TabsList className="w-full">
          <TabsTrigger value="tasks" className="flex-1">משימות ({tasks.length})</TabsTrigger>
          <TabsTrigger value="reports" className="flex-1">דוחות ({reports.length})</TabsTrigger>
          <TabsTrigger value="automation" className="flex-1">אוטומציה ({autoRules.length})</TabsTrigger>
        </TabsList>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="space-y-3 mt-4">
          {tasks.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">אין משימות עדיין</CardContent></Card>
          ) : tasks.map(task => (
            <Card key={task.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{task.title}</span>
                      {statusBadge(task.status)}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                      <p className="flex items-center gap-1"><Users className="w-3 h-3" />{task.vendor?.name}</p>
                      <p className="flex items-center gap-1"><Building2 className="w-3 h-3" />{task.property?.name}</p>
                      <p className="flex items-center gap-1"><Clock className="w-3 h-3" />
                        {format(new Date(task.scheduled_date), 'dd/MM/yyyy', { locale: he })}
                      </p>
                    </div>
                  </div>
                  {reports.find(r => r.task_id === task.id) && (
                    <Button size="sm" variant="outline" onClick={() => {
                      setSelectedReport(reports.find(r => r.task_id === task.id) || null);
                      setReportOpen(true);
                    }}>
                      <Eye className="w-3 h-3 ml-1" />
                      דוח
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Reports Tab */}
        <TabsContent value="reports" className="space-y-3 mt-4">
          {reports.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">אין דוחות עדיין</CardContent></Card>
          ) : reports.map(report => {
            const task = tasks.find(t => t.id === report.task_id);
            return (
              <Card key={report.id} className={report.issues.length > 0 || report.missing_supplies.length > 0 ? 'border-orange-300' : ''}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-sm">{task?.title || 'משימה'}</p>
                      <p className="text-xs text-muted-foreground">
                        {task?.property?.name} • {format(new Date(report.submitted_at), 'dd/MM/yyyy HH:mm', { locale: he })}
                      </p>
                    </div>
                    {(report.issues.length > 0 || report.missing_supplies.length > 0) && (
                      <AlertTriangle className="w-4 h-4 text-orange-500" />
                    )}
                  </div>
                  {report.missing_supplies.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-orange-600 flex items-center gap-1"><Package className="w-3 h-3" />חומרים חסרים:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {report.missing_supplies.map((s, i) => <Badge key={i} variant="outline" className="text-xs">{s}</Badge>)}
                      </div>
                    </div>
                  )}
                  {report.issues.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />בעיות:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {report.issues.map((s, i) => <Badge key={i} variant="destructive" className="text-xs">{s}</Badge>)}
                      </div>
                    </div>
                  )}
                  {report.notes && <p className="text-xs text-muted-foreground bg-muted rounded p-2">{report.notes}</p>}
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        {/* Automation Tab */}
        <TabsContent value="automation" className="space-y-3 mt-4">
          <Card className="bg-muted/50">
            <CardContent className="p-3 text-sm text-muted-foreground">
              כללי אוטומציה שולחים משימה לנותן השירות X ימים לפני/אחרי עזיבת אורח מנכס
            </CardContent>
          </Card>
          {autoRules.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">אין כללי אוטומציה</CardContent></Card>
          ) : autoRules.map(rule => (
            <Card key={rule.id}>
              <CardContent className="p-4 flex items-center justify-between">
                <div className="space-y-1">
                  <p className="font-semibold text-sm">{rule.vendor?.name}</p>
                  <p className="text-xs text-muted-foreground">{rule.property?.name}</p>
                  <Badge variant="outline" className="text-xs">
                    {rule.trigger_type === 'before_departure' ? `${rule.trigger_days} ימים לפני עזיבה` : `${rule.trigger_days} ימים אחרי עזיבה`}
                  </Badge>
                </div>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteRule(rule.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>

      {/* New Task Dialog */}
      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>משימה חדשה לנותן שירות</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>נותן שירות</Label>
              <Select value={taskForm.vendor_id} onValueChange={v => setTaskForm(p => ({ ...p, vendor_id: v }))}>
                <SelectTrigger><SelectValue placeholder="בחר..." /></SelectTrigger>
                <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>נכס</Label>
              <Select value={taskForm.property_id} onValueChange={v => setTaskForm(p => ({ ...p, property_id: v }))}>
                <SelectTrigger><SelectValue placeholder="בחר..." /></SelectTrigger>
                <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>סוג שירות</Label>
              <Select value={taskForm.service_type} onValueChange={v => setTaskForm(p => ({ ...p, service_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cleaning">ניקיון</SelectItem>
                  <SelectItem value="plumbing">אינסטלציה</SelectItem>
                  <SelectItem value="electric">חשמל</SelectItem>
                  <SelectItem value="garden">גינון</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>כותרת</Label>
              <Input value={taskForm.title} onChange={e => setTaskForm(p => ({ ...p, title: e.target.value }))} placeholder="לדוגמה: ניקיון לאחר עזיבה" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>תאריך</Label>
                <Input type="date" value={taskForm.scheduled_date} onChange={e => setTaskForm(p => ({ ...p, scheduled_date: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label>שעה (אופציונלי)</Label>
                <Input type="time" value={taskForm.scheduled_time} onChange={e => setTaskForm(p => ({ ...p, scheduled_time: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>הערות</Label>
              <Textarea value={taskForm.description} onChange={e => setTaskForm(p => ({ ...p, description: e.target.value }))} rows={2} />
            </div>
            <Button onClick={createTask} disabled={submitting} className="w-full">
              {submitting ? 'שולח...' : 'צור משימה'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Vendor User Dialog */}
      <Dialog open={vendorUserOpen} onOpenChange={setVendorUserOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>הוסף משתמש לנותן שירות</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>נותן שירות</Label>
              <Select value={vendorUserForm.vendor_id} onValueChange={v => setVendorUserForm(p => ({ ...p, vendor_id: v }))}>
                <SelectTrigger><SelectValue placeholder="בחר..." /></SelectTrigger>
                <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>אימייל</Label>
              <Input type="email" value={vendorUserForm.email} onChange={e => setVendorUserForm(p => ({ ...p, email: e.target.value }))} placeholder="vendor@email.com" dir="ltr" />
            </div>
            <div className="space-y-1">
              <Label>סיסמא ראשונית</Label>
              <Input type="password" value={vendorUserForm.password} onChange={e => setVendorUserForm(p => ({ ...p, password: e.target.value }))} placeholder="לפחות 6 תווים" dir="ltr" />
            </div>
            <div className="bg-muted rounded p-2 text-xs text-muted-foreground">
              נותן השירות יוכל להיכנס עם אימייל וסיסמא זו ולראות את המשימות שלו
            </div>
            <Button onClick={createVendorUser} disabled={submitting} className="w-full">
              {submitting ? 'יוצר...' : 'צור משתמש'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Auto Rule Dialog */}
      <Dialog open={ruleOpen} onOpenChange={setRuleOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>כלל אוטומציה חדש</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>נותן שירות</Label>
              <Select value={ruleForm.vendor_id} onValueChange={v => setRuleForm(p => ({ ...p, vendor_id: v }))}>
                <SelectTrigger><SelectValue placeholder="בחר..." /></SelectTrigger>
                <SelectContent>{vendors.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>נכס</Label>
              <Select value={ruleForm.property_id} onValueChange={v => setRuleForm(p => ({ ...p, property_id: v }))}>
                <SelectTrigger><SelectValue placeholder="בחר..." /></SelectTrigger>
                <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>מתי לשלוח?</Label>
              <Select value={ruleForm.trigger_type} onValueChange={v => setRuleForm(p => ({ ...p, trigger_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="before_departure">לפני עזיבה</SelectItem>
                  <SelectItem value="after_departure">אחרי עזיבה</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>כמה ימים?</Label>
              <Input type="number" min={0} max={30} value={ruleForm.trigger_days}
                onChange={e => setRuleForm(p => ({ ...p, trigger_days: Number(e.target.value) }))} />
            </div>
            <Button onClick={createRule} className="w-full">שמור כלל</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
