import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { TabletInput } from '@/components/ui/tablet-input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Search, User, ArrowLeft, Clock, Send, BellOff, Bell, FileText, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface WaMsg {
  id: string;
  phone: string;
  patient_name: string | null;
  direction: string;
  message_text: string;
  ai_parsed_intent: string | null;
  created_at: string;
}

interface ConversationThread {
  phone: string;
  patient_name: string;
  last_message: string;
  last_time: string;
  messages: WaMsg[];
}

// Normalize UAE phone: strip +, spaces, dashes, leading 00971/971/0 → bare digits
const normalizePhone = (phone: string) => {
  let p = phone.replace(/[\s\-\(\)\+]/g, '');
  if (p.startsWith('00971')) p = p.slice(5);
  else if (p.startsWith('971') && p.length > 9) p = p.slice(3);
  if (p.startsWith('0')) p = p.slice(1);
  return p;
};

export default function WhatsAppChats() {
  const [searchParams] = useSearchParams();
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const phoneParam = searchParams.get('phone');
  const nameParam = searchParams.get('name');
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState('appointment_reminder_24hr');
  const [templateParams, setTemplateParams] = useState<Record<string, string>>({});
  const [sendingTemplate, setSendingTemplate] = useState(false);

  // Available WATI templates
  const TEMPLATES = [
    {
      name: 'appointment_reminder_24hr',
      label: 'Appointment Reminder (24hr)',
      params: [
        { name: 'patient_name', label: 'Patient Name', key: '1' },
        { name: 'service', label: 'Service', key: '2' },
        { name: 'time', label: 'Time', key: '3' },
      ],
    },
  ];
  const fetchChats = async () => {
    const { data: msgs } = await supabase
      .from('whatsapp_messages')
      .select('*')
      .order('created_at', { ascending: true });

    if (!msgs || msgs.length === 0) {
      setThreads([]);
      setLoading(false);
      return;
    }

    const phoneMap: Record<string, ConversationThread> = {};
    msgs.forEach(m => {
      const phone = m.phone;
      if (!phoneMap[phone]) {
        phoneMap[phone] = {
          phone,
          patient_name: m.patient_name || 'Unknown',
          last_message: '',
          last_time: m.created_at,
          messages: [],
        };
      }
      phoneMap[phone].messages.push(m);
      if (m.patient_name && m.patient_name !== 'Unknown') {
        phoneMap[phone].patient_name = m.patient_name;
      }
      phoneMap[phone].last_message = m.message_text;
      phoneMap[phone].last_time = m.created_at;
    });

    const sorted = Object.values(phoneMap).sort(
      (a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime()
    );

    setThreads(sorted);
    setLoading(false);
  };

  useEffect(() => {
    fetchChats();
    const channel = supabase
      .channel('whatsapp-chats')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'whatsapp_messages' }, fetchChats)
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  // Auto-select thread matching phone param (with normalization)
  useEffect(() => {
    if (phoneParam && threads.length > 0 && !selectedPhone) {
      const normParam = normalizePhone(phoneParam);
      const match = threads.find(t => normalizePhone(t.phone) === normParam);
      if (match) {
        setSelectedPhone(match.phone);
      } else {
        // No matching thread — set the raw param so we show an empty chat
        setSelectedPhone(phoneParam);
      }
    }
  }, [phoneParam, threads, selectedPhone]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedPhone]);

  const filtered = threads.filter(t =>
    !search || t.patient_name.toLowerCase().includes(search.toLowerCase()) || t.phone.includes(search)
  );

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedPhone || sending) return;
    setSending(true);
    try {
      // Normalize phone for WATI: needs 971 prefix without +
      let watiPhone = selectedPhone.replace(/[\s\-\(\)\+]/g, '');
      if (watiPhone.startsWith('0')) watiPhone = '971' + watiPhone.slice(1);
      if (!watiPhone.startsWith('971') && watiPhone.length <= 10) watiPhone = '971' + watiPhone;

      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          phone: watiPhone,
          message: newMessage.trim(),
          patient_name: selectedThread?.patient_name || null,
        },
      });
      if (error) throw error;
      setNewMessage('');
      toast.success('Message sent');
      await fetchChats();
    } catch (err: any) {
      toast.error('Failed to send: ' + (err.message || 'Unknown error'));
    } finally {
      setSending(false);
    }
  };

  const sendTemplateMessage = async () => {
    if (!selectedPhone || sendingTemplate) return;
    setSendingTemplate(true);
    try {
      let watiPhone = selectedPhone.replace(/[\s\-\(\)\+]/g, '');
      if (watiPhone.startsWith('0')) watiPhone = '971' + watiPhone.slice(1);
      if (!watiPhone.startsWith('971') && watiPhone.length <= 10) watiPhone = '971' + watiPhone;

      const template = TEMPLATES.find(t => t.name === selectedTemplate);
      if (!template) throw new Error('Template not found');

      const parameters = template.params.map(p => ({
        name: p.key,
        value: templateParams[p.name] || '',
      }));

      const { error } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          phone: watiPhone,
          template_name: selectedTemplate,
          parameters,
          patient_name: selectedThread?.patient_name || nameParam || null,
        },
      });
      if (error) throw error;
      toast.success('Template message sent');
      setTemplateModalOpen(false);
      setTemplateParams({});
      await fetchChats();
    } catch (err: any) {
      toast.error('Failed: ' + (err.message || 'Unknown error'));
    } finally {
      setSendingTemplate(false);
    }
  };

  const openTemplateModal = () => {
    // Pre-fill params from context
    const thread = selectedThread;
    setTemplateParams({
      patient_name: thread?.patient_name || nameParam || '',
      service: '',
      time: '',
    });
    setTemplateModalOpen(true);
  };

  const selectedThread = threads.find(t => t.phone === selectedPhone);
            <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center">
              <User className="h-5 w-5 text-green-700" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-foreground">
                {selectedThread?.patient_name && selectedThread.patient_name !== 'Unknown'
                  ? selectedThread.patient_name
                  : nameParam || 'Patient'}
              </p>
              <p className="text-xs text-muted-foreground">{selectedThread?.phone || selectedPhone}</p>
            </div>
            <ReminderToggle phone={selectedPhone!} />
          </div>

          {/* Messages area */}
          <ScrollArea className="flex-1 p-4 bg-background min-h-0">
            <div className="space-y-3 max-w-2xl mx-auto">
              {!selectedThread ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No WhatsApp conversation yet for this number</p>
                </div>
              ) : selectedThread.messages.map(msg => {
                const isInbound = msg.direction === 'inbound';
                return (
                  <div key={msg.id} className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                      isInbound
                        ? 'bg-muted text-foreground rounded-bl-sm'
                        : 'bg-green-600 text-white rounded-br-sm'
                    }`}>
                      <p className="text-sm whitespace-pre-wrap">{msg.message_text}</p>
                      <div className={`flex items-center gap-1 mt-1 ${isInbound ? 'text-muted-foreground' : 'text-green-200'}`}>
                        <Clock className="h-2.5 w-2.5" />
                        <span className="text-[10px]">
                          {format(new Date(msg.created_at), 'dd MMM, h:mm a')}
                        </span>
                        {isInbound && msg.ai_parsed_intent && (
                          <Badge variant="outline" className="text-[9px] ml-1 h-4 px-1 border-muted-foreground/30">
                            {msg.ai_parsed_intent}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message input - pinned to bottom */}
          <div className="p-2 border-t border-border bg-muted/30 shrink-0">
            <div className="flex items-center gap-2 max-w-2xl mx-auto">
              <input
                type="text"
                placeholder="Type a message..."
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                className="flex-1 h-11 rounded-full border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                disabled={sending}
              />
              <button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending}
                className="h-11 w-11 rounded-full bg-green-600 text-white flex items-center justify-center hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Thread list view
        <>
          <PageHeader
            title="WhatsApp Chats"
            subtitle={`${threads.length} conversations`}
          />
          <div className="mb-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <TabletInput
              placeholder="Search by name or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-11"
            />
          </div>
          <ScrollArea className="h-[calc(100vh-260px)]">
            <div className="space-y-1">
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="h-10 w-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No WhatsApp conversations yet</p>
                </div>
              ) : (
                filtered.map(thread => (
                  <button
                    key={thread.phone}
                    onClick={() => setSelectedPhone(thread.phone)}
                    className="w-full text-left p-4 rounded-lg transition-colors hover:bg-muted/50 border border-transparent hover:border-border"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <User className="h-6 w-6 text-green-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground truncate">{thread.patient_name}</span>
                          <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                            {formatDistanceToNow(new Date(thread.last_time), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-0.5">{thread.last_message}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{thread.phone}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </>
      )}
    </PageContainer>
  );
}

// Per-patient reminder toggle for chat header
function ReminderToggle({ phone }: { phone: string }) {
  const [paused, setPaused] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Check if this patient's upcoming appointments have reminders paused
    const check = async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data } = await supabase
        .from('appointments')
        .select('reminders_paused')
        .eq('phone', phone)
        .gte('appointment_date', today)
        .neq('status', 'cancelled')
        .limit(1);
      if (data && data.length > 0) {
        setPaused((data[0] as any).reminders_paused ?? false);
      }
    };
    check();
  }, [phone]);

  const toggle = async () => {
    setLoading(true);
    const newVal = !paused;
    const today = new Date().toISOString().split('T')[0];
    await supabase
      .from('appointments')
      .update({ reminders_paused: newVal })
      .eq('phone', phone)
      .gte('appointment_date', today)
      .neq('status', 'cancelled');
    setPaused(newVal);
    setLoading(false);
    toast(newVal ? 'Reminders paused for this patient' : 'Reminders resumed for this patient');
  };

  if (paused === null) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className={`text-xs gap-1 h-8 ${paused ? 'text-green-700 border-green-300' : 'text-destructive border-destructive/30'}`}
      onClick={toggle}
      disabled={loading}
    >
      {paused ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
      {paused ? 'Start' : 'Stop'}
    </Button>
  );
}
