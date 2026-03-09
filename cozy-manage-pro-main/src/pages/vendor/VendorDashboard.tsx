import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import {
  CheckCircle, Clock, MapPin, KeyRound, Wrench,
  AlertTriangle, Package, Plus, X, Send, Building2, Phone
} from 'lucide-react';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface Task {
  id: string;
  title: string;
  description: string | null;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  service_type: string;
  property_id: string;
  vendor_id: string;
  property?: {
    name: string;
    address: string;
  };
}

interface Report {
  missing_supplies: string[];
  issues: string[];
  notes: string;
}

interface SecurityCode {
  code: string;
  notes: string | null;
}

export default function VendorDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [vendorId, setVendorId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [propertyDetailsOpen, setPropertyDetailsOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<{ name: string; address: string; code?: SecurityCode } | null>(null);
  const [report, setReport] = useState<Report>({ missing_supplies: [], issues: [], notes: '' });
  const [newSupply, setNewSupply] = useState('');
  const [newIssue, setNewIssue] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchVendorAndTasks = async () => {
      if (!user) return;

      // Get vendor_id linked to this user
      const { data: assignment } = await supabase
        .from('vendor_assignments')
        .select('vendor_id, vendors(name, phone)')
        .eq('user_id', user.id)
        .limit(1)
        .single();

      if (!assignment) { setLoading(false); return; }
      setVendorId(assignment.vendor_id);

      // Get tasks
      const { data: taskData } = await supabase
        .from('vendor_tasks')
        .select('*, properties(name, address)')
        .eq('vendor_id', assignment.vendor_id)
        .order('scheduled_date', { ascending: true });

      if (taskData) {
        setTasks(taskData.map(t => ({
          ...t,
          property: t.properties as any,
        })));
      }
      setLoading(false);
    };

    fetchVendorAndTasks();
  }, [user]);

  const updateStatus = async (task: Task, status: string) => {
    const { error } = await supabase
      .from('vendor_tasks')
      .update({ status, updated_at: new Date().toISOString(), completed_at: status === 'done' ? new Date().toISOString() : null })
      .eq('id', task.id);

    if (!error) {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status } : t));
      toast.success(status === 'done' ? 'משימה סומנה כהושלמה!' : 'סטטוס עודכן');
    }
  };

  const openReport = (task: Task) => {
    setSelectedTask(task);
    setReport({ missing_supplies: [], issues: [], notes: '' });
    setReportOpen(true);
  };

  const openPropertyDetails = async (task: Task) => {
    const { data: codeData } = await supabase
      .from('property_security_codes')
      .select('code, notes')
      .eq('property_id', task.property_id)
      .limit(1)
      .single();

    setSelectedProperty({
      name: task.property?.name || '',
      address: task.property?.address || '',
      code: codeData || undefined,
    });
    setPropertyDetailsOpen(true);
  };

  const submitReport = async () => {
    if (!selectedTask || !vendorId) return;
    setSubmitting(true);
    const { error } = await supabase
      .from('vendor_task_reports')
      .insert({
        task_id: selectedTask.id,
        vendor_id: vendorId,
        property_id: selectedTask.property_id,
        missing_supplies: report.missing_supplies,
        issues: report.issues,
        notes: report.notes || null,
      });

    if (!error) {
      await updateStatus(selectedTask, 'done');
      setReportOpen(false);
      toast.success('הדוח נשלח בהצלחה!');
    } else {
      toast.error('שגיאה בשליחת הדוח');
    }
    setSubmitting(false);
  };

  const addSupply = () => {
    if (!newSupply.trim()) return;
    setReport(prev => ({ ...prev, missing_supplies: [...prev.missing_supplies, newSupply.trim()] }));
    setNewSupply('');
  };

  const addIssue = () => {
    if (!newIssue.trim()) return;
    setReport(prev => ({ ...prev, issues: [...prev.issues, newIssue.trim()] }));
    setNewIssue('');
  };

  const getStatusBadge = (status: string) => {
    if (status === 'done') return <Badge className="bg-green-500">הושלם</Badge>;
    if (status === 'in_progress') return <Badge className="bg-blue-500">בביצוע</Badge>;
    return <Badge variant="outline">ממתין</Badge>;
  };

  const pending = tasks.filter(t => t.status !== 'done');
  const done = tasks.filter(t => t.status === 'done');

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-muted-foreground">טוען...</div>
    </div>
  );

  if (!vendorId) return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="max-w-sm w-full text-center">
        <CardContent className="py-12">
          <Wrench className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="font-semibold">אין חיבור לנותן שירות</p>
          <p className="text-sm text-muted-foreground mt-1">פנה למנהל הנכסים לחיבור החשבון</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-background p-4 space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary" />
            המשימות שלי
          </h1>
          <p className="text-sm text-muted-foreground">{pending.length} משימות פתוחות</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="bg-orange-50 border-orange-200">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-orange-600">{pending.length}</p>
            <p className="text-xs text-orange-500">פתוחות</p>
          </CardContent>
        </Card>
        <Card className="bg-green-50 border-green-200">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-600">{done.length}</p>
            <p className="text-xs text-green-500">הושלמו</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Tasks */}
      {pending.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-400" />
            <p>אין משימות פתוחות!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <h2 className="font-semibold text-sm text-muted-foreground">משימות פתוחות</h2>
          {pending.map(task => (
            <Card key={task.id} className="border-r-4 border-r-primary">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{task.title}</p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Building2 className="w-3 h-3" />
                      {task.property?.name}
                    </p>
                  </div>
                  {getStatusBadge(task.status)}
                </div>

                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(task.scheduled_date), 'dd/MM/yyyy', { locale: he })}
                    {task.scheduled_time && ` • ${task.scheduled_time}`}
                  </span>
                </div>

                {task.description && (
                  <p className="text-sm bg-muted rounded p-2">{task.description}</p>
                )}

                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => openPropertyDetails(task)}>
                    <KeyRound className="w-3 h-3 ml-1" />
                    פרטי נכס
                  </Button>
                  {task.status === 'pending' && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(task, 'in_progress')}>
                      <Clock className="w-3 h-3 ml-1" />
                      התחל
                    </Button>
                  )}
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => openReport(task)}>
                    <Send className="w-3 h-3 ml-1" />
                    סיים + דווח
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Completed Tasks */}
      {done.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-sm text-muted-foreground">הושלמו</h2>
          {done.map(task => (
            <Card key={task.id} className="opacity-60">
              <CardContent className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{task.title}</p>
                  <p className="text-xs text-muted-foreground">{task.property?.name}</p>
                </div>
                <Badge className="bg-green-500 text-xs">הושלם</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Property Details Dialog */}
      <Dialog open={propertyDetailsOpen} onOpenChange={setPropertyDetailsOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>פרטי הנכס</DialogTitle>
          </DialogHeader>
          {selectedProperty && (
            <div className="space-y-4 py-2">
              <div className="bg-muted rounded-lg p-3 space-y-2">
                <p className="font-semibold text-sm flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  {selectedProperty.name}
                </p>
                <p className="text-sm flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" />
                  {selectedProperty.address}
                </p>
              </div>
              {selectedProperty.code && (
                <div className="bg-primary/10 rounded-lg p-3 space-y-1">
                  <p className="text-sm font-semibold flex items-center gap-2">
                    <KeyRound className="w-4 h-4 text-primary" />
                    קוד כניסה
                  </p>
                  <p className="text-2xl font-mono font-bold text-primary tracking-widest">
                    {selectedProperty.code.code}
                  </p>
                  {selectedProperty.code.notes && (
                    <p className="text-xs text-muted-foreground">{selectedProperty.code.notes}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent dir="rtl" className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>דוח סיום - {selectedTask?.title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">

            {/* Missing Supplies */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Package className="w-4 h-4 text-orange-500" />
                חומרים חסרים
              </Label>
              <div className="flex gap-2">
                <Input
                  value={newSupply}
                  onChange={e => setNewSupply(e.target.value)}
                  placeholder="לדוגמה: אקונומיקה, שקיות זבל..."
                  onKeyDown={e => e.key === 'Enter' && addSupply()}
                />
                <Button size="icon" variant="outline" onClick={addSupply}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {report.missing_supplies.map((s, i) => (
                  <Badge key={i} variant="outline" className="gap-1">
                    {s}
                    <X className="w-3 h-3 cursor-pointer" onClick={() =>
                      setReport(prev => ({ ...prev, missing_supplies: prev.missing_supplies.filter((_, j) => j !== i) }))
                    } />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Issues */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                בעיות שנמצאו
              </Label>
              <div className="flex gap-2">
                <Input
                  value={newIssue}
                  onChange={e => setNewIssue(e.target.value)}
                  placeholder="לדוגמה: ברז דולף, נורה שרופה..."
                  onKeyDown={e => e.key === 'Enter' && addIssue()}
                />
                <Button size="icon" variant="outline" onClick={addIssue}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {report.issues.map((s, i) => (
                  <Badge key={i} variant="destructive" className="gap-1">
                    {s}
                    <X className="w-3 h-3 cursor-pointer" onClick={() =>
                      setReport(prev => ({ ...prev, issues: prev.issues.filter((_, j) => j !== i) }))
                    } />
                  </Badge>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>הערות נוספות</Label>
              <Textarea
                value={report.notes}
                onChange={e => setReport(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="כל מה שחשוב לדעת..."
                rows={3}
              />
            </div>

            <Button onClick={submitReport} disabled={submitting} className="w-full">
              <Send className="w-4 h-4 ml-2" />
              {submitting ? 'שולח...' : 'שלח דוח וסיים משימה'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
