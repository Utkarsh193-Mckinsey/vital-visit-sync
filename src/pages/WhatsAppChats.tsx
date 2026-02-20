import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { TabletInput } from '@/components/ui/tablet-input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Search, User, ArrowLeft, Clock, Send, BellOff, Bell, FileText, Loader2, Plus, List, Trash2, AlertTriangle } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

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

interface WatiTemplate {
  id?: string;
  elementName?: string;
  name?: string;
  body?: string;
  bodyOriginal?: string;
  category?: string;
  status?: string;
}

// Normalize UAE phone: strip +, spaces, dashes, leading 00971/971/0 → bare digits
const normalizePhone = (phone: string) => {
  let p = phone.replace(/[\s\-\(\)\+]/g, '');
  if (p.startsWith('00971')) p = p.slice(5);
  else if (p.startsWith('971') && p.length > 9) p = p.slice(3);
  if (p.startsWith('0')) p = p.slice(1);
  return p;
};

// Extract {{n}} placeholders from template body and return param descriptors
const extractParams = (body: string) => {
  const matches = body.match(/\{\{(\d+)\}\}/g) || [];
  const unique = [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, '')))].sort((a, b) => Number(a) - Number(b));
  return unique.map(n => ({ name: `param_${n}`, label: `Parameter {{${n}}}`, key: n }));
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
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templateParams, setTemplateParams] = useState<Record<string, string>>({});
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false);
  const [listTemplatesOpen, setListTemplatesOpen] = useState(false);
  const [creatingTemplate, setCreatingTemplate] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [watiTemplates, setWatiTemplates] = useState<WatiTemplate[]>([]);
  const [newTemplate, setNewTemplate] = useState({ name: '', body: '', category: 'UTILITY', language: 'en' });

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

  const selectedThread = threads.find(t => t.phone === selectedPhone);

  // Derive current template and its params from watiTemplates
  const currentWatiTemplate = watiTemplates.find(t => (t.elementName || t.name) === selectedTemplate);
  const currentTemplateParams = currentWatiTemplate
    ? extractParams(currentWatiTemplate.body || currentWatiTemplate.bodyOriginal || '')
    : [];

  const fetchWatiTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-wati-templates', {
        body: { action: 'list' },
      });
      if (error) throw error;
      const templates: WatiTemplate[] = data?.messageTemplates || [];
      setWatiTemplates(templates);
      return templates;
    } catch (err: any) {
      toast.error('Failed to fetch templates: ' + (err.message || 'Unknown error'));
      return [];
    } finally {
      setLoadingTemplates(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedPhone || sending) return;
    setSending(true);
    try {
      let watiPhone = selectedPhone.replace(/[\s\-\(\)\+]/g, '');
      if (watiPhone.startsWith('0')) watiPhone = '971' + watiPhone.slice(1);
      if (!watiPhone.startsWith('971') && watiPhone.length <= 10) watiPhone = '971' + watiPhone;

      const { error } = await supabase.functions.invoke('send-whatsapp', {
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
      const msg = err.message || '';
      if (msg.includes('400')) {
        toast.error('Cannot send — patient hasn\'t messaged in 24 hrs. Use the template button 📋 instead.');
      } else {
        toast.error('Failed to send: ' + msg);
      }
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

      if (!currentWatiTemplate) throw new Error('Please select a template');

      const parameters = currentTemplateParams.map(p => ({
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

  const openTemplateModal = async () => {
    setTemplateParams({});
    setTemplateModalOpen(true);
    // Fetch WATI templates from API every time modal opens
    const templates = await fetchWatiTemplates();
    // Auto-select first APPROVED template (skip rejected)
    if (templates.length > 0 && !selectedTemplate) {
      const firstApproved = templates.find(t => t.status === 'APPROVED');
      setSelectedTemplate((firstApproved?.elementName || firstApproved?.name || templates[0].elementName || templates[0].name || ''));
    }
  };

  const handleDeleteTemplate = async (elementName: string) => {
    if (!confirm(`Delete template "${elementName}"? This cannot be undone.`)) return;
    try {
      const { data, error } = await supabase.functions.invoke('manage-wati-templates', {
        body: { action: 'delete', template: { elementName } },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Template deleted');
        const updated = watiTemplates.filter(t => (t.elementName || t.name) !== elementName);
        setWatiTemplates(updated);
        if (selectedTemplate === elementName) setSelectedTemplate('');
      } else {
        toast.error('Failed to delete: ' + JSON.stringify(data?.data || 'Unknown'));
      }
    } catch (err: any) {
      toast.error('Error: ' + (err.message || 'Unknown'));
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.name || !newTemplate.body) {
      toast.error('Please fill in template name and body');
      return;
    }
    setCreatingTemplate(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-wati-templates', {
        body: { action: 'create', template: newTemplate },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('Template submitted for approval!');
        setCreateTemplateOpen(false);
        setNewTemplate({ name: '', body: '', category: 'UTILITY', language: 'en' });
      } else {
        toast.error('Failed: ' + JSON.stringify(data?.data || 'Unknown error'));
      }
    } catch (err: any) {
      toast.error('Error: ' + (err.message || 'Unknown'));
    } finally {
      setCreatingTemplate(false);
    }
  };

  return (
    <PageContainer maxWidth="full">
      {selectedPhone && (selectedThread || phoneParam) ? (
        <>
        <div className="flex flex-col h-[calc(100vh-64px)] -mb-6">
          {/* Chat header */}
          <div className="flex items-center gap-3 p-3 border-b border-border bg-muted/30 shrink-0">
            <button
              className="p-2 rounded-lg hover:bg-muted transition-colors"
              onClick={() => setSelectedPhone(null)}
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
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
              <button
                onClick={openTemplateModal}
                title="Send Template Message"
                className="h-11 w-11 rounded-full border border-input bg-background flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                {loadingTemplates ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              </button>
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

        {/* Template Message Modal */}
        <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Send Template Message</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-2">
              {loadingTemplates ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  <div>
                    <Label>Template</Label>
                    <Select value={selectedTemplate} onValueChange={val => { setSelectedTemplate(val); setTemplateParams({}); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a template..." />
                      </SelectTrigger>
                      <SelectContent>
                        {watiTemplates.map((t, i) => {
                          const tName = t.elementName || t.name || '';
                          const label = tName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                          return (
                            <SelectItem key={t.id || i} value={tName}>
                              <div className="flex items-center gap-2">
                                <span>{label}</span>
                                {t.status && (
                                  <Badge variant={t.status === 'APPROVED' ? 'default' : 'secondary'} className="text-[10px] h-4 px-1">
                                    {t.status}
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* REJECTED warning */}
                  {currentWatiTemplate && currentWatiTemplate.status === 'REJECTED' && (
                    <div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-lg p-3">
                      <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-destructive">Template Rejected</p>
                        <p className="text-xs text-destructive/80 mt-0.5">This template was rejected by WhatsApp. Delete it from the Templates list and resubmit with compliant wording.</p>
                      </div>
                    </div>
                  )}

                  {/* PENDING warning */}
                  {currentWatiTemplate && currentWatiTemplate.status === 'PENDING' && (
                    <div className="flex items-start gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-yellow-700">This template is pending WhatsApp approval and may not send successfully yet.</p>
                    </div>
                  )}

                  {/* Show template body preview */}
                  {currentWatiTemplate && (
                    <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground whitespace-pre-wrap">
                      {currentWatiTemplate.body || currentWatiTemplate.bodyOriginal || '(no body)'}
                    </div>
                  )}

                  {/* Dynamic parameter fields — only show if not rejected */}
                  {currentWatiTemplate?.status !== 'REJECTED' && currentTemplateParams.map(p => (
                    <div key={p.name}>
                      <Label>{p.label}</Label>
                      <TabletInput
                        value={templateParams[p.name] || ''}
                        onChange={e => setTemplateParams(prev => ({ ...prev, [p.name]: e.target.value }))}
                        placeholder={`Value for ${p.label}`}
                      />
                    </div>
                  ))}

                  <div className="flex gap-3">
                    <Button variant="outline" className="w-full" onClick={() => setTemplateModalOpen(false)}>Cancel</Button>
                    <Button
                      className="w-full"
                      onClick={sendTemplateMessage}
                      disabled={sendingTemplate || !selectedTemplate || currentWatiTemplate?.status === 'REJECTED'}
                    >
                      {sendingTemplate ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Sending...</> : 'Send Template'}
                    </Button>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
        </>
      ) : (
        // Thread list view
        <>
          <PageHeader
            title="WhatsApp Chats"
            subtitle={`${threads.length} conversations`}
          />
          <div className="flex gap-2 mb-3">
            <Button variant="outline" size="sm" onClick={async () => { const t = await fetchWatiTemplates(); setWatiTemplates(t); setListTemplatesOpen(true); }} disabled={loadingTemplates} className="gap-1">
              {loadingTemplates ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <List className="h-3.5 w-3.5" />}
              Templates
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCreateTemplateOpen(true)} className="gap-1">
              <Plus className="h-3.5 w-3.5" />
              New Template
            </Button>
          </div>
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

      {/* Create Template Modal */}
      <Dialog open={createTemplateOpen} onOpenChange={setCreateTemplateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create WATI Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label>Template Name *</Label>
              <TabletInput
                value={newTemplate.name}
                onChange={e => setNewTemplate(prev => ({ ...prev, name: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') }))}
                placeholder="e.g. appointment_reminder_24hr"
              />
              <p className="text-xs text-muted-foreground mt-1">Lowercase, underscores only (no spaces)</p>
            </div>
            <div>
              <Label>Category *</Label>
              <Select value={newTemplate.category} onValueChange={v => setNewTemplate(prev => ({ ...prev, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTILITY">Utility</SelectItem>
                  <SelectItem value="MARKETING">Marketing</SelectItem>
                  <SelectItem value="AUTHENTICATION">Authentication</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Language</Label>
              <Select value={newTemplate.language} onValueChange={v => setNewTemplate(prev => ({ ...prev, language: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="ar">Arabic</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Message Body *</Label>
              <Textarea
                value={newTemplate.body}
                onChange={e => setNewTemplate(prev => ({ ...prev, body: e.target.value }))}
                placeholder={"Hi {{1}}, your appointment for {{2}} is at {{3}}.\n\nUse {{1}}, {{2}}, etc. for variables."}
                rows={6}
              />
              <p className="text-xs text-muted-foreground mt-1">Use {'{{1}}'}, {'{{2}}'}, etc. for dynamic parameters</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="w-full" onClick={() => setCreateTemplateOpen(false)}>Cancel</Button>
              <Button className="w-full" onClick={handleCreateTemplate} disabled={creatingTemplate}>
                {creatingTemplate ? <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Submitting...</> : 'Submit for Approval'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* List Templates Modal */}
      <Dialog open={listTemplatesOpen} onOpenChange={setListTemplatesOpen}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>WATI Templates ({watiTemplates.length})</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-3">
              {watiTemplates.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No templates found</p>
              ) : (
                watiTemplates.map((t, i) => {
                  const tName = t.elementName || t.name || '';
                  const isRejected = t.status === 'REJECTED';
                  return (
                    <div key={t.id || i} className={`border rounded-lg p-3 space-y-1 ${isRejected ? 'border-destructive/40 bg-destructive/5' : 'border-border'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isRejected && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                          <span className="font-medium text-sm truncate">{tName}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant={t.status === 'APPROVED' ? 'default' : isRejected ? 'destructive' : 'secondary'} className="text-xs">
                            {t.status || 'Unknown'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => handleDeleteTemplate(tName)}
                            title="Delete template"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">{t.category}</p>
                      <p className="text-sm whitespace-pre-wrap bg-muted/50 p-2 rounded text-foreground">{t.body || t.bodyOriginal || '(no body)'}</p>
                      {isRejected && (
                        <p className="text-xs text-destructive mt-1">⚠ Rejected by WhatsApp — delete and resubmit with compliant wording</p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}

// Per-patient reminder toggle for chat header
function ReminderToggle({ phone }: { phone: string }) {
  const [paused, setPaused] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
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
