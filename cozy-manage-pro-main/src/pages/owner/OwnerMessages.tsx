import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Send, Loader2, Paperclip, X, Image as ImageIcon, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
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
}

interface Message {
  id: string;
  property_id: string;
  sender_id: string;
  sender_type: string;
  message: string;
  attachments: string[] | null;
  read: boolean;
  created_at: string;
}

export default function OwnerMessages() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<string>('');
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (user) fetchData();
  }, [user]);

  useEffect(() => {
    if (selectedProperty) { fetchMessages(); markMessagesAsRead(); }
  }, [selectedProperty]);

  useEffect(() => {
    if (!selectedProperty) return;
    const channel = supabase
      .channel('messages-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `property_id=eq.${selectedProperty}` },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => [...prev, newMsg]);
          if (newMsg.sender_type === 'manager') markMessagesAsRead();
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedProperty]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: propertiesData, error } = await supabase.from('properties').select('id, name').eq('owner_id', user?.id);
      if (error) throw error;
      setProperties(propertiesData || []);
      if (propertiesData && propertiesData.length > 0) setSelectedProperty(propertiesData[0].id);
    } catch (error) {
      console.error('Error fetching properties:', error);
      toast.error(t('messages.propertiesLoadError'));
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!selectedProperty) return;
    try {
      const { data, error } = await supabase.from('messages').select('*').eq('property_id', selectedProperty).order('created_at', { ascending: true });
      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const markMessagesAsRead = async () => {
    if (!selectedProperty || !user) return;
    try {
      await supabase.from('messages').update({ read: true }).eq('property_id', selectedProperty).eq('sender_type', 'manager').eq('read', false);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  };

  const uploadFiles = async (): Promise<string[]> => {
    if (selectedFiles.length === 0 || !user) return [];
    setUploading(true);
    const uploadedUrls: string[] = [];
    try {
      for (const file of selectedFiles) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('message-attachments').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('message-attachments').getPublicUrl(fileName);
        uploadedUrls.push(urlData.publicUrl);
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error(t('messages.fileUploadError'));
    } finally {
      setUploading(false);
    }
    return uploadedUrls;
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && selectedFiles.length === 0) || !selectedProperty || !user) return;
    setSending(true);
    try {
      const attachments = await uploadFiles();
      const { error } = await supabase.from('messages').insert({
        property_id: selectedProperty, sender_id: user.id, sender_type: 'owner',
        message: newMessage.trim(), attachments: attachments.length > 0 ? attachments : null,
      });
      if (error) throw error;
      setNewMessage('');
      setSelectedFiles([]);
      toast.success(t('messages.messageSent'));
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error(t('messages.messageError'));
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} ${t('messages.fileTooLarge')}`);
        return false;
      }
      return true;
    });
    setSelectedFiles(prev => [...prev, ...validFiles].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatMessageTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return format(date, 'HH:mm');
    return format(date, 'd/M HH:mm', { locale: i18n.language === 'he' ? he : undefined });
  };

  const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  const getFileName = (url: string) => url.split('/').pop()?.split('-').slice(1).join('-') || t('messages.file');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{t('messages.noProperties')}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] animate-fade-in">
      <div className="mb-4">
        <Select value={selectedProperty} onValueChange={setSelectedProperty}>
          <SelectTrigger className="w-full md:w-64">
            <SelectValue placeholder={t('messages.selectProperty')} />
          </SelectTrigger>
          <SelectContent>
            {properties.map((property) => (
              <SelectItem key={property.id} value={property.id}>{property.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className="flex-1 overflow-hidden">
        <CardContent className="p-4 h-full flex flex-col">
          <div className="flex-1 overflow-y-auto space-y-3 mb-4">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>{t('messages.noMessages')}</p>
                <p className="text-sm">{t('messages.sendToTeam')}</p>
              </div>
            ) : (
              messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender_type === 'owner' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    msg.sender_type === 'owner' ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-muted rounded-bl-md'
                  }`}>
                    {msg.message && <p className="text-sm whitespace-pre-wrap">{msg.message}</p>}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {msg.attachments.map((url, idx) => (
                          isImageUrl(url) ? (
                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                              <img src={url} alt={t('messages.attachment')} className="max-w-full rounded-lg max-h-48 object-cover" />
                            </a>
                          ) : (
                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer"
                              className={`flex items-center gap-2 text-sm underline ${msg.sender_type === 'owner' ? 'text-primary-foreground' : 'text-foreground'}`}>
                              <FileText className="w-4 h-4" />{getFileName(url)}
                            </a>
                          )
                        ))}
                      </div>
                    )}
                    <p className={`text-[10px] mt-1 ${msg.sender_type === 'owner' ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                      {formatMessageTime(msg.created_at)}
                    </p>
                  </div>
                </div>
              ))
            )}
            <div ref={messagesEndRef} />
          </div>

          {selectedFiles.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3 p-2 bg-muted rounded-lg">
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center gap-2 bg-background px-2 py-1 rounded text-sm">
                  {file.type.startsWith('image/') ? <ImageIcon className="w-4 h-4 text-primary" /> : <FileText className="w-4 h-4 text-primary" />}
                  <span className="max-w-[100px] truncate">{file.name}</span>
                  <button onClick={() => removeFile(index)} className="text-muted-foreground hover:text-destructive"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 pt-3 border-t">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden" />
            <Button variant="ghost" size="icon" onClick={() => fileInputRef.current?.click()} disabled={sending || selectedFiles.length >= 5}>
              <Paperclip className="w-5 h-5" />
            </Button>
            <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder={t('messages.writeMessage')} disabled={sending}
              className="flex-1 px-4 py-2 rounded-lg border border-input bg-background text-foreground" />
            <Button size="icon" onClick={sendMessage} disabled={(!newMessage.trim() && selectedFiles.length === 0) || sending || uploading}>
              {sending || uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
