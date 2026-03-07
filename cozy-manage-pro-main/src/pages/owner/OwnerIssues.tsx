import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { getSignedImageUrl } from '@/hooks/useSignedImageUrl';
import { useTranslation } from 'react-i18next';
import { 
  Plus, Zap, Droplets, Wind, Flame, Wifi, DoorOpen, Bug, HelpCircle,
  Camera, AlertTriangle, ChevronLeft, Send, Pencil, X, Loader2, RefreshCw
} from 'lucide-react';

// Interfaces
interface Property {
  id: string;
  name: string;
}

interface Issue {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  category: string;
  property_id: string;
  approved_budget: number | null;
  images: string[] | null;
}

const issueCategoryIcons: Record<string, any> = {
  electric: Zap,
  plumbing: Droplets,
  ac: Wind,
  gas: Flame,
  internet: Wifi,
  door: DoorOpen,
  pests: Bug,
  other: HelpCircle,
};

const issueCategoryColors: Record<string, string> = {
  electric: 'text-warning',
  plumbing: 'text-info',
  ac: 'text-primary',
  gas: 'text-destructive',
  internet: 'text-muted-foreground',
  door: 'text-foreground',
  pests: 'text-warning',
  other: 'text-muted-foreground',
};

export default function OwnerIssues() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [properties, setProperties] = useState<Property[]>([]);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewingIssue, setViewingIssue] = useState<Issue | null>(null);
  
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [priority, setPriority] = useState<'emergency' | 'high' | 'normal'>('normal');
  const [budget, setBudget] = useState<string>('500');
  const [isCustomBudget, setIsCustomBudget] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploadingImage, setUploadingImage] = useState(false);

  const categoryKeys = ['electric', 'plumbing', 'ac', 'gas', 'internet', 'door', 'pests', 'other'];

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('owner-issues-changes')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'issues' }, (payload) => {
        setIssues(prev => prev.map(issue => issue.id === payload.new.id ? { ...issue, ...payload.new } : issue));
        setViewingIssue(prev => prev && prev.id === payload.new.id ? { ...prev, ...payload.new } : prev);
        toast.info(t('issues.issueUpdatedToast'));
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'issues' }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleRefresh = async () => {
    setLoading(true);
    await fetchData();
    toast.success(t('issues.dataRefreshed'));
  };

  const fetchData = async () => {
    try {
      const { data: propertiesData } = await supabase.from('properties').select('id, name');
      if (propertiesData) setProperties(propertiesData);
      const { data: issuesData } = await supabase.from('issues').select('*').order('created_at', { ascending: false });
      if (issuesData) {
        const issuesWithSignedUrls = await Promise.all(
          issuesData.map(async (issue) => {
            if (issue.images && issue.images.length > 0) {
              const signedImages = await Promise.all(issue.images.map((url: string) => getSignedImageUrl(url, 'issue-images')));
              return { ...issue, images: signedImages };
            }
            return issue;
          })
        );
        setIssues(issuesWithSignedUrls);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!selectedCategory || !selectedProperty || !title) {
      toast.error(t('issues.fillRequired'));
      return;
    }
    setSubmitting(true);
    try {
      const data = {
        property_id: selectedProperty, category: selectedCategory, priority, title, description,
        approved_budget: budget ? parseFloat(budget) : null,
        images: images.length > 0 ? images : null,
      };
      let error;
      if (editingId) {
        ({ error } = await supabase.from('issues').update(data).eq('id', editingId));
      } else {
        ({ error } = await supabase.from('issues').insert({ ...data, status: 'new' }));
      }
      if (error) throw error;
      toast.success(editingId ? t('issues.issueUpdated') : t('issues.issueSubmitted'));
      setShowForm(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error submitting issue:', error);
      toast.error(t('issues.issueSubmitError'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (issue: Issue) => {
    setEditingId(issue.id);
    setSelectedCategory(issue.category);
    setSelectedProperty(issue.property_id);
    setPriority(issue.priority as any);
    setBudget(issue.approved_budget ? String(issue.approved_budget) : '');
    setIsCustomBudget(issue.approved_budget ? !['200', '500', '1000', '2000'].includes(String(issue.approved_budget)) : false);
    setTitle(issue.title);
    setDescription(issue.description || '');
    setImages(issue.images || []);
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingId(null); setSelectedCategory(null); setSelectedProperty('');
    setPriority('normal'); setBudget(''); setIsCustomBudget(false);
    setTitle(''); setDescription(''); setImages([]);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploadingImage(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const filePath = `${user?.id}/${fileName}`;
        const { error: uploadError } = await supabase.storage.from('issue-images').upload(filePath, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from('issue-images').getPublicUrl(filePath);
        return publicUrl;
      });
      const uploadedUrls = await Promise.all(uploadPromises);
      setImages(prev => [...prev, ...uploadedUrls]);
      toast.success(t('issues.imagesUploaded'));
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error(t('issues.imageUploadError'));
    } finally {
      setUploadingImage(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between"><Skeleton className="h-6 w-48" /><Skeleton className="h-9 w-32" /></div>
        <div className="space-y-4">{[...Array(3)].map((_, i) => (<Skeleton key={i} className="h-32" />))}</div>
      </div>
    );
  }

  // View single issue details
  if (viewingIssue) {
    const Icon = issueCategoryIcons[viewingIssue.category] || HelpCircle;
    const color = issueCategoryColors[viewingIssue.category];
    const property = properties.find((p) => p.id === viewingIssue.property_id);

    return (
      <div className="space-y-6 animate-fade-in">
        <Button variant="ghost" onClick={() => setViewingIssue(null)} className="gap-2">
          <ChevronLeft className="w-4 h-4" />
          {t('issues.backToIssues')}
        </Button>
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className={`p-4 rounded-xl bg-muted shrink-0 ${color}`}>
                <Icon className="w-8 h-8" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl">{viewingIssue.title}</CardTitle>
                <p className="text-muted-foreground mt-1">{property?.name}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex gap-3">
              <Badge variant={viewingIssue.priority as any} className="text-base px-4 py-1">
                {t(`issues.${viewingIssue.priority}`, viewingIssue.priority)}
              </Badge>
              <Badge variant="outline" className="text-base px-4 py-1">
                {t(`issues.statuses.${viewingIssue.status}`, viewingIssue.status)}
              </Badge>
            </div>
            {viewingIssue.description && (
              <div>
                <h4 className="font-medium mb-2">{t('issues.description')}</h4>
                <p className="text-muted-foreground whitespace-pre-wrap">{viewingIssue.description}</p>
              </div>
            )}
            {viewingIssue.approved_budget && (
              <div>
                <h4 className="font-medium mb-2">{t('issues.approvedBudget')}</h4>
                <p className="text-2xl font-bold text-primary">₪{viewingIssue.approved_budget}</p>
              </div>
            )}
            {viewingIssue.images && viewingIssue.images.length > 0 && (
              <div>
                <h4 className="font-medium mb-3">{t('issues.photos')}</h4>
                <div className="grid grid-cols-2 gap-3">
                  {viewingIssue.images.map((url, index) => (
                    <img key={index} src={url} alt={`${t('issues.photos')} ${index + 1}`} className="w-full h-48 object-cover rounded-lg border" />
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => { handleEdit(viewingIssue); setViewingIssue(null); }}>
                <Pencil className="w-4 h-4 ml-2" />
                {t('issues.editIssueBtn')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="space-y-6 animate-fade-in">
        <Button variant="ghost" onClick={() => setShowForm(false)} className="gap-2">
          <ChevronLeft className="w-4 h-4" />
          {t('issues.backToIssues')}
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? t('issues.editIssue') : t('issues.newIssue')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Category Selection */}
            <div>
              <label className="block text-sm font-medium mb-3">{t('issues.issueType')}</label>
              <div className="grid grid-cols-4 gap-3">
                {categoryKeys.map((catId) => {
                  const Icon = issueCategoryIcons[catId];
                  const color = issueCategoryColors[catId];
                  return (
                    <button
                      key={catId}
                      onClick={() => setSelectedCategory(catId)}
                      className={`p-4 rounded-lg border text-center transition-all ${
                        selectedCategory === catId ? 'border-primary bg-primary/5 shadow-md' : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <Icon className={`w-6 h-6 mx-auto ${color}`} />
                      <p className="text-xs mt-2 font-medium">{t(`issues.categories.${catId}`)}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Property Selection */}
            <div>
              <label className="block text-sm font-medium mb-3">{t('common.property')}</label>
              <select value={selectedProperty} onChange={(e) => setSelectedProperty(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground">
                <option value="">{t('issues.selectProperty')}</option>
                {properties.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium mb-3">{t('issues.urgency')}</label>
              <div className="flex gap-3">
                <Button variant={priority === 'emergency' ? 'destructive' : 'outline'} onClick={() => setPriority('emergency')} className="flex-1">
                  <AlertTriangle className="w-4 h-4 ml-2" />{t('issues.emergency')}
                </Button>
                <Button variant={priority === 'high' ? 'warning' : 'outline'} onClick={() => setPriority('high')} className="flex-1">
                  {t('issues.high')}
                </Button>
                <Button variant={priority === 'normal' ? 'default' : 'outline'} onClick={() => setPriority('normal')} className="flex-1">
                  {t('issues.normal')}
                </Button>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-3">{t('issues.title')}</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder={t('issues.titlePlaceholder')}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground" />
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-3">{t('issues.description')}</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)}
                placeholder={t('issues.descriptionPlaceholder')}
                className="w-full px-4 py-3 rounded-lg border border-input bg-background text-foreground resize-none" rows={4} />
            </div>

            {/* Photos */}
            <div>
              <label className="block text-sm font-medium mb-3">{t('issues.photos')}</label>
              {images.length > 0 && (
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {images.map((url, index) => (
                    <div key={index} className="relative group">
                      <img src={url} alt={`${t('issues.photos')} ${index + 1}`} className="w-full h-24 object-cover rounded-lg" />
                      <button type="button" onClick={() => removeImage(index)}
                        className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="w-full p-8 border-2 border-dashed border-border rounded-lg hover:border-primary/50 transition-colors cursor-pointer flex flex-col items-center">
                {uploadingImage ? <Loader2 className="w-8 h-8 mx-auto text-muted-foreground animate-spin" /> : <Camera className="w-8 h-8 mx-auto text-muted-foreground" />}
                <p className="text-sm text-muted-foreground mt-2">{uploadingImage ? t('issues.uploadingImages') : t('issues.addPhotos')}</p>
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
              </label>
            </div>

            {/* Budget Approval */}
            <div>
              <label className="block text-sm font-medium mb-3">{t('issues.approvedBudget')} (₪)</label>
              <div className="flex gap-2 flex-wrap">
                {['200', '500', '1000', '2000'].map((amount) => (
                  <Button key={amount} variant={budget === amount && !isCustomBudget ? 'default' : 'outline'}
                    onClick={() => { setBudget(amount); setIsCustomBudget(false); }} size="sm">₪{amount}</Button>
                ))}
                <Button variant={isCustomBudget ? 'default' : 'outline'} onClick={() => setIsCustomBudget(true)} size="sm">
                  {t('issues.customAmount')}
                </Button>
              </div>
              {isCustomBudget && (
                <input type="number" value={budget} onChange={(e) => setBudget(e.target.value)}
                  placeholder={t('issues.enterAmount')}
                  className="w-full mt-3 px-4 py-3 rounded-lg border border-input bg-background text-foreground" />
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <Button className="flex-1" size="lg" onClick={handleSubmit} disabled={submitting}>
                <Send className="w-4 h-4 ml-2" />
                {submitting ? t('issues.submitting') : editingId ? t('common.save') : t('issues.submitIssue')}
              </Button>
              <Button variant="outline" size="lg" onClick={() => setShowForm(false)}>
                {t('common.cancel')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground">{t('issues.backToIssues').replace(t('common.back') + ' ', '')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="w-4 h-4 ml-2" />
            {t('dashboard.reportIssue')}
          </Button>
        </div>
      </div>

      {issues.length > 0 ? (
        <div className="space-y-4">
          {issues.map((issue, index) => {
            const Icon = issueCategoryIcons[issue.category] || HelpCircle;
            const color = issueCategoryColors[issue.category];
            const property = properties.find((p) => p.id === issue.property_id);

            return (
              <Card key={issue.id} hover className="animate-slide-up cursor-pointer"
                style={{ animationDelay: `${index * 0.1}s` }} onClick={() => setViewingIssue(issue)}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className={`p-3 rounded-xl bg-muted shrink-0 ${color}`}><Icon className="w-6 h-6" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-semibold">{issue.title}</h4>
                          <p className="text-sm text-muted-foreground mt-1">{property?.name}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" className="shrink-0"
                            onClick={(e) => { e.stopPropagation(); handleEdit(issue); }}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <div className="flex flex-col items-end gap-2">
                            <Badge variant={issue.priority as any}>{t(`issues.${issue.priority}`, issue.priority)}</Badge>
                            <Badge variant="outline">{t(`issues.statuses.${issue.status}`, issue.status)}</Badge>
                          </div>
                        </div>
                      </div>
                      {issue.description && (
                        <p className="text-sm text-muted-foreground mt-3 line-clamp-2">{issue.description}</p>
                      )}
                      {issue.approved_budget && (
                        <p className="text-xs text-muted-foreground mt-2">{t('issues.approvedBudget')}: ₪{issue.approved_budget}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t('properties.noIssues')}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
