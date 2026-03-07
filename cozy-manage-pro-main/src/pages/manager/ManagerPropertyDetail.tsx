import { useTranslation } from 'react-i18next';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowRight, Building2, User, MapPin, Wrench, AlertTriangle, FileText, DollarSign, Home, MessageCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { getSignedImageUrl } from '@/hooks/useSignedImageUrl';

interface Property {
  id: string;
  name: string;
  address: string;
  floor: string | null;
  size: number | null;
  status: string;
  owner_id: string | null;
  notes: string | null;
  image_url: string | null;
}

interface Owner {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
}

interface ServiceRequest {
  id: string;
  type: string;
  status: string;
  date: string;
  notes: string | null;
  created_at: string;
}

interface Issue {
  id: string;
  title: string;
  category: string;
  priority: string;
  status: string;
  created_at: string;
}

interface ArrivalDeparture {
  id: string;
  type: string;
  date: string;
  status: string;
  guest_count: number | null;
}

const requestStatusLabels: Record<string, string> = {}; // replaced by i18n

export default function ManagerPropertyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState<Property | null>(null);
  const [owner, setOwner] = useState<Owner | null>(null);
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [arrivals, setArrivals] = useState<ArrivalDeparture[]>([]);
  const [signedImageUrl, setSignedImageUrl] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!id) return;
    
    try {
      // Fetch property
      const { data: propertyData, error: propertyError } = await supabase
        .from('properties')
        .select('*')
        .eq('id', id)
        .single();

      if (propertyError) throw propertyError;
      setProperty(propertyData);

      // Get signed image URL
      if (propertyData.image_url) {
        const signedUrl = await getSignedImageUrl(propertyData.image_url, 'property-images');
        setSignedImageUrl(signedUrl);
      }

      // Fetch owner if exists
      if (propertyData.owner_id) {
        const { data: ownerData } = await supabase
          .from('profiles')
          .select('id, full_name, email, phone')
          .eq('id', propertyData.owner_id)
          .single();
        
        if (ownerData) setOwner(ownerData);
      }

      // Fetch service requests
      const { data: servicesData } = await supabase
        .from('service_requests')
        .select('*')
        .eq('property_id', id)
        .order('created_at', { ascending: false });
      
      setServiceRequests(servicesData || []);

      // Fetch issues
      const { data: issuesData } = await supabase
        .from('issues')
        .select('*')
        .eq('property_id', id)
        .order('created_at', { ascending: false });
      
      setIssues(issuesData || []);

      // Fetch arrivals/departures
      const { data: arrivalsData } = await supabase
        .from('arrivals_departures')
        .select('*')
        .eq('property_id', id)
        .order('date', { ascending: false });
      
      setArrivals(arrivalsData || []);

    } catch (error) {
      console.error('Error fetching property:', error);
      toast.error(t('common.error'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'occupied':
        return <Badge variant="default">{t('properties.occupied')}</Badge>;
      case 'vacant':
        return <Badge variant="secondary">{t('properties.vacant')}</Badge>;
      case 'preparing':
        return <Badge variant="outline" className="border-amber-500 text-amber-600">{t('properties.preparing')}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'emergency':
        return <Badge variant="destructive">{t('issues.emergency')}</Badge>;
      case 'high':
        return <Badge variant="destructive" className="bg-orange-500">{t('issues.high')}</Badge>;
      default:
        return <Badge variant="outline">{t('issues.normal')}</Badge>;
    }
  };

  const getRequestStatusBadge = (status: string) => {
    switch (status) {
      case 'new':
        return <Badge variant="default">{requestStatusLabels[status]}</Badge>;
      case 'in_progress':
        return <Badge className="bg-blue-500">{requestStatusLabels[status]}</Badge>;
      case 'completed':
        return <Badge className="bg-green-500">{requestStatusLabels[status]}</Badge>;
      default:
        return <Badge variant="outline">{requestStatusLabels[status] || status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!property) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('properties.notFound')}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/manager/properties')}>
          {t("properties.backToList")}
        </Button>
      </div>
    );
  }

  const openRequests = serviceRequests.filter(r => ['new', 'confirmed', 'in_progress'].includes(r.status));
  const openIssues = issues.filter(i => !['completed', 'closed', 'cancelled'].includes(i.status));

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/manager/properties')}>
          <ArrowRight className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{property.name}</h1>
            {getStatusBadge(property.status)}
          </div>
          <p className="text-muted-foreground flex items-center gap-1 mt-1">
            <MapPin className="h-4 w-4" />
            {property.address}
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="flex flex-wrap h-auto gap-1 p-1 mb-6 w-full justify-start">
          <TabsTrigger value="overview" className="flex-shrink-0 text-sm px-3 py-2">{t('properties.overview')}</TabsTrigger>
          <TabsTrigger value="requests" className="flex-shrink-0 text-sm px-3 py-2">{t('properties.serviceRequests')}</TabsTrigger>
          <TabsTrigger value="actions" className="flex-shrink-0 text-sm px-3 py-2">{t('properties.maintenanceActions')}</TabsTrigger>
          <TabsTrigger value="summary" className="flex-shrink-0 text-sm px-3 py-2">{t('properties.monthlySummary')}</TabsTrigger>
          <TabsTrigger value="documents" className="flex-shrink-0 text-sm px-3 py-2">{t('properties.documents')}</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Property Image & Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {t("properties.propertyDetails")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {signedImageUrl && (
                  <img 
                    src={signedImageUrl} 
                    alt={property.name} 
                    className="w-full h-48 object-cover rounded-lg"
                  />
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {property.floor && (
                    <div>
                      <span className="text-muted-foreground">{t('properties.floor')}:</span>
                      <span className="mr-2 font-medium">{property.floor}</span>
                    </div>
                  )}
                  {property.size && (
                    <div>
                      <span className="text-muted-foreground">{t('properties.size')}:</span>
                      <span className="mr-2 font-medium">{property.size} sqm</span>
                    </div>
                  )}
                </div>
                {property.notes && (
                  <p className="text-sm text-muted-foreground">{property.notes}</p>
                )}
              </CardContent>
            </Card>

            {/* Owner Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {t("properties.owner")}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {owner ? (
                  <div className="space-y-3">
                    <p className="font-medium text-lg">{owner.full_name || t('common.notSpecified')}</p>
                    {owner.email && (
                      <p className="text-sm text-muted-foreground">{owner.email}</p>
                    )}
                    {owner.phone && (
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted-foreground">{owner.phone}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => {
                            const phoneNum = owner.phone?.replace(/\D/g, '');
                            const whatsappUrl = phoneNum 
                              ? `https://wa.me/${phoneNum.startsWith('0') ? '972' + phoneNum.slice(1) : phoneNum}`
                              : '';
                            if (whatsappUrl) window.open(whatsappUrl, '_blank');
                          }}
                        >
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">{t('properties.notAssigned')}</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-blue-100 text-blue-600">
                    <Wrench className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{openRequests.length}</p>
                    <p className="text-sm text-muted-foreground">{t('properties.openRequests')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-red-100 text-red-600">
                    <AlertTriangle className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{openIssues.length}</p>
                    <p className="text-sm text-muted-foreground">{t('properties.openIssues')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-100 text-green-600">
                    <Home className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{arrivals.filter(a => a.type === 'arrival' && new Date(a.date) >= new Date()).length}</p>
                    <p className="text-sm text-muted-foreground">{t('properties.upcomingArrivals')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-purple-100 text-purple-600">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{serviceRequests.filter(r => r.status === 'completed').length}</p>
                    <p className="text-sm text-muted-foreground">{t('properties.completedServices')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Service Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('properties.serviceRequests')}</CardTitle>
              <CardDescription>{t('properties.allServiceRequests')}</CardDescription>
            </CardHeader>
            <CardContent>
              {serviceRequests.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t('properties.noServiceRequests')}</p>
              ) : (
                <div className="space-y-3">
                  {serviceRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-full bg-primary/10">
                          <Wrench className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{t(`manager.serviceTypes.${request.type}`, { defaultValue: request.type })}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(request.date), 'dd/MM/yyyy', { locale: he })}
                          </p>
                        </div>
                      </div>
                      {getRequestStatusBadge(request.status)}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Actions/Maintenance Tab */}
        <TabsContent value="actions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('properties.issuesMaintenance')}</CardTitle>
              <CardDescription>{t('properties.allIssues')}</CardDescription>
            </CardHeader>
            <CardContent>
              {issues.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">{t('properties.noIssues')}</p>
              ) : (
                <div className="space-y-3">
                  {issues.map((issue) => (
                    <div key={issue.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-4">
                        <div className="p-2 rounded-full bg-red-100">
                          <AlertTriangle className="h-4 w-4 text-red-600" />
                        </div>
                        <div>
                          <p className="font-medium">{issue.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {t(`issues.categories.${issue.category}`, { defaultValue: issue.category })} • {format(new Date(issue.created_at), 'dd/MM/yyyy', { locale: he })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getPriorityBadge(issue.priority)}
                        {getRequestStatusBadge(issue.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Monthly Summary Tab */}
        <TabsContent value="summary" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                {t("properties.monthlySummary")}
              </CardTitle>
              <CardDescription>{t("payments.monthlySummary")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <div className="flex justify-between items-center py-2 border-b">
                  <span>{t("payments.monthlyFee")}</span>
                  <span className="font-medium">₪450</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span>{t("payments.charge")}</span>
                  <span className="font-medium">₪150</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span>{t("nav.services")}</span>
                  <span className="font-medium">₪0</span>
                </div>
                <div className="flex justify-between items-center py-2 font-bold text-lg">
                  <span>{t("payments.totalToPay")}</span>
                  <span>₪600</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{t("common.optional")}</Badge>
                <span>{t("properties.notAssigned")}</span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Documents Tab */}
        <TabsContent value="documents" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {t("properties.documents")}
              </CardTitle>
              <CardDescription>{t("properties.documents")}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-center py-8">{t('common.noData')}</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
