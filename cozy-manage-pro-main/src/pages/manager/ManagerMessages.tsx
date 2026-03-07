import { useTranslation } from 'react-i18next';
import { useState, useEffect, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Send, Loader2, MessageSquare, Paperclip, X, Image as ImageIcon, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { he } from 'date-fns/locale';

interface Property {
  id: string;
  name: string;
  address: string;
  owner_id: string | null;
}

interface Owner {
  id: string;
  full_name: string | null;
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

interface Conversation {
  property: Property;
  owner: Owner | null;
  lastMessage: Message | null;
  unreadCount: number;
}

export default function ManagerMessages() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    if (selectedPropertyId) {
      fetchMessages();
      markMessagesAsRead();
    }
  }, [selectedPropertyId]);

  // Real-time subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel('manager-messages-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as Message;
          
          // Update conversations list
          setConversations(prev => {
            return prev.map(conv => {
              if (conv.property.id === newMsg.property_id) {
                return {
                  ...conv,
                  lastMessage: newMsg,
                  unreadCount: newMsg.sender_type === 'owner' && newMsg.property_id !== selectedPropertyId
                    ? conv.unreadCount + 1
                    : conv.unreadCount
                };
              }
              return conv;
            });
          });

          // Update messages if viewing this conversation
          if (newMsg.property_id === selectedPropertyId) {
            setMessages(prev => [...prev, newMsg]);
            if (newMsg.sender_type === 'owner') {
              markMessagesAsRead();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedPropertyId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async () => {
    setLoading(true);
    try {
      // Get all properties
      const { data: properties, error: propError } = await supabase
        .from('properties')
        .select('id, name, address, owner_id')
        .order('name');

      console.log('Properties fetched:', properties, 'Error:', propError);

      if (propError) throw propError;

      // Get all owners
      const { data: owners, error: ownerError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'owner');

      console.log('Owners fetched:', owners, 'Error:', ownerError);

      if (ownerError) throw ownerError;

      // Get all messages for last message and unread count
      const { data: allMessages, error: msgError } = await supabase
        .from('messages')
        .select('*')
        .order('created_at', { ascending: false });

      console.log('Messages fetched:', allMessages, 'Error:', msgError);

      if (msgError) throw msgError;

      // Build conversations list
      const convs: Conversation[] = (properties || [])
        .filter(p => p.owner_id) // Only properties with owners
        .map(property => {
          const propertyMessages = (allMessages || []).filter(m => m.property_id === property.id);
          const owner = (owners || []).find(o => o.id === property.owner_id) || null;
          const unreadCount = propertyMessages.filter(m => m.sender_type === 'owner' && !m.read).length;
          
          return {
            property: property as Property,
            owner,
            lastMessage: propertyMessages[0] as Message || null,
            unreadCount,
          };
        })
        .sort((a, b) => {
          // Sort by unread first, then by last message time
          if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
          if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
          if (!a.lastMessage && !b.lastMessage) return 0;
          if (!a.lastMessage) return 1;
          if (!b.lastMessage) return -1;
          return new Date(b.lastMessage.created_at).getTime() - new Date(a.lastMessage.created_at).getTime();
        });

      console.log('Final conversations:', convs);
      setConversations(convs);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error(t('messages.conversationsLoadError'));
    } finally {
      setLoading(false);
    }
  };

  const fetchMessages = async () => {
    if (!selectedPropertyId) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('property_id', selectedPropertyId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages((data || []) as Message[]);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const markMessagesAsRead = async () => {
    if (!selectedPropertyId) return;

    try {
      await supabase
        .from('messages')
        .update({ read: true })
        .eq('property_id', selectedPropertyId)
        .eq('sender_type', 'owner')
        .eq('read', false);

      // Update local state
      setConversations(prev => prev.map(conv => {
        if (conv.property.id === selectedPropertyId) {
          return { ...conv, unreadCount: 0 };
        }
        return conv;
      }));
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
        
        const { error: uploadError } = await supabase.storage
          .from('message-attachments')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('message-attachments')
          .getPublicUrl(fileName);

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
    if ((!newMessage.trim() && selectedFiles.length === 0) || !selectedPropertyId || !user) return;

    setSending(true);
    try {
      const attachments = await uploadFiles();
      
      const { error } = await supabase.from('messages').insert({
        property_id: selectedPropertyId,
        sender_id: user.id,
        sender_type: 'manager',
        message: newMessage.trim(),
        attachments: attachments.length > 0 ? attachments : null,
      });

      if (error) throw error;
      setNewMessage('');
      setSelectedFiles([]);
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
    
    if (isToday) {
      return format(date, 'HH:mm');
    }
    return format(date, 'd/M HH:mm', { locale: he });
  };

  const isImageUrl = (url: string) => {
    return /\.(jpg|jpeg|png|gif|webp)$/i.test(url);
  };

  const getFileName = (url: string) => {
    return url.split('/').pop()?.split('-').slice(1).join('-') || t('messages.file');
  };

  const selectedConversation = conversations.find(c => c.property.id === selectedPropertyId);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-180px)] gap-4 animate-fade-in">
      {/* Conversations list */}
      <Card className={`md:w-80 shrink-0 overflow-hidden ${selectedPropertyId ? 'hidden md:block' : ''}`}>
        <CardContent className="p-0">
          <div className="p-4 border-b">
            <h2 className="font-semibold">{t('messages.conversations')}</h2>
          </div>
          <div className="overflow-y-auto max-h-[calc(100vh-280px)]">
            {conversations.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>{t('messages.noConversations')}</p>
              </div>
            ) : (
              conversations.map((conv) => (
                <button
                  key={conv.property.id}
                  onClick={() => setSelectedPropertyId(conv.property.id)}
                  className={`w-full p-4 text-right border-b hover:bg-muted/50 transition-colors ${
                    selectedPropertyId === conv.property.id ? 'bg-muted' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate">{conv.property.name}</p>
                        {conv.unreadCount > 0 && (
                          <Badge variant="default" className="text-[10px] px-1.5">
                            {conv.unreadCount}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {conv.owner?.full_name || t('messages.unknown')}
                      </p>
                      {conv.lastMessage && (
                        <p className="text-xs text-muted-foreground truncate mt-1">
                          {conv.lastMessage.attachments?.length ? '📎 ' : ''}{conv.lastMessage.message || t('messages.attachment')}
                        </p>
                      )}
                    </div>
                    {conv.lastMessage && (
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatMessageTime(conv.lastMessage.created_at)}
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chat area */}
      <Card className={`flex-1 overflow-hidden ${!selectedPropertyId ? 'hidden md:flex' : 'flex'} flex-col`}>
        <CardContent className="p-0 h-full flex flex-col">
          {selectedPropertyId ? (
            <>
              {/* Chat header */}
              <div className="p-4 border-b flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="md:hidden"
                  onClick={() => setSelectedPropertyId(null)}
                >
                  ←
                </Button>
                <div>
                  <p className="font-medium">{selectedConversation?.property.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedConversation?.owner?.full_name || t('messages.unknown')}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <p>{t('messages.noMessages')}</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.sender_type === 'manager' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                          msg.sender_type === 'manager'
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted rounded-bl-md'
                        }`}
                      >
                        {msg.message && (
                          <p className="text-sm whitespace-pre-wrap">{msg.message}</p>
                        )}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2 space-y-2">
                            {msg.attachments.map((url, idx) => (
                              isImageUrl(url) ? (
                                <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                                  <img 
                                    src={url} 
                                    alt={t("messages.attachment")} 
                                    className="max-w-full rounded-lg max-h-48 object-cover"
                                  />
                                </a>
                              ) : (
                                <a 
                                  key={idx} 
                                  href={url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-2 text-sm underline ${
                                    msg.sender_type === 'manager' ? 'text-primary-foreground' : 'text-foreground'
                                  }`}
                                >
                                  <FileText className="w-4 h-4" />
                                  {getFileName(url)}
                                </a>
                              )
                            ))}
                          </div>
                        )}
                        <p className={`text-[10px] mt-1 ${
                          msg.sender_type === 'manager'
                            ? 'text-primary-foreground/70'
                            : 'text-muted-foreground'
                        }`}>
                          {formatMessageTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Selected files preview */}
              {selectedFiles.length > 0 && (
                <div className="flex flex-wrap gap-2 mx-4 mb-2 p-2 bg-muted rounded-lg">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 bg-background px-2 py-1 rounded text-sm">
                      {file.type.startsWith('image/') ? (
                        <ImageIcon className="w-4 h-4 text-primary" />
                      ) : (
                        <FileText className="w-4 h-4 text-primary" />
                      )}
                      <span className="max-w-[100px] truncate">{file.name}</span>
                      <button onClick={() => removeFile(index)} className="text-muted-foreground hover:text-destructive">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Input */}
              <div className="p-4 border-t flex items-center gap-3">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  multiple
                  accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                  className="hidden"
                />
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={sending || selectedFiles.length >= 5}
                >
                  <Paperclip className="w-5 h-5" />
                </Button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                  placeholder={t("messages.writeMessage")}
                  className="flex-1 px-4 py-2 rounded-lg border border-input bg-background text-foreground"
                  disabled={sending}
                />
                <Button
                  size="icon"
                  onClick={sendMessage}
                  disabled={(!newMessage.trim() && selectedFiles.length === 0) || sending || uploading}
                >
                  {sending || uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Send className="w-5 h-5" />
                  )}
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>{t('messages.selectProperty')}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
