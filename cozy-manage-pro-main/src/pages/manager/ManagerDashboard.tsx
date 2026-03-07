import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Wrench, 
  AlertTriangle, 
  Clock,
  Home,
  ChevronLeft,
  Plane,
  CheckCircle2,
  CalendarDays
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Link, useNavigate } from 'react-router-dom';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { he } from 'date-fns/locale';

interface Property {
  id: string;
  name: string;
  address: string;
  status: string;
  owner_id: string;
}

interface ServiceRequest {
  id: string;
  type: string;
  status: string;
  date: string;
  property_id: string;
  created_at: string;
}

interface Issue {
  id: string;
  title: string;
  status: string;
  priority: string;
  property_id: string;
  category: string;
}

interface ArrivalDeparture {
  id: string;
  property_id: string;
  type: string;
  date: string;
  time: string | null;
  guest_count: number | null;
  status: string;
}

interface Booking {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  status: string;
  guest_count: number | null;
}

export default function ManagerDashboard() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [arrivals, setArrivals] = useState<ArrivalDeparture[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const navigate = useNavigate();

  const fetchData = useCallback(async () => {
    try {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      const weekEnd = new Date(today);
      weekEnd.setDate(weekEnd.getDate() + 14);
      const weekEndStr = weekEnd.toISOString().split('T')[0];

      const [propertiesRes, servicesRes, issuesRes, arrivalsRes, bookingsRes] = await Promise.all([
        supabase.from('properties').select('*'),
        supabase.from('service_requests').select('*').in('status', ['new', 'confirmed', 'in_progress']).order('created_at', { ascending: false }),
        supabase.from('issues').select('*').not('status', 'in', '("completed","closed")'),
        supabase.from('arrivals_departures').select('*').gte('date', todayStr).not('status', 'eq', 'completed').order('date', { ascending: true }).limit(10),
        supabase.from('bookings').select('*').or(`start_date.lte.${weekEndStr},end_date.gte.${todayStr}`)
      ]);

      if (propertiesRes.data) setProperties(propertiesRes.data);
      if (servicesRes.data) setServiceRequests(servicesRes.data);
      if (issuesRes.data) setIssues(issuesRes.data);
      if (arrivalsRes.data) setArrivals(arrivalsRes.data);
      if (bookingsRes.data) setBookings(bookingsRes.data);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    
    const channel = supabase
      .channel('manager-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'arrivals_departures' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  const getPropertyName = (propertyId: string) => {
    const property = properties.find(p => p.id === propertyId);
    return property?.name || t('manager.property');
  };

  const formatArrivalDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    if (isToday(date)) return t('manager.today');
    if (isTomorrow(date)) return t('manager.tomorrow');
    return format(date, 'd/M', { locale: he });
  };

  const urgentIssues = issues.filter(i => i.priority === 'emergency' || i.priority === 'high');
  const newRequests = serviceRequests.filter(r => r.status === 'new');
  const pendingApprovals = serviceRequests.filter(r => r.status === 'confirmed');
  const todayArrivals = arrivals.filter(a => isToday(parseISO(a.date)));

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-24" />
        <div className="grid lg:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Clean Summary Header */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gradient-to-br from-destructive/10 to-destructive/5 border-destructive/20 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/manager/requests')}>
          <CardContent className="p-4">
            <div className="flex flex-col items-center text-center gap-2">
              <AlertTriangle className="h-6 w-6 text-destructive" />
              <p className="text-3xl font-bold text-destructive">{urgentIssues.length}</p>
              <p className="text-xs text-muted-foreground">{t('manager.urgentIssues')}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/manager/requests')}>
          <CardContent className="p-4">
            <div className="flex flex-col items-center text-center gap-2">
              <Wrench className="h-6 w-6 text-primary" />
              <p className="text-3xl font-bold text-primary">{newRequests.length}</p>
              <p className="text-xs text-muted-foreground">{t('manager.newRequests')}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/manager/requests')}>
          <CardContent className="p-4">
            <div className="flex flex-col items-center text-center gap-2">
              <Clock className="h-6 w-6 text-orange-500" />
              <p className="text-3xl font-bold text-orange-500">{pendingApprovals.length}</p>
              <p className="text-xs text-muted-foreground">{t('manager.pendingApproval')}</p>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20 cursor-pointer hover:shadow-md transition-shadow">
          <CardContent className="p-4">
            <div className="flex flex-col items-center text-center gap-2">
              <Plane className="h-6 w-6 text-green-600 -rotate-45" />
              <p className="text-3xl font-bold text-green-600">{todayArrivals.length}</p>
              <p className="text-xs text-muted-foreground">{t('manager.arrivalsToday')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Urgent Issues */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <CardTitle className="text-base">{t('manager.urgentIssues')}</CardTitle>
              </div>
              <Link to="/manager/requests">
                <Button variant="ghost" size="sm" className="gap-1">
                  {t('common.showAll')}
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {urgentIssues.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>{t('manager.noUrgentIssues')}</span>
              </div>
            ) : (
              urgentIssues.slice(0, 5).map((issue) => (
                <div
                  key={issue.id}
                  onClick={() => navigate(`/manager/properties/${issue.property_id}`)}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                >
                  <div>
                    <p className="font-medium text-sm">{issue.title}</p>
                    <p className="text-xs text-muted-foreground">{getPropertyName(issue.property_id)}</p>
                  </div>
                  <Badge variant={issue.priority === 'emergency' ? 'destructive' : 'default'} className="bg-orange-500">
                    {issue.priority === 'emergency' ? t('issues.emergency') : t('issues.high')}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* New Service Requests */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{t('manager.newServiceRequests')}</CardTitle>
              </div>
              <Link to="/manager/requests">
                <Button variant="ghost" size="sm" className="gap-1">
                  {t('common.showAll')}
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {newRequests.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                <span>{t('manager.noNewRequests')}</span>
              </div>
            ) : (
              newRequests.slice(0, 5).map((request) => (
                <div
                  key={request.id}
                  onClick={() => navigate(`/manager/properties/${request.property_id}`)}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                >
                  <div>
                    <p className="font-medium text-sm">{t(`manager.serviceTypes.${request.type}`, { defaultValue: request.type })}</p>
                    <p className="text-xs text-muted-foreground">{getPropertyName(request.property_id)}</p>
                  </div>
                  <Badge variant="default">{t('common.new')}</Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Arrivals & Departures */}
      {arrivals.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Plane className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">{t('manager.upcomingArrivalsTitle')}</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
              {arrivals.slice(0, 6).map((arrival) => (
                <div
                  key={arrival.id}
                  onClick={() => navigate(`/manager/properties/${arrival.property_id}`)}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                      arrival.type === 'arrival' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                      <Plane className={`h-4 w-4 ${arrival.type === 'departure' ? 'rotate-45' : '-rotate-45'}`} />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{getPropertyName(arrival.property_id)}</p>
                      <p className="text-xs text-muted-foreground">
                        {arrival.type === 'arrival' ? t('manager.arrival') : t('manager.departure')} • {arrival.guest_count || 0} {t('dashboard.guests')}
                      </p>
                    </div>
                  </div>
                  <Badge variant={isToday(parseISO(arrival.date)) ? 'destructive' : 'outline'}>
                    {formatArrivalDate(arrival.date)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Mini Calendar Preview */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">{t('manager.occupancyThisWeek')}</CardTitle>
            </div>
            <Link to="/manager/calendar">
              <Button variant="ghost" size="sm" className="gap-1">
                {t('manager.fullCalendar')}
                <ChevronLeft className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => {
              const day = new Date();
              day.setDate(day.getDate() + i);
              const dayBookings = bookings.filter(b => {
                const start = parseISO(b.start_date);
                const end = parseISO(b.end_date);
                return day >= start && day <= end;
              });
              const isOccupied = dayBookings.length > 0;
              
              return (
                <div
                  key={i}
                  className={`
                    p-3 rounded-lg text-center
                    ${i === 0 ? 'ring-2 ring-primary ring-offset-1' : ''}
                    ${isOccupied ? 'bg-primary/20' : 'bg-muted/30'}
                  `}
                >
                  <p className="text-xs text-muted-foreground">{format(day, 'EEE', { locale: he })}</p>
                  <p className={`text-lg font-bold ${i === 0 ? 'text-primary' : ''}`}>{format(day, 'd')}</p>
                  {isOccupied && (
                    <Badge variant="secondary" className="text-[10px] px-1 mt-1">
                      {dayBookings.length}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats Footer */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/manager/properties')}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10 text-primary">
                <Home className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{properties.length}</p>
                <p className="text-sm text-muted-foreground">{t('manager.managedProperties')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/manager/requests')}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                <Wrench className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{serviceRequests.length}</p>
                <p className="text-sm text-muted-foreground">{t('manager.openRequests')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/manager/requests')}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-red-100 text-red-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{issues.length}</p>
                <p className="text-sm text-muted-foreground">{t('manager.openIssues')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/manager/calendar')}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-100 text-green-600">
                <CalendarDays className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{bookings.length}</p>
                <p className="text-sm text-muted-foreground">{t('manager.occupancyCalendar')}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
