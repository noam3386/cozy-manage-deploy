import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Inbox, 
  AlertTriangle, 
  Wrench, 
  Calendar,
  Clock,
  CheckCircle,
  Eye,
  PlayCircle,
  History,
  FileText,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { useNotificationSound } from '@/hooks/useNotificationSound';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface Property {
  id: string;
  name: string;
  owner_id: string | null;
}

interface Owner {
  id: string;
  full_name: string | null;
  email: string | null;
}

interface Issue {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  property_id: string;
  created_at: string;
  property?: Property;
  owner?: Owner;
}

interface ServiceRequest {
  id: string;
  type: string;
  status: string;
  date: string;
  time: string | null;
  notes: string | null;
  property_id: string;
  created_at: string;
  property?: Property;
  owner?: Owner;
}

interface ArrivalDeparture {
  id: string;
  type: string;
  date: string;
  time: string | null;
  guest_count: number | null;
  status: string;
  notes: string | null;
  property_id: string;
  created_at: string;
  property?: Property;
  owner?: Owner;
}

type InboxItem = {
  id: string;
  itemType: 'issue' | 'service' | 'arrival';
  status: string;
  created_at: string;
  date?: string;
  title?: string;
  description?: string | null;
  notes?: string | null;
  priority?: string;
  category?: string;
  type?: string;
  time?: string | null;
  guest_count?: number | null;
  property?: Property;
  owner?: Owner;
};

