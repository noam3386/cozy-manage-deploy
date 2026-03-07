import { useEffect, useState, useCallback } from 'react';
import { 
  Building2, 
  Calendar, 
  AlertTriangle, 
  CreditCard,
  Sparkles,
  ArrowLeft,
  PlaneLanding,
  PlaneTakeoff,
  Wrench,
  ClipboardCheck,
  SprayCan
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/common/StatCard';
import { PropertyCard } from '@/components/properties/PropertyCard';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { getSignedImageUrl } from '@/hooks/useSignedImageUrl';
import { useTranslation } from 'react-i18next';

interface Property {
  id: string;
  name: string;
  address: string;
  status: string;
  size: number | null;
  floor: string | null;
  image_url: string | null;
}

interface Issue {
  id: string;
  title: string;
  status: string;
  priority: string;
  property_id: string;
}

interface ServiceRequest {
  id: string;
  status: string;
  property_id: string;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
}

interface ArrivalDeparture {
  id: string;
  type: string;
  date: string;
  guest_count: number | null;
  property_id: string;
}

interface RecentActivity {
  id: string;
  type: 'inspection' | 'cleaning';
  date: string;
  property_id: string;
  property_name?: string;
  notes?: string;
}

export default function OwnerDashboard() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [arrivals, setArrivals] = useState<ArrivalDeparture[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [userName, setUserName] = useState('');

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user?.id)
        .single();
      
      if (profile?.full_name) {
        setUserName(profile.full_name);
      }

      const { data: propertiesData } = await supabase
        .from('properties')
        .select('*')
        .eq('owner_id', user?.id);
      
      if (propertiesData) {
        const propertiesWithSignedUrls = await Promise.all(
          propertiesData.map(async (p) => {
            if (p.image_url) {
              const signedUrl = await getSignedImageUrl(p.image_url, 'property-images');
              return { ...p, image_url: signedUrl };
            }
            return p;
          })
        );
        setProperties(propertiesWithSignedUrls);
        
        const propertyIds = propertiesData.map(p => p.id);
        
        if (propertyIds.length > 0) {
          const { data: issuesData } = await supabase
            .from('issues')
            .select('*')
            .in('property_id', propertyIds)
            .in('status', ['new', 'in_progress', 'assigned', 'reviewing']);
          
          if (issuesData) setIssues(issuesData);

          const { data: requestsData } = await supabase
            .from('service_requests')
            .select('*')
            .in('property_id', propertyIds)
            .neq('status', 'completed');
          
          if (requestsData) setServiceRequests(requestsData);

          const today = new Date().toISOString().split('T')[0];
          const { data: arrivalsData } = await supabase
            .from('arrivals_departures')
            .select('*')
            .in('property_id', propertyIds)
            .eq('type', 'arrival')
            .gte('date', today)
            .order('date', { ascending: true })
            .limit(1);
          
          if (arrivalsData) setArrivals(arrivalsData);

          const { data: inspectionsData } = await supabase
            .from('property_inspections')
            .select('id, inspection_date, property_id, notes')
            .in('property_id', propertyIds)
            .order('inspection_date', { ascending: false })
            .limit(5);

          const { data: cleaningData } = await supabase
            .from('property_cleaning_records')
            .select('id, cleaned_at, property_id, notes')
            .in('property_id', propertyIds)
            .order('cleaned_at', { ascending: false })
            .limit(5);

          const activities: RecentActivity[] = [];
          
          if (inspectionsData) {
            inspectionsData.forEach(i => {
              const property = propertiesData?.find(p => p.id === i.property_id);
              activities.push({
                id: i.id,
                type: 'inspection',
                date: i.inspection_date,
                property_id: i.property_id,
                property_name: property?.name,
                notes: i.notes || undefined
              });
            });
          }
          
          if (cleaningData) {
            cleaningData.forEach(c => {
              const property = propertiesData?.find(p => p.id === c.property_id);
              activities.push({
                id: c.id,
                type: 'cleaning',
                date: c.cleaned_at,
                property_id: c.property_id,
                property_name: property?.name,
                notes: c.notes || undefined
              });
            });
          }

          activities.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
          setRecentActivity(activities.slice(0, 5));
        }
      }

      const { data: paymentsData } = await supabase
        .from('payments')
        .select('*')
        .eq('owner_id', user?.id)
        .eq('status', 'pending');
      
      if (paymentsData) setPayments(paymentsData);

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('owner-dashboard-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_requests' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'arrivals_departures' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'property_inspections' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'property_cleaning_records' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchData]);

  const locale = i18n.language === 'he' ? 'he-IL' : i18n.language === 'fr' ? 'fr-FR' : 'en-US';

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale, { 
      day: 'numeric', 
      month: 'short' 
    });
  };

  const openRequests = serviceRequests.length;
  const openIssues = issues.length;
  const pendingPayments = payments;
  const totalPending = pendingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const nextArrival = arrivals[0];

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-16 w-64" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">{t('dashboard.hello')}{userName ? `, ${userName}` : ''}</h2>
          <p className="text-muted-foreground">{t('dashboard.quickSummary')}</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('dashboard.myProperties')}
          value={properties.length}
          subtitle={`${properties.filter(p => p.status === 'occupied').length} ${t('dashboard.rented')}`}
          icon={Building2}
          variant="primary"
        />
        <StatCard
          title={t('dashboard.openRequests')}
          value={openRequests}
          subtitle={t('dashboard.servicesMaintenance')}
          icon={Wrench}
          variant={openRequests > 0 ? 'warning' : 'success'}
        />
        <StatCard
          title={t('dashboard.openIssues')}
          value={openIssues}
          subtitle={t('dashboard.awaitingTreatment')}
          icon={AlertTriangle}
          variant={openIssues > 0 ? 'destructive' : 'success'}
        />
        <StatCard
          title={t('dashboard.forPayment')}
          value={`₪${totalPending.toLocaleString()}`}
          subtitle={t('dashboard.thisMonth')}
          icon={CreditCard}
          variant={totalPending > 0 ? 'warning' : 'success'}
        />
      </div>

      {/* Next Arrival Card */}
      {nextArrival && (
        <Card className="bg-gradient-to-l from-primary/5 to-transparent border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <CardTitle className="text-base">{t('dashboard.nextArrival')}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 text-sm">
                  <PlaneLanding className="w-4 h-4 text-success" />
                  <span className="font-medium">{formatDate(nextArrival.date)}</span>
                </div>
                {nextArrival.guest_count && (
                  <Badge variant="info">{nextArrival.guest_count} {t('dashboard.guests')}</Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Link to="/owner/services">
                  <Button size="sm" variant="outline">{t('dashboard.orderCleaning')}</Button>
                </Link>
                <Link to="/owner/arrivals">
                  <Button size="sm">{t('dashboard.prepareProperty')}</Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Link to="/owner/arrivals">
          <Button variant="quickAction" className="w-full h-auto py-4 flex-col gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium">{t('dashboard.addArrival')}</span>
          </Button>
        </Link>
        <Link to="/owner/services">
          <Button variant="quickAction" className="w-full h-auto py-4 flex-col gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium">{t('dashboard.orderCleaning')}</span>
          </Button>
        </Link>
        <Link to="/owner/issues">
          <Button variant="quickAction" className="w-full h-auto py-4 flex-col gap-2">
            <AlertTriangle className="w-6 h-6 text-warning" />
            <span className="text-sm font-medium">{t('dashboard.reportIssue')}</span>
          </Button>
        </Link>
        <Link to="/owner/payments">
          <Button variant="quickAction" className="w-full h-auto py-4 flex-col gap-2">
            <CreditCard className="w-6 h-6 text-primary" />
            <span className="text-sm font-medium">{t('dashboard.payments')}</span>
          </Button>
        </Link>
      </div>

      {/* Properties */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-foreground">{t('dashboard.myProperties')}</h3>
          <Link to="/owner/properties">
            <Button variant="ghost" size="sm" className="gap-1">
              {t('common.showAll')}
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
        </div>
        {properties.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {properties.slice(0, 3).map((property) => (
              <PropertyCard 
                key={property.id} 
                property={{
                  id: property.id,
                  name: property.name,
                  address: property.address,
                  floor: property.floor || '',
                  size: property.size || 0,
                  status: property.status as 'occupied' | 'vacant' | 'preparing',
                  ownerId: user?.id || '',
                  image: property.image_url || undefined,
                }} 
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              {t('dashboard.noProperties')}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recent Activity */}
      {recentActivity.length > 0 && (
        <Card className="border-primary/20 bg-gradient-to-l from-success/5 to-transparent">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-primary" />
                <CardTitle className="text-base">{t('dashboard.recentActivity')}</CardTitle>
              </div>
              <Link to="/owner/inspections">
                <Button variant="ghost" size="sm">{t('common.showAll')}</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div 
                  key={`${activity.type}-${activity.id}`} 
                  className="flex items-center justify-between p-3 rounded-lg bg-background/50 border"
                >
                  <div className="flex items-center gap-3">
                    {activity.type === 'inspection' ? (
                      <div className="p-2 rounded-full bg-primary/10">
                        <ClipboardCheck className="w-4 h-4 text-primary" />
                      </div>
                    ) : (
                      <div className="p-2 rounded-full bg-success/10">
                        <SprayCan className="w-4 h-4 text-success" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-sm">
                        {activity.type === 'inspection' ? t('dashboard.inspection') : t('dashboard.cleaning')}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {activity.property_name}
                      </p>
                    </div>
                  </div>
                  <div className="text-left">
                    <Badge variant={activity.type === 'inspection' ? 'info' : 'success'}>
                      {activity.type === 'inspection' ? t('dashboard.inspection') : t('dashboard.cleaning')}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(activity.date).toLocaleDateString(locale, { 
                        day: 'numeric', 
                        month: 'short',
                        year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Issues */}
      {openIssues > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{t('dashboard.openIssues')}</CardTitle>
              <Link to="/owner/issues">
                <Button variant="ghost" size="sm">{t('common.showAll')}</Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {issues.slice(0, 2).map((issue) => (
                <div 
                  key={issue.id} 
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <Badge variant={issue.priority as any}>
                      {issue.priority === 'emergency' ? t('issues.emergency') : issue.priority === 'high' ? t('issues.high') : t('issues.normal')}
                    </Badge>
                    <div>
                      <p className="font-medium text-sm">{issue.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {properties.find(p => p.id === issue.property_id)?.name}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">
                    {t(`issues.statuses.${issue.status}`, issue.status)}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
