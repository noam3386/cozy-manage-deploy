import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, Calendar } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Property {
  id: string;
  name: string;
}

interface Task {
  id: string;
  type: string;
  description: string | null;
  status: string;
  priority: string;
  property_id: string;
  due_date: string;
  created_at: string;
  property?: Property;
}

export default function ManagerTasks() {
  const { t } = useTranslation();

  const columns = [
    { id: 'new', label: t('tasks.columns.new'), color: 'bg-muted' },
    { id: 'scheduled', label: t('tasks.columns.scheduled'), color: 'bg-info/10' },
    { id: 'in_progress', label: t('tasks.columns.in_progress'), color: 'bg-warning/10' },
    { id: 'completed', label: t('tasks.columns.completed'), color: 'bg-success/10' },
  ];

  const [tasks, setTasks] = useState<Task[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    type: 'cleaning',
    description: '',
    priority: 'normal',
    property_id: '',
    due_date: format(new Date(), 'yyyy-MM-dd')
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch properties
      const { data: propertiesData } = await supabase
        .from('properties')
        .select('id, name')
        .order('name');
      
      const propList = propertiesData || [];
      setProperties(propList);

      const propMap = propList.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {} as Record<string, Property>);

      // Fetch tasks
      const { data: tasksData, error } = await supabase
        .from('tasks')
        .select('*')
        .order('due_date', { ascending: true });

      if (error) throw error;

      const tasksWithProperties = (tasksData || []).map(t => ({
        ...t,
        property: propMap[t.property_id]
      }));

      setTasks(tasksWithProperties);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast.error(t('tasks.taskLoadError'));
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);

      if (error) throw error;
      
      // Update local state
      setTasks(prev => prev.map(t => 
        t.id === taskId ? { ...t, status: newStatus } : t
      ));
      
      toast.success(t('tasks.statusUpdated'));
    } catch (error) {
      console.error('Error updating task:', error);
      toast.error(t('tasks.statusUpdateError'));
    }
  };

  const moveTask = (taskId: string, direction: 'left' | 'right') => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    const currentIndex = columns.findIndex(c => c.id === task.status);
    const newIndex = direction === 'right' ? currentIndex + 1 : currentIndex - 1;
    
    if (newIndex >= 0 && newIndex < columns.length) {
      updateTaskStatus(taskId, columns[newIndex].id);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.property_id) {
      toast.error(t('tasks.selectPropertyRequired'));
      return;
    }

    try {
      const { error } = await supabase
        .from('tasks')
        .insert({
          type: formData.type,
          description: formData.description || null,
          priority: formData.priority,
          property_id: formData.property_id,
          due_date: formData.due_date,
          status: 'new'
        });

      if (error) throw error;

      toast.success(t('tasks.taskAdded'));
      setIsDialogOpen(false);
      setFormData({
        type: 'cleaning',
        description: '',
        priority: 'normal',
        property_id: '',
        due_date: format(new Date(), 'yyyy-MM-dd')
      });
      fetchData();
    } catch (error) {
      console.error('Error creating task:', error);
      toast.error(t('tasks.taskAddError'));
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map((col) => (
          <div key={col.id} className="space-y-3">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">{t("tasks.title")}</h1>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 ml-2" />
              {t('tasks.newTask')}
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('tasks.addTask')}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                {t("common.property")} *
                <Select
                  value={formData.property_id}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, property_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t("common.property")} />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((property) => (
                      <SelectItem key={property.id} value={property.id}>
                        {property.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">{t('tasks.taskType')}</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cleaning">{t("tasks.types.cleaning")}</SelectItem>
                    <SelectItem value="maintenance">{t("tasks.types.maintenance")}</SelectItem>
                    <SelectItem value="inspection">{t("tasks.types.inspection")}</SelectItem>
                    <SelectItem value="delivery">{t("tasks.types.delivery")}</SelectItem>
                    <SelectItem value="other">{t("tasks.types.other")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">{t('tasks.description')}</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  placeholder={t("tasks.descriptionPlaceholder")}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">{t('tasks.priority')}</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">{t('tasks.normalPriority')}</SelectItem>
                      <SelectItem value="high">{t('tasks.highPriority')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="due_date">{t('tasks.dueDate')}</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData(prev => ({ ...prev, due_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  {t('common.cancel')}
                </Button>
                <Button type="submit">
                  {t('tasks.addTaskBtn')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {columns.map((col) => {
          const columnTasks = tasks.filter(t => t.status === col.id);
          const colIndex = columns.findIndex(c => c.id === col.id);
          
          return (
            <div key={col.id} className={`rounded-xl p-4 ${col.color} min-h-[200px]`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">{col.label}</h3>
                <Badge variant="secondary">{columnTasks.length}</Badge>
              </div>
              <div className="space-y-3">
                {columnTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {t('tasks.noTasks')}
                  </p>
                ) : (
                  columnTasks.map((task) => (
                    <Card key={task.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <Badge variant="outline" className="mb-2">
                              {taskTypeLabels[task.type] || task.type}
                            </Badge>
                            {task.description && (
                              <p className="font-medium text-sm truncate">{task.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {task.property?.name || t('tasks.unknownProperty')}
                            </p>
                            <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(task.due_date), 'dd/MM', { locale: he })}
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            {colIndex > 0 && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => moveTask(task.id, 'left')}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            )}
                            {colIndex < columns.length - 1 && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => moveTask(task.id, 'right')}
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                        {task.priority === 'high' && (
                          <Badge variant="warning" className="mt-2">{t('tasks.highPriority')}</Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