export default function ManagerInbox() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [arrivals, setArrivals] = useState<ArrivalDeparture[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [owners, setOwners] = useState<Record<string, Owner>>({});
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [mainTab, setMainTab] = useState('new');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  
  const { playNotificationSound } = useNotificationSound();

  useEffect(() => {
    fetchData();

    // Subscribe to realtime updates
    const issuesChannel = supabase
      .channel('issues-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'issues'
        },
        (payload) => {
          console.log('New issue received:', payload);
          playNotificationSound();
          toast.info(t('requests.newIssueReceived'), {
            description: (payload.new as any).title || t('requests.newIssueReceived')
          });
          fetchData();
        }
      )
      .subscribe();

    const servicesChannel = supabase
      .channel('services-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'service_requests'
        },
        (payload) => {
          console.log('New service request received:', payload);
          playNotificationSound();
          toast.info(t('requests.newServiceReceived'), {
            description: t(`manager.serviceTypes.${(payload.new as any).type}`, { defaultValue: t('requests.newServiceReceived') })
          });
          fetchData();
        }
      )
      .subscribe();

    const arrivalsChannel = supabase
      .channel('arrivals-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'arrivals_departures'
        },
        (payload) => {
          console.log('New arrival/departure received:', payload);
          playNotificationSound();
          const type = (payload.new as any).type === 'arrival' ? t('manager.arrival') : t('manager.departure');
          toast.info(`${type} ${t('requests.newArrivalReceived')}`);
          fetchData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(issuesChannel);
      supabase.removeChannel(servicesChannel);
      supabase.removeChannel(arrivalsChannel);
    };
  }, []);

  const fetchData = async () => {
    try {
      // Fetch properties
      const { data: propertiesData } = await supabase
        .from('properties')
        .select('id, name, owner_id');
      
      const propList = propertiesData || [];
      setProperties(propList);

      // Fetch owners
      const ownerIds = [...new Set(propList.map(p => p.owner_id).filter(Boolean))] as string[];
      let ownersMap: Record<string, Owner> = {};
      if (ownerIds.length > 0) {
        const { data: ownersData } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', ownerIds);
        
        if (ownersData) {
          ownersMap = ownersData.reduce((acc, owner) => {
            acc[owner.id] = owner;
            return acc;
          }, {} as Record<string, Owner>);
        }
      }
      setOwners(ownersMap);

      // Create property map
      const propMap = propList.reduce((acc, p) => {
        acc[p.id] = p;
        return acc;
      }, {} as Record<string, Property>);

      // Fetch all issues (not just new ones)
      const { data: issuesData } = await supabase
        .from('issues')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (issuesData) {
        setIssues(issuesData.map(i => ({
          ...i,
          property: propMap[i.property_id],
          owner: propMap[i.property_id]?.owner_id ? ownersMap[propMap[i.property_id].owner_id!] : undefined
        })));
      }

      // Fetch all service requests
      const { data: servicesData } = await supabase
        .from('service_requests')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (servicesData) {
        setServiceRequests(servicesData.map(s => ({
          ...s,
          property: propMap[s.property_id],
          owner: propMap[s.property_id]?.owner_id ? ownersMap[propMap[s.property_id].owner_id!] : undefined
        })));
      }

      // Fetch all arrivals
      const { data: arrivalsData } = await supabase
        .from('arrivals_departures')
        .select('*')
        .order('date', { ascending: true });
      
      if (arrivalsData) {
        setArrivals(arrivalsData.map(a => ({
          ...a,
          property: propMap[a.property_id],
          owner: propMap[a.property_id]?.owner_id ? ownersMap[propMap[a.property_id].owner_id!] : undefined
        })));
      }

    } catch (error) {
      console.error('Error fetching inbox data:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  // Convert all items to unified format
  const getAllItems = (): InboxItem[] => {
    const issueItems: InboxItem[] = issues.map(i => ({
      id: i.id,
      itemType: 'issue' as const,
      status: i.status,
      created_at: i.created_at,
      title: i.title,
      description: i.description,
      priority: i.priority,
      category: i.category,
      property: i.property,
      owner: i.owner
    }));

    const serviceItems: InboxItem[] = serviceRequests.map(s => ({
      id: s.id,
      itemType: 'service' as const,
      status: s.status,
      created_at: s.created_at,
      date: s.date,
      type: s.type,
      time: s.time,
      notes: s.notes,
      property: s.property,
      owner: s.owner
    }));

    const arrivalItems: InboxItem[] = arrivals.map(a => ({
      id: a.id,
      itemType: 'arrival' as const,
      status: a.status,
      created_at: a.created_at,
      date: a.date,
      type: a.type,
      time: a.time,
      guest_count: a.guest_count,
      notes: a.notes,
      property: a.property,
      owner: a.owner
    }));

    return [...issueItems, ...serviceItems, ...arrivalItems];
  };

  // Filter items by status category
  const filterItemsByTab = (items: InboxItem[], tab: string): InboxItem[] => {
    switch (tab) {
      case 'new':
        return items.filter(i => ['new', 'reviewing', 'confirmed', 'pending'].includes(i.status));
      case 'in_progress':
        return items.filter(i => i.status === 'in_progress');
      case 'history':
        return items.filter(i => ['completed', 'closed', 'cancelled'].includes(i.status));
      default:
        return items;
    }
  };

  // Filter by category
  const filterItemsByCategory = (items: InboxItem[]): InboxItem[] => {
    if (categoryFilter === 'all') return items;
    return items.filter(i => {
      if (categoryFilter === 'issues') return i.itemType === 'issue';
      if (categoryFilter === 'services') return i.itemType === 'service';
      if (categoryFilter === 'arrivals') return i.itemType === 'arrival';
      return true;
    });
  };

  const getFilteredItems = (): InboxItem[] => {
    const allItems = getAllItems();
    const tabFiltered = filterItemsByTab(allItems, mainTab);
    return filterItemsByCategory(tabFiltered);
  };

  const updateItemStatus = async (item: InboxItem, status: string, notes?: string) => {
    try {
      const table = item.itemType === 'issue' ? 'issues' : 
                    item.itemType === 'service' ? 'service_requests' : 
                    'arrivals_departures';
      
      const updateData: Record<string, any> = { status };
      
      // For issues, we can update description with internal notes
      if (item.itemType === 'issue' && notes) {
        const existingDesc = item.description || '';
        const timestamp = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: he });
        updateData.description = `${existingDesc}\n\n[${timestamp}] ${notes}`.trim();
      }
      
      // For services and arrivals, update notes field
      if ((item.itemType === 'service' || item.itemType === 'arrival') && notes) {
        const existingNotes = item.notes || '';
        const timestamp = format(new Date(), 'dd/MM/yyyy HH:mm', { locale: he });
        updateData.notes = `${existingNotes}\n\n[${timestamp}] ${notes}`.trim();
      }

      const { error } = await supabase
        .from(table)
        .update(updateData)
        .eq('id', item.id);
      
      if (error) throw error;
      toast.success(t('requests.requestUpdated'));
      fetchData();
    } catch (error) {
      console.error('Error updating item:', error);
      toast.error(t('requests.requestUpdateError'));
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const bulkUpdateStatus = async (status: string) => {
    if (selectedItems.size === 0) return;
    
    const allItems = getAllItems();
    const selectedItemsList = allItems.filter(i => selectedItems.has(i.id));
    
    try {
      // Group by table
      const issueIds = selectedItemsList.filter(i => i.itemType === 'issue').map(i => i.id);
      const serviceIds = selectedItemsList.filter(i => i.itemType === 'service').map(i => i.id);
      const arrivalIds = selectedItemsList.filter(i => i.itemType === 'arrival').map(i => i.id);

      if (issueIds.length > 0) {
        await supabase.from('issues').update({ status }).in('id', issueIds);
      }
      if (serviceIds.length > 0) {
        await supabase.from('service_requests').update({ status }).in('id', serviceIds);
      }
      if (arrivalIds.length > 0) {
        await supabase.from('arrivals_departures').update({ status }).in('id', arrivalIds);
      }

      toast.success(`${selectedItems.size} ${t('requests.itemsUpdated')}`);
      setSelectedItems(new Set());
      fetchData();
    } catch (error) {
      console.error('Error bulk updating:', error);
      toast.error(t('requests.bulkUpdateError'));
    }
  };

  const selectAll = () => {
    const items = getFilteredItems();
    if (selectedItems.size === items.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(items.map(i => i.id)));
    }
  };

  const openUpdateDialog = (item: InboxItem) => {
    setSelectedItem(item);
    setNewStatus(item.status);
    setInternalNotes('');
    setDialogOpen(true);
  };

  const handleUpdateSubmit = async () => {
    if (!selectedItem) return;
    await updateItemStatus(selectedItem, newStatus, internalNotes);
    setDialogOpen(false);
    setSelectedItem(null);
  };

  const getPriorityBadge = (priority?: string) => {
    switch (priority) {
      case 'emergency':
        return <Badge variant="destructive">{t('issues.emergency')}</Badge>;
      case 'high':
        return <Badge variant="warning">{t('issues.high')}</Badge>;
      default:
        return <Badge variant="outline">{t('issues.normal')}</Badge>;
    }
  };

  const getItemTypeBadge = (itemType: string) => {
    switch (itemType) {
      case 'issue':
        return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{t('requests.issuesCategory')}</Badge>;
      case 'service':
        return <Badge variant="secondary" className="gap-1"><Wrench className="h-3 w-3" />{t('requests.servicesCategory')}</Badge>;
      case 'arrival':
        return <Badge variant="default" className="gap-1"><Calendar className="h-3 w-3" />{t('requests.arrivalsCategory')}</Badge>;
      default:
        return null;
    }
  };

  const getStatusOptions = (itemType: string) => {
    if (itemType === 'issue') {
      return [
        { value: 'new', label: t('requests.statuses.new') },
        { value: 'reviewing', label: t('requests.statuses.reviewing') },
        { value: 'in_progress', label: t('requests.statuses.in_progress') },
        { value: 'completed', label: t('requests.statuses.completed') },
        { value: 'closed', label: t('requests.statuses.closed') }
      ];
    }
    if (itemType === 'service') {
      return [
        { value: 'new', label: t('requests.statuses.new') },
        { value: 'confirmed', label: t('requests.statuses.confirmed') },
        { value: 'in_progress', label: t('requests.statuses.in_progress') },
        { value: 'completed', label: t('requests.statuses.completed') },
        { value: 'cancelled', label: t('requests.statuses.cancelled') }
      ];
    }
    return [
      { value: 'pending', label: t('requests.statuses.pending') },
      { value: 'confirmed', label: t('requests.statuses.confirmed') },
      { value: 'in_progress', label: t('requests.statuses.in_progress') },
      { value: 'completed', label: t('requests.statuses.completed') }
    ];
  };

  const renderItemCard = (item: InboxItem) => {
    const borderColor = item.itemType === 'issue' ? 'border-r-destructive' :
                        item.itemType === 'service' ? 'border-r-info' :
                        item.type === 'arrival' ? 'border-r-success' : 'border-r-warning';

    return (
      <Card key={item.id} className={`border-r-4 ${borderColor}`}>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <Checkbox 
              checked={selectedItems.has(item.id)}
              onCheckedChange={() => toggleSelection(item.id)}
              className="mt-1"
            />
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                {getItemTypeBadge(item.itemType)}
                {item.priority && getPriorityBadge(item.priority)}
                {item.category && (
                  <Badge variant="outline">{t(`issues.categories.${item.category}`, { defaultValue: item.category })}</Badge>
                )}
                {item.type && item.itemType === 'service' && (
                  <Badge variant="outline">{t(`manager.serviceTypes.${item.type}`, { defaultValue: item.type })}</Badge>
                )}
                {item.type && item.itemType === 'arrival' && (
                  <Badge variant={item.type === 'arrival' ? 'default' : 'secondary'}>
                    {item.type === 'arrival' ? t('manager.arrival') : t('manager.departure')}
                  </Badge>
                )}
                <Badge variant="secondary">{t(`requests.statuses.${item.status}`, { defaultValue: item.status })}</Badge>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(item.created_at), 'dd/MM/yyyy HH:mm', { locale: he })}
                </span>
              </div>
              
              {item.title && <h3 className="font-semibold">{item.title}</h3>}
              
              {item.date && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {format(new Date(item.date), 'dd/MM/yyyy', { locale: he })}
                    {item.time && ` ${t("common.time")}: ${item.time}`}
                  </span>
                  {item.guest_count && (
                    <span className="text-muted-foreground">({item.guest_count} {t('dashboard.guests')})</span>
                  )}
                </div>
              )}
              
              {(item.description || item.notes) && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {item.description || item.notes}
                </p>
              )}
              
              <div className="flex items-center gap-4 text-sm">
                <span className="text-muted-foreground">
                  <strong>{t('common.property')}:</strong> {item.property?.name || t('messages.unknown')}
                </span>
                <span className="text-muted-foreground">
                  <strong>{t('owners.fullName')}:</strong> {item.owner?.full_name || t('messages.unknown')}
                </span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button 
                size="sm" 
                onClick={() => openUpdateDialog(item)}
              >
                <FileText className="h-4 w-4 ml-1" />
                {t("requests.updateButton")}
              </Button>
              {mainTab === 'new' && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => updateItemStatus(item, 'in_progress')}
                >
                  <PlayCircle className="h-4 w-4 ml-1" />
                  {t("requests.markInProgress")}
                </Button>
              )}
              {mainTab === 'in_progress' && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => updateItemStatus(item, 'completed')}
                >
                  <CheckCircle className="h-4 w-4 ml-1" />
                  {t("requests.markCompleted")}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  const allItems = getAllItems();
  const newItems = filterItemsByTab(allItems, 'new');
  const inProgressItems = filterItemsByTab(allItems, 'in_progress');
  const historyItems = filterItemsByTab(allItems, 'history');
  const filteredItems = getFilteredItems();

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Inbox className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-bold">{t('requests.inbox')}</h1>
        {newItems.length > 0 && (
          <Badge variant="destructive" className="text-lg px-3">{newItems.length}</Badge>
        )}
      </div>

      <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="new" className="flex items-center gap-2">
            <Inbox className="h-4 w-4" />
            {t('requests.newTab')}
            {newItems.length > 0 && <Badge variant="secondary">{newItems.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="flex items-center gap-2">
            <PlayCircle className="h-4 w-4" />
            {t('requests.inProgressTab')}
            {inProgressItems.length > 0 && <Badge variant="secondary">{inProgressItems.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            {t('requests.historyTab')}
            {historyItems.length > 0 && <Badge variant="outline">{historyItems.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Category filter */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{t('calendar.filterLabel')}</span>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('requests.allCategories')}</SelectItem>
              <SelectItem value="issues">{t('requests.issuesCategory')}</SelectItem>
              <SelectItem value="services">{t('requests.servicesCategory')}</SelectItem>
              <SelectItem value="arrivals">{t('requests.arrivalsCategory')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk actions */}
        {filteredItems.length > 0 && (
          <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-3">
              <Checkbox 
                checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                onCheckedChange={selectAll}
              />
              <span className="text-sm text-muted-foreground">
                {selectedItems.size > 0 ? `${selectedItems.size} ${t('requests.itemsUpdated')}` : t('requests.selectAll')}
              </span>
            </div>
            {selectedItems.size > 0 && (
              <div className="flex items-center gap-2">
                {mainTab === 'new' && (
                  <Button size="sm" onClick={() => bulkUpdateStatus('in_progress')}>
                    <PlayCircle className="h-4 w-4 ml-1" />
                    {t('requests.markInProgress')}
                  </Button>
                )}
                {mainTab === 'in_progress' && (
                  <Button size="sm" onClick={() => bulkUpdateStatus('completed')}>
                    <CheckCircle className="h-4 w-4 ml-1" />
                    {t('requests.markCompleted')}
                  </Button>
                )}
                {mainTab !== 'history' && (
                  <Button size="sm" variant="outline" onClick={() => bulkUpdateStatus('closed')}>
                    <X className="h-4 w-4 ml-1" />
                    {t('requests.statuses.closed')}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        <TabsContent value="new" className="space-y-4">
          {filteredItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-success" />
                {t('requests.noItems')}
              </CardContent>
            </Card>
          ) : (
            filteredItems.map(renderItemCard)
          )}
        </TabsContent>

        <TabsContent value="in_progress" className="space-y-4">
          {filteredItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <PlayCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                {t('requests.noItems')}
              </CardContent>
            </Card>
          ) : (
            filteredItems.map(renderItemCard)
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {filteredItems.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                {t('requests.noItems')}
              </CardContent>
            </Card>
          ) : (
            filteredItems.map(renderItemCard)
          )}
        </TabsContent>
      </Tabs>

      {/* Update Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('requests.updateRequest')}</DialogTitle>
            <DialogDescription>
              {t('requests.changeStatus')}
            </DialogDescription>
          </DialogHeader>
          
          {selectedItem && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                {getItemTypeBadge(selectedItem.itemType)}
                {selectedItem.title && <span className="font-medium">{selectedItem.title}</span>}
                {selectedItem.type && selectedItem.itemType === 'service' && (
                  <span className="font-medium">{t(`manager.serviceTypes.${selectedItem.type}`, { defaultValue: selectedItem.type })}</span>
                )}
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('common.status')}</label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {getStatusOptions(selectedItem.itemType).map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('requests.internalNotes')}</label>
                <Textarea
                  placeholder={t('requests.internalNotes')}
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleUpdateSubmit}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
