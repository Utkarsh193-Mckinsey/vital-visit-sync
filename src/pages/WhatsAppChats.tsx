import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { TabletCard } from '@/components/ui/tablet-card';
import { TabletInput } from '@/components/ui/tablet-input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Search, User, ArrowLeft, Clock } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

interface CommRecord {
  id: string;
  appointment_id: string;
  channel: string;
  direction: string;
  message_sent: string | null;
  patient_reply: string | null;
  ai_parsed_intent: string | null;
  created_at: string;
  call_status: string | null;
  call_summary: string | null;
}

interface ConversationThread {
  phone: string;
  patient_name: string;
  last_message: string;
  last_time: string;
  unread: boolean;
  messages: CommRecord[];
}

export default function WhatsAppChats() {
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchChats = async () => {
    // Get all communications with their appointment info
    const { data: comms } = await supabase
      .from('appointment_communications')
      .select('*')
      .eq('channel', 'whatsapp')
      .order('created_at', { ascending: true });

    if (!comms || comms.length === 0) {
      setThreads([]);
      setLoading(false);
      return;
    }

    // Get appointment IDs to fetch phone numbers
    const aptIds = [...new Set(comms.map(c => c.appointment_id))];
    const { data: apts } = await supabase
      .from('appointments')
      .select('id, phone, patient_name')
      .in('id', aptIds);

    const aptMap: Record<string, { phone: string; patient_name: string }> = {};
    (apts || []).forEach(a => { aptMap[a.id] = { phone: a.phone, patient_name: a.patient_name }; });

    // Group by phone
    const phoneMap: Record<string, ConversationThread> = {};
    comms.forEach(c => {
      const apt = aptMap[c.appointment_id];
      if (!apt) return;
      const phone = apt.phone;
      if (!phoneMap[phone]) {
        phoneMap[phone] = {
          phone,
          patient_name: apt.patient_name,
          last_message: '',
          last_time: c.created_at,
          unread: false,
          messages: [],
        };
      }
      phoneMap[phone].messages.push(c);
      const msgText = c.direction === 'inbound' ? c.patient_reply : c.message_sent;
      if (msgText) {
        phoneMap[phone].last_message = msgText;
        phoneMap[phone].last_time = c.created_at;
      }
    });

    // Sort threads by last message time (newest first)
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'appointment_communications' }, fetchChats)
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedPhone]);

  const filtered = threads.filter(t =>
    !search || t.patient_name.toLowerCase().includes(search.toLowerCase()) || t.phone.includes(search)
  );

  const selectedThread = threads.find(t => t.phone === selectedPhone);

  return (
    <PageContainer maxWidth="full">
      <PageHeader
        title="WhatsApp Chats"
        subtitle={`${threads.length} conversations`}
      />

      <div className="flex gap-4 h-[calc(100vh-180px)]">
        {/* Thread list */}
        <div className={`${selectedPhone ? 'hidden md:flex' : 'flex'} flex-col w-full md:w-96 shrink-0`}>
          <div className="mb-3 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <TabletInput
              placeholder="Search by name or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-11"
            />
          </div>
          <ScrollArea className="flex-1">
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
                    className={`w-full text-left p-3 rounded-lg transition-colors ${
                      selectedPhone === thread.phone
                        ? 'bg-primary/10 border border-primary/20'
                        : 'hover:bg-muted/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                        <User className="h-5 w-5 text-green-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-sm text-foreground truncate">{thread.patient_name}</span>
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap ml-2">
                            {formatDistanceToNow(new Date(thread.last_time), { addSuffix: true })}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{thread.last_message}</p>
                        <p className="text-[10px] text-muted-foreground">{thread.phone}</p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Chat view */}
        <div className={`${selectedPhone ? 'flex' : 'hidden md:flex'} flex-col flex-1 border border-border rounded-lg overflow-hidden`}>
          {selectedThread ? (
            <>
              {/* Chat header */}
              <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/30">
                <button
                  className="md:hidden p-1"
                  onClick={() => setSelectedPhone(null)}
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="h-9 w-9 rounded-full bg-green-100 flex items-center justify-center">
                  <User className="h-4 w-4 text-green-700" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">{selectedThread.patient_name}</p>
                  <p className="text-xs text-muted-foreground">{selectedThread.phone}</p>
                </div>
              </div>

              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-3 max-w-2xl mx-auto">
                  {selectedThread.messages.map(msg => {
                    const isInbound = msg.direction === 'inbound';
                    const text = isInbound ? msg.patient_reply : msg.message_sent;
                    if (!text) return null;

                    return (
                      <div
                        key={msg.id}
                        className={`flex ${isInbound ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                            isInbound
                              ? 'bg-muted text-foreground rounded-bl-sm'
                              : 'bg-green-600 text-white rounded-br-sm'
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">{text}</p>
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
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a conversation to view messages</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
