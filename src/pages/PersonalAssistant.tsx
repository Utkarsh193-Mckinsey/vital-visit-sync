import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { TabletCard } from '@/components/ui/tablet-card';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletInput } from '@/components/ui/tablet-input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Textarea } from '@/components/ui/textarea';
import {
  Bot, CheckCircle, XCircle, PhoneCall, MessageSquare, Send,
  ChevronDown, ChevronUp, Clock, AlertTriangle, Loader2, Zap,
  CalendarPlus, RotateCcw
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

interface PendingRequest {
  id: string;
  appointment_id: string | null;
  patient_name: string;
  phone: string;
  request_type: string;
  original_message: string | null;
  ai_parsed_details: any;
  ai_confidence: string | null;
  ai_suggested_reply: string | null;
  status: string;
  staff_reply: string | null;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
}

interface AppointmentInfo {
  id: string;
  appointment_date: string;
  appointment_time: string;
  service: string;
  patient_name: string;
  no_show_count: number;
}

type FilterTab = 'all' | 'reschedule' | 'cancellation' | 'inquiry' | 'urgent';
type SortOption = 'newest' | 'oldest' | 'urgency' | 'appointment_date';

const HIGH_VALUE_SERVICES = ['mounjaro', 'prp', 'filler', 'botox', 'exosome', 'stemcell', 'hifu'];

const requestTypeBadge: Record<string, { label: string; className: string }> = {
  reschedule: { label: '🔄 Reschedule', className: 'bg-blue-100 text-blue-800' },
  cancellation: { label: '❌ Cancel', className: 'bg-red-100 text-red-800' },
  inquiry: { label: '❓ Inquiry', className: 'bg-orange-100 text-orange-800' },
  unclear: { label: '❓ Unclear', className: 'bg-orange-100 text-orange-800' },
  new_booking: { label: '📋 New Booking', className: 'bg-green-100 text-green-800' },
};

export default function PersonalAssistant() {
  const { staff } = useAuth();
  const [requests, setRequests] = useState<PendingRequest[]>([]);
  const [appointments, setAppointments] = useState<Record<string, AppointmentInfo>>({});
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<FilterTab>('all');
  const [sort, setSort] = useState<SortOption>('newest');
  const [handledOpen, setHandledOpen] = useState(false);

  // Action states per request
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [showReply, setShowReply] = useState<Record<string, boolean>>({});
  const [altDate, setAltDate] = useState<Record<string, string>>({});
  const [altTime, setAltTime] = useState<Record<string, string>>({});
  const [showAlt, setShowAlt] = useState<Record<string, boolean>>({});
  const [declineReason, setDeclineReason] = useState<Record<string, string>>({});
  const [showDecline, setShowDecline] = useState<Record<string, boolean>>({});
  const [convOpen, setConvOpen] = useState<Record<string, boolean>>({});
  const [comms, setComms] = useState<Record<string, any[]>>({});

  const fetchRequests = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('pending_requests')
      .select('*')
      .order('created_at', { ascending: false });

    const allReqs = (data || []) as PendingRequest[];
    setRequests(allReqs);

    // Fetch linked appointment info
    const aptIds = allReqs
      .map(r => r.appointment_id)
      .filter(Boolean) as string[];

    if (aptIds.length > 0) {
      const uniqueIds = [...new Set(aptIds)];
      const { data: aptData } = await supabase
        .from('appointments')
        .select('id, appointment_date, appointment_time, service, patient_name, no_show_count')
        .in('id', uniqueIds);

      const aptMap: Record<string, AppointmentInfo> = {};
      (aptData || []).forEach((a: any) => { aptMap[a.id] = a as AppointmentInfo; });
      setAppointments(aptMap);
    }

    setLoading(false);
  };

  useEffect(() => {
    fetchRequests();
    const channel = supabase.channel('assistant-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pending_requests' }, fetchRequests)
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  const pending = useMemo(() => requests.filter(r => r.status === 'pending'), [requests]);
  const handledToday = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return requests.filter(r => r.status === 'handled' && r.handled_at && new Date(r.handled_at) >= today);
  }, [requests]);

  const isUrgent = (r: PendingRequest) => {
    const age = Date.now() - new Date(r.created_at).getTime();
    return age > 60 * 60 * 1000; // > 1 hour
  };

  const urgentCount = pending.filter(isUrgent).length;

  const filtered = useMemo(() => {
    let list = pending;
    if (tab === 'reschedule') list = list.filter(r => r.request_type === 'reschedule');
    else if (tab === 'cancellation') list = list.filter(r => r.request_type === 'cancellation');
    else if (tab === 'inquiry') list = list.filter(r => r.request_type === 'inquiry' || r.request_type === 'unclear');
    else if (tab === 'urgent') list = list.filter(isUrgent);

    // Sort
    if (sort === 'oldest') list = [...list].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    else if (sort === 'urgency') list = [...list].sort((a, b) => {
      const aAge = Date.now() - new Date(a.created_at).getTime();
      const bAge = Date.now() - new Date(b.created_at).getTime();
      return bAge - aAge;
    });
    else if (sort === 'appointment_date') list = [...list].sort((a, b) => {
      const aApt = a.appointment_id ? appointments[a.appointment_id] : null;
      const bApt = b.appointment_id ? appointments[b.appointment_id] : null;
      if (!aApt) return 1;
      if (!bApt) return -1;
      return aApt.appointment_date.localeCompare(bApt.appointment_date);
    });

    return list;
  }, [pending, tab, sort, appointments]);

  const handleAction = async (requestId: string, action: string, extraParams: any = {}) => {
    setActionLoading(prev => ({ ...prev, [requestId]: action }));
    try {
      const { error } = await supabase.functions.invoke('handle-pending-request', {
        body: {
          action,
          request_id: requestId,
          staff_name: staff?.full_name || 'Staff',
          ...extraParams,
        },
      });
      if (error) throw error;
      toast.success(
        action === 'approve' ? 'Request approved!' :
        action === 'decline' ? 'Request declined' :
        action === 'reply' ? 'Reply sent' :
        action === 'suggest_alternative' ? 'Alternative suggested' : 'Done'
      );
      // Reset UI states
      setShowReply(prev => ({ ...prev, [requestId]: false }));
      setShowAlt(prev => ({ ...prev, [requestId]: false }));
      setShowDecline(prev => ({ ...prev, [requestId]: false }));
    } catch (e: any) {
      toast.error(e.message || 'Action failed');
    } finally {
      setActionLoading(prev => ({ ...prev, [requestId]: '' }));
    }
  };

  const handleCall = async (requestId: string, appointmentId: string | null) => {
    if (!appointmentId) { toast.error('No appointment linked'); return; }
    setActionLoading(prev => ({ ...prev, [requestId]: 'call' }));
    try {
      const { error } = await supabase.functions.invoke('manual-vapi-call', {
        body: { appointment_id: appointmentId },
      });
      if (error) throw error;
      toast.success('Calling patient...');
    } catch (e: any) {
      toast.error(e.message || 'Call failed');
    } finally {
      setActionLoading(prev => ({ ...prev, [requestId]: '' }));
    }
  };

  const loadConversation = async (requestId: string, appointmentId: string | null) => {
    if (!appointmentId || comms[requestId]) return;
    const { data } = await supabase
      .from('appointment_communications')
      .select('*')
      .eq('appointment_id', appointmentId)
      .order('created_at', { ascending: true });
    setComms(prev => ({ ...prev, [requestId]: data || [] }));
  };

  const isHighValue = (apt: AppointmentInfo | undefined) => {
    if (!apt) return false;
    return HIGH_VALUE_SERVICES.some(s => apt.service.toLowerCase().includes(s));
  };

  return (
    <PageContainer maxWidth="full">
      <PageHeader
        title="Personal Assistant"
        subtitle={`${pending.length} pending | ${handledToday.length} handled today${urgentCount > 0 ? ` | ${urgentCount} urgent` : ''}`}
      />

      <div className="space-y-4">
        {/* Tabs + Sort */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Tabs value={tab} onValueChange={v => setTab(v as FilterTab)}>
            <TabsList className="h-11">
              <TabsTrigger value="all" className="text-sm px-4">All Pending ({pending.length})</TabsTrigger>
              <TabsTrigger value="reschedule" className="text-sm px-4">Reschedule</TabsTrigger>
              <TabsTrigger value="cancellation" className="text-sm px-4">Cancel</TabsTrigger>
              <TabsTrigger value="inquiry" className="text-sm px-4">Inquiry</TabsTrigger>
              <TabsTrigger value="urgent" className="text-sm px-4">🔴 Urgent ({urgentCount})</TabsTrigger>
            </TabsList>
          </Tabs>

          <Select value={sort} onValueChange={v => setSort(v as SortOption)}>
            <SelectTrigger className="h-9 w-[180px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="urgency">Urgency</SelectItem>
              <SelectItem value="appointment_date">Appointment Date</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <TabletCard className="p-8 text-center">
            <Bot className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">No pending requests</p>
            <p className="text-sm text-muted-foreground mt-1">All caught up! 🎉</p>
          </TabletCard>
        ) : (
          <div className="space-y-4">
            {filtered.map(req => {
              const apt = req.appointment_id ? appointments[req.appointment_id] : undefined;
              const parsed = req.ai_parsed_details || {};
              const urgent = isUrgent(req);
              const badge = requestTypeBadge[req.request_type] || requestTypeBadge.inquiry;
              const isLoading = actionLoading[req.id] || '';
              const highValue = isHighValue(apt);
              const canQuickApprove =
                req.ai_confidence === 'high' &&
                req.request_type === 'reschedule' &&
                parsed.new_date && parsed.new_time;

              return (
                <TabletCard
                  key={req.id}
                  className={`p-4 border-l-4 ${urgent ? 'border-l-destructive' : 'border-l-primary'}`}
                >
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`${badge.className} text-xs`}>{badge.label}</Badge>
                      {urgent && <Badge variant="destructive" className="text-xs">⏰ Urgent</Badge>}
                      {highValue && <Badge className="bg-amber-100 text-amber-800 text-xs">💰 High Value</Badge>}
                      {apt && apt.no_show_count > 0 && (
                        <Badge variant="outline" className="text-xs border-destructive text-destructive">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {apt.no_show_count}x No-Show
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}
                    </span>
                  </div>

                  {/* Patient info */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-base">{req.patient_name}</span>
                      <span className="text-sm text-muted-foreground">{req.phone}</span>
                    </div>
                  </div>

                  {/* Current appointment info */}
                  {apt && (
                    <div className="bg-muted/50 rounded-lg p-3 mb-3 text-sm">
                      <span className="text-muted-foreground">Current: </span>
                      <span className="font-medium text-foreground">
                        {format(new Date(apt.appointment_date), 'EEE d MMM')}, {apt.appointment_time} — {apt.service}
                      </span>
                    </div>
                  )}

                  {/* AI parsed request */}
                  {(parsed.new_date || parsed.new_time || parsed.summary) && (
                    <div className="bg-primary/5 rounded-lg p-3 mb-3 text-sm">
                      {req.request_type === 'reschedule' && parsed.new_date && (
                        <p className="font-medium text-foreground">
                          Wants: {parsed.new_date}{parsed.new_time ? ` at ${parsed.new_time}` : ''}
                        </p>
                      )}
                      {parsed.summary && (
                        <p className="text-muted-foreground">{parsed.summary}</p>
                      )}
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs text-muted-foreground">AI Confidence:</span>
                        <span className="text-xs">
                          {req.ai_confidence === 'high' ? '🟢 High' :
                           req.ai_confidence === 'medium' ? '🟡 Medium' : '🔴 Low'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Original message */}
                  {req.original_message && (
                    <p className="text-xs text-muted-foreground mb-3 italic border-l-2 border-muted pl-2">
                      "{req.original_message}"
                    </p>
                  )}

                  {/* Staff reply if exists */}
                  {req.staff_reply && (
                    <div className="bg-green-50 dark:bg-green-900/10 rounded-lg p-2 mb-3 text-xs">
                      <span className="text-muted-foreground">Staff reply: </span>
                      <span className="text-foreground">{req.staff_reply}</span>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {canQuickApprove && (
                      <TabletButton
                        size="sm"
                        className="text-xs h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
                        onClick={() => handleAction(req.id, 'approve', {
                          new_date: parsed.new_date,
                          new_time: parsed.new_time,
                          service: apt?.service,
                        })}
                        disabled={!!isLoading}
                      >
                        {isLoading === 'approve' ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
                        Quick Approve
                      </TabletButton>
                    )}

                    {!canQuickApprove && (req.request_type === 'reschedule' || req.request_type === 'cancellation') && (
                      <TabletButton
                        variant="outline"
                        size="sm"
                        className="text-xs h-9 border-green-500 text-green-700 hover:bg-green-50"
                        onClick={() => handleAction(req.id, 'approve', {
                          new_date: parsed.new_date,
                          new_time: parsed.new_time,
                          service: apt?.service,
                        })}
                        disabled={!!isLoading}
                      >
                        {isLoading === 'approve' ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5 mr-1" />}
                        Approve
                      </TabletButton>
                    )}

                    {req.request_type === 'reschedule' && (
                      <TabletButton
                        variant="outline"
                        size="sm"
                        className="text-xs h-9"
                        onClick={() => setShowAlt(prev => ({ ...prev, [req.id]: !prev[req.id] }))}
                      >
                        <CalendarPlus className="h-3.5 w-3.5 mr-1" />
                        Suggest Alternative
                      </TabletButton>
                    )}

                    <TabletButton
                      variant="outline"
                      size="sm"
                      className="text-xs h-9"
                      onClick={() => setShowReply(prev => ({ ...prev, [req.id]: !prev[req.id] }))}
                    >
                      <MessageSquare className="h-3.5 w-3.5 mr-1" />
                      Reply
                    </TabletButton>

                    <TabletButton
                      variant="outline"
                      size="sm"
                      className="text-xs h-9"
                      onClick={() => handleCall(req.id, req.appointment_id)}
                      disabled={isLoading === 'call'}
                    >
                      {isLoading === 'call' ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <PhoneCall className="h-3.5 w-3.5 mr-1" />}
                      Call
                    </TabletButton>

                    <TabletButton
                      variant="ghost"
                      size="sm"
                      className="text-xs h-9 text-destructive hover:text-destructive"
                      onClick={() => setShowDecline(prev => ({ ...prev, [req.id]: !prev[req.id] }))}
                    >
                      <XCircle className="h-3.5 w-3.5 mr-1" />
                      Decline
                    </TabletButton>
                  </div>

                  {/* Suggest Alternative panel */}
                  {showAlt[req.id] && (
                    <div className="mt-3 p-3 border border-border rounded-lg space-y-2">
                      <div className="flex gap-2">
                        <TabletInput
                          type="date"
                          value={altDate[req.id] || ''}
                          onChange={e => setAltDate(prev => ({ ...prev, [req.id]: e.target.value }))}
                          className="flex-1"
                        />
                        <TabletInput
                          type="time"
                          value={altTime[req.id] || ''}
                          onChange={e => setAltTime(prev => ({ ...prev, [req.id]: e.target.value }))}
                          className="w-[140px]"
                        />
                      </div>
                      <TabletButton
                        size="sm"
                        className="text-xs h-9"
                        onClick={() => handleAction(req.id, 'suggest_alternative', {
                          alt_date: altDate[req.id],
                          alt_time: altTime[req.id],
                        })}
                        disabled={!altDate[req.id] || !altTime[req.id] || isLoading === 'suggest_alternative'}
                      >
                        <Send className="h-3.5 w-3.5 mr-1" />
                        Send Suggestion
                      </TabletButton>
                    </div>
                  )}

                  {/* Reply panel */}
                  {showReply[req.id] && (
                    <div className="mt-3 p-3 border border-border rounded-lg space-y-2">
                      {req.ai_suggested_reply && (
                        <TabletButton
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 text-primary"
                          onClick={() => setReplyText(prev => ({ ...prev, [req.id]: req.ai_suggested_reply || '' }))}
                        >
                          Use AI suggestion
                        </TabletButton>
                      )}
                      <Textarea
                        value={replyText[req.id] || ''}
                        onChange={e => setReplyText(prev => ({ ...prev, [req.id]: e.target.value }))}
                        placeholder="Type your reply..."
                        className="min-h-[80px]"
                      />
                      <TabletButton
                        size="sm"
                        className="text-xs h-9"
                        onClick={() => handleAction(req.id, 'reply', { message: replyText[req.id] })}
                        disabled={!replyText[req.id] || isLoading === 'reply'}
                      >
                        <Send className="h-3.5 w-3.5 mr-1" />
                        Send Reply
                      </TabletButton>
                    </div>
                  )}

                  {/* Decline panel */}
                  {showDecline[req.id] && (
                    <div className="mt-3 p-3 border border-destructive/30 rounded-lg space-y-2">
                      <Textarea
                        value={declineReason[req.id] || ''}
                        onChange={e => setDeclineReason(prev => ({ ...prev, [req.id]: e.target.value }))}
                        placeholder="Decline reason (optional)..."
                        className="min-h-[60px]"
                      />
                      <TabletButton
                        variant="destructive"
                        size="sm"
                        className="text-xs h-9"
                        onClick={() => handleAction(req.id, 'decline', { reason: declineReason[req.id] })}
                        disabled={isLoading === 'decline'}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Confirm Decline
                      </TabletButton>
                    </div>
                  )}

                  {/* Conversation thread */}
                  <Collapsible
                    open={convOpen[req.id] || false}
                    onOpenChange={open => {
                      setConvOpen(prev => ({ ...prev, [req.id]: open }));
                      if (open) loadConversation(req.id, req.appointment_id);
                    }}
                  >
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center gap-1 mt-3 text-xs text-primary hover:underline">
                        <MessageSquare className="h-3.5 w-3.5" />
                        View Full Conversation
                        {convOpen[req.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-2 border-t border-border pt-2 space-y-2 max-h-[300px] overflow-y-auto">
                        {!comms[req.id] ? (
                          <p className="text-xs text-muted-foreground py-2">Loading...</p>
                        ) : comms[req.id].length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2">No communication history</p>
                        ) : (
                          comms[req.id].map((c: any) => (
                            <div key={c.id} className="flex items-start gap-2 text-xs">
                              <span className="mt-0.5">{c.channel === 'whatsapp' ? '📱' : '📞'}</span>
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium capitalize">{c.channel === 'vapi_call' ? 'Voice Call' : c.channel}</span>
                                  <span className="text-muted-foreground">{c.direction}</span>
                                  <span className="text-muted-foreground ml-auto">
                                    {format(new Date(c.created_at), 'MMM d, h:mm a')}
                                  </span>
                                </div>
                                {c.message_sent && <p className="text-muted-foreground">Sent: {c.message_sent}</p>}
                                {c.patient_reply && <p className="text-foreground">Reply: {c.patient_reply}</p>}
                                {c.call_summary && <p className="text-foreground italic">Summary: {c.call_summary}</p>}
                                {c.ai_parsed_intent && (
                                  <Badge variant="outline" className="text-[10px] mt-1">
                                    AI: {c.ai_parsed_intent} ({c.ai_confidence})
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                </TabletCard>
              );
            })}
          </div>
        )}

        {/* Handled Today */}
        {handledToday.length > 0 && (
          <Collapsible open={handledOpen} onOpenChange={setHandledOpen}>
            <CollapsibleTrigger asChild>
              <TabletCard className="p-3 cursor-pointer border-l-4 border-l-green-500 hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-foreground">Handled Today</span>
                    <Badge className="bg-green-100 text-green-800 text-xs">{handledToday.length}</Badge>
                  </div>
                  {handledOpen ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
                </div>
              </TabletCard>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-2 border-l-4 border-l-green-500 pl-3 space-y-2 mt-2">
                {handledToday.map(req => {
                  const badge = requestTypeBadge[req.request_type] || requestTypeBadge.inquiry;
                  return (
                    <TabletCard key={req.id} className="p-3 opacity-75">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge className={`${badge.className} text-[10px]`}>{badge.label}</Badge>
                          <span className="text-sm font-medium text-foreground">{req.patient_name}</span>
                          <span className="text-xs text-muted-foreground">{req.phone}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          {req.staff_reply && <span>{req.staff_reply.substring(0, 40)}...</span>}
                          <span>by {req.handled_by}</span>
                          {req.handled_at && <span>{format(new Date(req.handled_at), 'h:mm a')}</span>}
                        </div>
                      </div>
                    </TabletCard>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>
    </PageContainer>
  );
}
