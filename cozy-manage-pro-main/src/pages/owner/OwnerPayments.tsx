import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { CreditCard, Download, Check, Clock, ChevronDown } from 'lucide-react';
import { StatCard } from '@/components/common/StatCard';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';

interface Payment {
  id: string;
  owner_id: string | null;
  property_id: string | null;
  type: string;
  amount: number;
  status: string;
  due_date: string;
  paid_date: string | null;
  description: string | null;
}

interface Property {
  id: string;
  name: string;
}

export default function OwnerPayments() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const statusVariants: Record<string, 'warning' | 'success' | 'destructive'> = {
    pending: 'warning',
    paid: 'success',
    overdue: 'destructive',
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [paymentsRes, propertiesRes] = await Promise.all([
        supabase
          .from('payments')
          .select('*')
          .eq('owner_id', user?.id)
          .order('due_date', { ascending: false }),
        supabase
          .from('properties')
          .select('id, name')
          .eq('owner_id', user?.id)
      ]);

      if (paymentsRes.data) {
        setPayments(paymentsRes.data);
      }
      if (propertiesRes.data) {
        setProperties(propertiesRes.data);
      }
    } catch (error) {
      console.error('Error fetching payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const pending = payments.filter((p) => p.status === 'pending');
  const paid = payments.filter((p) => p.status === 'paid');
  const totalPending = pending.reduce((sum, p) => sum + p.amount, 0);
  const totalPaid = paid.reduce((sum, p) => sum + p.amount, 0);

  const locale = i18n.language === 'he' ? 'he-IL' : i18n.language === 'fr' ? 'fr-FR' : 'en-US';

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getPropertyName = (propertyId: string | null) => {
    if (!propertyId) return null;
    const property = properties.find((p) => p.id === propertyId);
    return property?.name || null;
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-48 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title={t('payments.monthPayment')}
          value={`₪${totalPending.toLocaleString()}`}
          icon={Clock}
          variant="warning"
        />
        <StatCard
          title={t('payments.paidThisMonth')}
          value={`₪${totalPaid.toLocaleString()}`}
          icon={Check}
          variant="success"
        />
        <StatCard
          title={t('payments.pendingCharges')}
          value={pending.length}
          icon={CreditCard}
          variant="primary"
        />
        <StatCard
          title={t('payments.history')}
          value={paid.length}
          subtitle={t('payments.paidCharges')}
          icon={Download}
          variant="default"
        />
      </div>

      {/* Current Month Summary */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">{t('payments.monthlySummary')}</CardTitle>
            <Button variant="ghost" size="sm">
              {new Date().toLocaleString(undefined, { month: 'long', year: 'numeric' })}
              <ChevronDown className="w-4 h-4 mr-2" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CreditCard className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>{t('payments.noPayments')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Monthly Fee */}
              {payments.filter(p => p.type === 'monthly_fee').map((payment) => (
                <div key={payment.id} className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{payment.description || t('payments.monthlyFee')}</p>
                    <p className="text-sm text-muted-foreground">{t('payments.fixedCharge')}</p>
                  </div>
                  <div className="text-left">
                    <p className="font-bold">₪{payment.amount.toLocaleString()}</p>
                    <Badge variant={statusVariants[payment.status]} className="mt-1">
                      {t(`payments.statuses.${payment.status}`)}
                    </Badge>
                  </div>
                </div>
              ))}

              {/* Services */}
              {payments
                .filter((p) => p.type !== 'monthly_fee')
                .map((payment) => {
                  const propertyName = getPropertyName(payment.property_id);
                  return (
                    <div key={payment.id} className="flex items-center justify-between p-4 rounded-lg border">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${
                          payment.status === 'paid' ? 'bg-success' : 'bg-warning'
                        }`} />
                        <div>
                          <p className="font-medium">{payment.description || t('payments.charge')}</p>
                          {propertyName && (
                            <p className="text-sm text-muted-foreground">{propertyName}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-left">
                        <p className="font-bold">₪{payment.amount.toLocaleString()}</p>
                        <Badge variant={statusVariants[payment.status]} className="mt-1">
                          {t(`payments.statuses.${payment.status}`)}
                        </Badge>
                      </div>
                    </div>
                  );
                })}

              {/* Total */}
              {totalPending > 0 && (
                <div className="flex items-center justify-between p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <div>
                    <p className="font-bold text-lg">{t('payments.totalToPay')}</p>
                    <p className="text-sm text-muted-foreground">{t('payments.excludingPaid')}</p>
                  </div>
                  <p className="text-2xl font-bold text-primary">₪{totalPending.toLocaleString()}</p>
                </div>
              )}
            </div>
          )}

          {/* Pay Button */}
          {totalPending > 0 && (
            <div className="mt-6 flex gap-3">
              <Button className="flex-1" size="lg">
                <CreditCard className="w-4 h-4 ml-2" />
                {t('payments.payNow')}
              </Button>
              <Button variant="outline" size="lg">
                <Download className="w-4 h-4 ml-2" />
                {t('payments.downloadInvoice')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      {paid.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('payments.paymentHistory')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {paid.map((payment) => (
                <div 
                  key={payment.id} 
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <Check className="w-5 h-5 text-success" />
                    <div>
                      <p className="font-medium">{payment.description || t('payments.charge')}</p>
                      <p className="text-sm text-muted-foreground">
                        {t('payments.paidOn')}{payment.paid_date && formatDate(payment.paid_date)}
                      </p>
                    </div>
                  </div>
                  <div className="text-left">
                    <p className="font-medium">₪{payment.amount.toLocaleString()}</p>
                    <Button variant="ghost" size="sm" className="h-auto p-0 text-primary">
                      {t('payments.receipt')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
