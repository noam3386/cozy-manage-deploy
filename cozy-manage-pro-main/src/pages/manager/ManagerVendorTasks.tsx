import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
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
  Plus, Users, Building2, Clock, AlertTriangle, Package, Bell, Trash2, Eye, Pencil
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
  const [taskForm, setTaskForm] = useState({
    vendor_id: '', property_id: '', title: '', description: '',
    scheduled_date: '', scheduled_time: '', service_type: 'cleaning'
  });

  // Edit vendor dialog
  const [editVendorOpen, setEditVendorOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);
  const [editVendorForm, setEditVendorForm] = useState({ name: '', phone: '', email: '' });

  // Auto rules dialog
  const [ruleOpen, setRuleOpen] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    vendor_id: '', property_id: '', service_type: 'cleaning',
    trigger_type: 'after_departure', trigger_days: 1
  });

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

  const openEditVendor = (vendor: Vendor) => {
    setEditingVendor(vendor);
    setEditVendorForm({ name: vendor.name, phone: vendor.phone, email: vendor.email || '' });
    setEditVendorOpen(true);
  };

  const saveVendorEdit = async () => {
    if (!editingVendor) return;
    if (!editVendorForm.name || !editVendorForm.phone) {
      toast.error('שם וטלפון הם שדות חובה'); return;
    }
    setSubmitting(true);
    const { error } = await supabase.from('vendors').update({
      name: editVendorForm.name,
      phone: editVendorForm.phone,
      email: editVendorForm.email || null,
    }).eq('id', editingVendor.id);
    if (!error) {
      toast.success('פרטי נותן השירות עודכנו');
      setEditVendorOpen(false);
      setEditingVendor(null);
      fetchAll();
    } else {
      toast.error('שגיאה בעדכון הפרטים');
    }
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
          <TabsTrigger value="vendors" className="flex-1">נותני שירות ({vendors.length})</TabsTrigger>
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

        {/* Vendors Tab */}
        <TabsContent value="vendors" className="space-y-3 mt-4">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-3 text-sm text-blue-800">
              <p className="font-semibold mb-1">כיצד ליצור חשבון לנותן שירות?</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>שלח לנותן השירות את כתובת האתר</li>
                <li>בקש ממנו להירשם בעצמו עם כתובת המייל שלו</li>
                <li>לאחר ההרשמה, היכנס ל-Supabase → Authentication → Users</li>
                <li>מצא את המשתמש והעתק את ה-ID שלו</li>
                <li>היכנס ל-Table Editor → user_roles → הוסף שורה עם ה-ID ו-role=vendor</li>
              </ol>
            </CardContent>
          </Card>

          {vendors.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-muted-foreground">אין נותני שירות</CardContent></Card>
          ) : vendors.map(vendor => (
            <Card key={vendor.id}>
              <CardContent className="p-4 flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-semibold">{vendor.name}</p>
                  <p className="text-sm text-muted-foreground">{vendor.phone}</p>
                  {vendor.email && <p className="text-xs text-muted-foreground">{vendor.email}</p>}
                  {vendor.specialty && vendor.specialty.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      {vendor.specialty.map((s, i) => (
                        <Badge key={i} variant="outline" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  )}
                </div>
                <Button size="sm" variant="outline" onClick={() => openEditVendor(vendor)}>
                  <Pencil className="w-3 h-3 ml-1" />
                  ערוך
                </Button>
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

      {/* Edit Vendor Dialog */}
      <Dialog open={editVendorOpen} onOpenChange={setEditVendorOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>עריכת פרטי נותן שירות</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label>שם</Label>
              <Input
                value={editVendorForm.name}
                onChange={e => setEditVendorForm(p => ({ ...p, name: e.target.value }))}
                placeholder="שם נותן השירות"
              />
            </div>
            <div className="space-y-1">
              <Label>טלפון</Label>
              <Input
                value={editVendorForm.phone}
                onChange={e => setEditVendorForm(p => ({ ...p, phone: e.target.value }))}
                placeholder="05X-XXXXXXX"
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <Label>אימייל (אופציונלי)</Label>
              <Input
                type="email"
                value={editVendorForm.email}
                onChange={e => setEditVendorForm(p => ({ ...p, email: e.target.value }))}
                placeholder="vendor@email.com"
                dir="ltr"
              />
            </div>
            <div className="bg-muted rounded p-2 text-xs text-muted-foreground">
              לא ניתן לשנות סיסמא מכאן — נותן השירות יכול לשנות סיסמא דרך "שכחתי סיסמא" בדף ההתחברות
            </div>
            <Button onClick={saveVendorEdit} disabled={submitting} className="w-full">
              {submitting ? 'שומר...' : 'שמור שינויים'}
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
              <Label>טריגר</Label>
              <Select value={ruleForm.trigger_type} onValueChange={v => setRuleForm(p => ({ ...p, trigger_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="after_departure">אחרי עזיבת אורח</SelectItem>
                  <SelectItem value="before_departure">לפני עזיבת אורח</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>מספר ימים</Label>
              <Input
                type="number"
                min={0}
                value={ruleForm.trigger_days}
                onChange={e => setRuleForm(p => ({ ...p, trigger_days: Number(e.target.value) }))}
              />
            </div>
            <Button onClick={createRule} className="w-full">צור כלל</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Report View Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader><DialogTitle>פרטי דוח</DialogTitle></DialogHeader>
          {selectedReport && (
            <div className="space-y-3 py-2">
              {selectedReport.missing_supplies.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-orange-600 mb-1">חומרים חסרים:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedReport.missing_supplies.map((s, i) => <Badge key={i} variant="outline">{s}</Badge>)}
                  </div>
                </div>
              )}
              {selectedReport.issues.length > 0 && (
                <div>
                  <p className="text-sm font-semibold text-red-600 mb-1">בעיות:</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedReport.issues.map((s, i) => <Badge key={i} variant="destructive">{s}</Badge>)}
                  </div>
                </div>
              )}
              {selectedReport.notes && (
                <div>
                  <p className="text-sm font-semibold mb-1">הערות:</p>
                  <p className="text-sm bg-muted rounded p-2">{selectedReport.notes}</p>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                הוגש: {format(new Date(selectedReport.submitted_at), 'dd/MM/yyyy HH:mm', { locale: he })}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
