import { useTranslation } from 'react-i18next';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight,
  Filter,
  Building2,
  Plane,
  User,
  X,
  Home
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  addMonths, 
  subMonths, 
  parseISO,
  isToday,
  isSameDay,
  differenceInDays,
  startOfWeek,
  endOfWeek,
  addWeeks,
  subWeeks,
  eachWeekOfInterval
} from 'date-fns';
import { he } from 'date-fns/locale';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

interface Property {
  id: string;
  name: string;
  address: string;
  status: string;
  owner_id: string | null;
}

interface Booking {
  id: string;
  property_id: string;
  start_date: string;
  end_date: string;
  status: string;
  guest_count: number | null;
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

interface Owner {
  id: string;
  full_name: string | null;
}

type ViewMode = 'month' | 'timeline';

export default function ManagerCalendar() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [arrivals, setArrivals] = useState<ArrivalDeparture[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [selectedProperty, setSelectedProperty] = useState<string>('all');
  const [selectedOwner, setSelectedOwner] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');

  const fetchData = useCallback(async () => {
    try {
      const rangeStart = format(subMonths(startOfMonth(currentDate), 1), 'yyyy-MM-dd');
      const rangeEnd = format(addMonths(endOfMonth(currentDate), 2), 'yyyy-MM-dd');

      const [propertiesRes, bookingsRes, arrivalsRes, ownersRes] = await Promise.all([
        supabase.from('properties').select('*'),
        supabase.from('bookings').select('*')
          .or(`start_date.lte.${rangeEnd},end_date.gte.${rangeStart}`),
        supabase.from('arrivals_departures').select('*')
          .gte('date', rangeStart)
          .lte('date', rangeEnd),
        supabase.from('profiles').select('id, full_name')
      ]);

      if (propertiesRes.data) setProperties(propertiesRes.data);
      if (bookingsRes.data) setBookings(bookingsRes.data);
      if (arrivalsRes.data) setArrivals(arrivalsRes.data);
      if (ownersRes.data) setOwners(ownersRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter properties
  const filteredProperties = useMemo(() => {
    return properties.filter(p => {
      if (selectedProperty !== 'all' && p.id !== selectedProperty) return false;
      if (selectedOwner !== 'all' && p.owner_id !== selectedOwner) return false;
      if (selectedStatus !== 'all' && p.status !== selectedStatus) return false;
      return true;
    });
  }, [properties, selectedProperty, selectedOwner, selectedStatus]);

  // Timeline view calculations
  const weeksInView = 6;
  const timelineStart = startOfWeek(currentDate, { weekStartsOn: 0 });
  const timelineEnd = endOfWeek(addWeeks(currentDate, weeksInView - 1), { weekStartsOn: 0 });
  const timelineDays = eachDayOfInterval({ start: timelineStart, end: timelineEnd });

  const getBookingsForProperty = (propertyId: string) => {
    return bookings.filter(b => b.property_id === propertyId);
  };

  const getArrivalsForPropertyAndDay = (propertyId: string, day: Date) => {
    return arrivals.filter(a => 
      a.property_id === propertyId && 
      isSameDay(parseISO(a.date), day)
    );
  };

  const getOwnerName = (ownerId: string | null) => {
    if (!ownerId) return t('calendar.notAssigned');
    const owner = owners.find(o => o.id === ownerId);
    return owner?.full_name || t('calendar.unknownOwner');
  };

  const clearFilters = () => {
    setSelectedProperty('all');
    setSelectedOwner('all');
    setSelectedStatus('all');
  };

  const hasActiveFilters = selectedProperty !== 'all' || selectedOwner !== 'all' || selectedStatus !== 'all';

  // Stats
  const occupiedToday = useMemo(() => {
    const today = new Date();
    return filteredProperties.filter(p => 
      bookings.some(b => {
        const start = parseISO(b.start_date);
        const end = parseISO(b.end_date);
        return b.property_id === p.id && today >= start && today <= end;
      })
    ).length;
  }, [filteredProperties, bookings]);

  const upcomingArrivals = useMemo(() => {
    const today = new Date();
    const weekEnd = addWeeks(today, 1);
    return arrivals.filter(a => {
      const date = parseISO(a.date);
      return a.type === 'arrival' && date >= today && date <= weekEnd;
    }).length;
  }, [arrivals]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16" />
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with filters */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">{t('pageTitles.calendar')}</h1>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant={viewMode === 'timeline' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setViewMode('timeline')}
            >
              {t('calendar.timeline')}
            </Button>
            <Button 
              variant={viewMode === 'month' ? 'default' : 'outline'} 
              size="sm"
              onClick={() => setViewMode('month')}
            >
              {t('calendar.monthly')}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-primary/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Building2 className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{filteredProperties.length}</p>
                <p className="text-xs text-muted-foreground">{t('calendar.propertiesShown')}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-500/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Home className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{occupiedToday}</p>
                <p className="text-xs text-muted-foreground">{t('calendar.occupiedToday')}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-amber-500/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Plane className="h-5 w-5 text-amber-500 -rotate-45" />
              </div>
              <div>
                <p className="text-2xl font-bold">{upcomingArrivals}</p>
                <p className="text-xs text-muted-foreground">{t('calendar.arrivalsThisWeek')}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-muted-foreground/20">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Filter className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{bookings.length}</p>
                <p className="text-xs text-muted-foreground">{t('calendar.bookingsInRange')}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">{t('calendar.filterLabel')}</span>
              </div>
              
              <Select value={selectedProperty} onValueChange={setSelectedProperty}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("calendar.allProperties")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("calendar.allProperties")}</SelectItem>
                  {properties.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedOwner} onValueChange={setSelectedOwner}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder={t("calendar.allOwners")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("calendar.allOwners")}</SelectItem>
                  {owners.map(o => (
                    <SelectItem key={o.id} value={o.id}>{o.full_name || t('calendar.unknownOwner')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder={t("common.status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("calendar.allStatuses")}</SelectItem>
                  <SelectItem value="vacant">{t('calendar.vacantStatus')}</SelectItem>
                  <SelectItem value="occupied">{t('calendar.occupiedStatus')}</SelectItem>
                  <SelectItem value="maintenance">{t('calendar.maintenanceStatus')}</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                  <X className="h-4 w-4" />
                  {t('calendar.clearFilter')}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline View */}
      {viewMode === 'timeline' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("calendar.timelineWeeks", { count: weeksInView })}</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(subWeeks(currentDate, 2))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
                  {t('calendar.todayBtn')}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(addWeeks(currentDate, 2))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="w-full">
              <div className="min-w-[900px]">
                {/* Timeline header - dates */}
                <div className="flex border-b bg-muted/30 sticky top-0">
                  <div className="w-48 flex-shrink-0 p-3 border-l font-medium text-sm">
                    {t('calendar.propertyCol')}
                  </div>
                  <div className="flex flex-1">
                    {timelineDays.map((day, i) => {
                      const isWeekStart = i % 7 === 0;
                      return (
                        <div 
                          key={day.toISOString()} 
                          className={`
                            flex-1 min-w-[40px] p-1 text-center text-xs border-l
                            ${isToday(day) ? 'bg-primary text-primary-foreground' : ''}
                            ${isWeekStart ? 'border-l-2 border-l-muted-foreground/30' : ''}
                          `}
                        >
                          <div className="font-medium">{format(day, 'EEE', { locale: he })}</div>
                          <div>{format(day, 'd/M')}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Property rows */}
                {filteredProperties.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    {t('calendar.noMatchingProperties')}
                  </div>
                ) : (
                  filteredProperties.map(property => {
                    const propertyBookings = getBookingsForProperty(property.id);
                    
                    return (
                      <div key={property.id} className="flex border-b hover:bg-muted/20 transition-colors">
                        {/* Property info */}
                        <div className="w-48 flex-shrink-0 p-3 border-l">
                          <p className="font-medium text-sm truncate">{property.name}</p>
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {getOwnerName(property.owner_id)}
                          </p>
                        </div>
                        
                        {/* Timeline cells */}
                        <div className="flex flex-1 relative">
                          {timelineDays.map((day, i) => {
                            const dayArrivals = getArrivalsForPropertyAndDay(property.id, day);
                            const hasArrival = dayArrivals.some(a => a.type === 'arrival');
                            const hasDeparture = dayArrivals.some(a => a.type === 'departure');
                            const isOccupied = propertyBookings.some(b => {
                              const start = parseISO(b.start_date);
                              const end = parseISO(b.end_date);
                              return day >= start && day <= end;
                            });
                            const isWeekStart = i % 7 === 0;
                            
                            return (
                              <div 
                                key={day.toISOString()} 
                                className={`
                                  flex-1 min-w-[40px] min-h-[50px] border-l relative
                                  ${isOccupied ? 'bg-primary/20' : ''}
                                  ${isWeekStart ? 'border-l-2 border-l-muted-foreground/30' : ''}
                                  ${isToday(day) ? 'ring-1 ring-inset ring-primary' : ''}
                                `}
                              >
                                {/* Arrival/Departure indicators */}
                                <div className="absolute inset-0 flex items-center justify-center gap-0.5">
                                  {hasArrival && (
                                    <div className="w-2 h-2 rounded-full bg-green-500" title={t("manager.arrival")} />
                                  )}
                                  {hasDeparture && (
                                    <div className="w-2 h-2 rounded-full bg-amber-500" title={t("manager.departure")} />
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
            
            {/* Legend */}
            <div className="flex justify-center gap-6 py-4 border-t text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-primary/20" />
                <span>{t('calendar.occupiedStatus')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>{t('calendar.arrivalLabel')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span>{t('calendar.departureLabel')}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Month View */}
      {viewMode === 'month' && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t("calendar.monthly")}</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[120px] text-center">
                  {format(currentDate, 'MMMM yyyy', { locale: he })}
                </span>
                <Button variant="outline" size="sm" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Day headers */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'].map((day) => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>
            
            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for alignment */}
              {Array.from({ length: parseISO(format(startOfMonth(currentDate), 'yyyy-MM-dd')).getDay() }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}
              
              {eachDayOfInterval({ 
                start: startOfMonth(currentDate), 
                end: endOfMonth(currentDate) 
              }).map(day => {
                const dayBookings = bookings.filter(b => {
                  const start = parseISO(b.start_date);
                  const end = parseISO(b.end_date);
                  return day >= start && day <= end && 
                    filteredProperties.some(p => p.id === b.property_id);
                });
                const dayArrivals = arrivals.filter(a => 
                  isSameDay(parseISO(a.date), day) &&
                  filteredProperties.some(p => p.id === a.property_id)
                );
                
                const occupiedCount = new Set(dayBookings.map(b => b.property_id)).size;
                const hasArrival = dayArrivals.some(a => a.type === 'arrival');
                const hasDeparture = dayArrivals.some(a => a.type === 'departure');
                
                return (
                  <div
                    key={day.toISOString()}
                    className={`
                      aspect-square p-1 rounded-lg text-center relative
                      transition-all hover:scale-105 cursor-pointer
                      ${isToday(day) ? 'ring-2 ring-primary ring-offset-2' : ''}
                      ${occupiedCount > 0 ? 'bg-primary/20' : 'bg-muted/30 hover:bg-muted/50'}
                    `}
                  >
                    <span className={`text-sm ${isToday(day) ? 'font-bold' : ''}`}>
                      {format(day, 'd')}
                    </span>
                    
                    {occupiedCount > 0 && (
                      <Badge variant="secondary" className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] px-1 py-0">
                        {occupiedCount}
                      </Badge>
                    )}
                    
                    <div className="absolute top-1 left-1 flex gap-0.5">
                      {hasArrival && <div className="w-1.5 h-1.5 rounded-full bg-green-500" />}
                      {hasDeparture && <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                    </div>
                  </div>
                );
              })}
            </div>
            
            {/* Legend */}
            <div className="flex justify-center gap-6 mt-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-primary/20" />
                <span>{t("calendar.occupied")}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span>{t('calendar.arrivalLabel')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-amber-500" />
                <span>{t('calendar.departureLabel')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] px-1">3</Badge>
                <span>{t("calendar.propertiesShown")}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
