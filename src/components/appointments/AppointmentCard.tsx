import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Appointment, AppointmentCommunication } from '@/pages/Appointments';
import { TabletCard } from '@/components/ui/tablet-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Clock, User, Edit, AlertTriangle, MessageSquare, MessageCircle, PhoneCall, ChevronDown, ChevronUp, CheckCircle, Send, Loader2, UserPlus, CalendarClock, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { WhatsAppLink } from '@/components/ui/whatsapp-link';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TabletInput } from '@/components/ui/tablet-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_OPTIONS = ['upcoming', 'checked_in', 'in_treatment', 'completed', 'no_show', 'rescheduled', 'cancelled'];
const CONFIRMATION_OPTIONS = ['unconfirmed', 'message_sent', 'confirmed_whatsapp', 'confirmed_call', 'double_confirmed', 'called_no_answer', 'called_reschedule', 'cancelled'];

const statusColors: Record<string, string> = {
  upcoming: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  checked_in: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  in_treatment: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  no_show: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  rescheduled: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const confirmBadge: Record<string, { label: string; className: string }> = {
  unconfirmed: { label: '⏳ Unconfirmed', className: 'bg-yellow-100 text-yellow-800' },
  message_sent: { label: '📱 Msg Sent', className: 'bg-sky-100 text-sky-800' },
  confirmed_whatsapp: { label: 'WhatsApp ✅', className: 'bg-green-100 text-green-800' },
  confirmed_call: { label: 'Call ✅', className: 'bg-green-100 text-green-800' },
  double_confirmed: { label: 'Double ✅', className: 'bg-emerald-100 text-emerald-800' },
  called_no_answer: { label: '📞 No Answer', className: 'bg-orange-100 text-orange-800' },
  called_reschedule: { label: '📞 Reschedule', className: 'bg-amber-100 text-amber-800' },
  cancelled: { label: '❌ Cancelled', className: 'bg-red-100 text-red-800' },
};

function formatTime(time: string) {
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

interface Props {
  appointment: Appointment;
  onUpdateStatus: (id: string, status: string) => void;
  onUpdateConfirmation: (id: string, status: string) => void;
  onEdit: (a: Appointment) => void;
  showReminderStatus?: boolean;
  showSlotAvailable?: boolean;
}

export function AppointmentCard({ appointment: apt, onUpdateStatus, onUpdateConfirmation, onEdit, showReminderStatus, showSlotAvailable }: Props) {
  const [logOpen, setLogOpen] = useState(false);
  const [comms, setComms] = useState<AppointmentCommunication[]>([]);
  const [commsLoaded, setCommsLoaded] = useState(false);
  const [calling, setCalling] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [rescheduling, setRescheduling] = useState(false);
  const navigate = useNavigate();

  const handleRegisterNewPatient = () => {
    const params = new URLSearchParams({
      name: apt.patient_name,
      phone: apt.phone,
      service: apt.service,
      booked_by: apt.booked_by || '',
      appointment_id: apt.id,
    });
    navigate(`/patient/register?${params.toString()}`);
  };

  const handleNoShow = async () => {
    const { error } = await supabase.from('appointments').update({
      status: 'no_show',
      no_show_count: apt.no_show_count + 1,
    }).eq('id', apt.id);
    if (error) toast.error('Failed to mark no-show');
    else toast.success(`${apt.patient_name} marked as No Show`);
  };

  const handleReschedule = async () => {
    if (!rescheduleDate) {
      toast.error('Please select a new date');
      return;
    }
    setRescheduling(true);
    try {
      // Create new appointment with rescheduled_from reference
      const { error: insertError } = await supabase.from('appointments').insert({
        patient_name: apt.patient_name,
        phone: apt.phone,
        service: apt.service,
        booked_by: apt.booked_by,
        appointment_date: rescheduleDate,
        appointment_time: apt.appointment_time,
        is_new_patient: apt.is_new_patient,
        rescheduled_from: apt.id,
        special_instructions: rescheduleReason ? `Rescheduled: ${rescheduleReason}` : apt.special_instructions,
      });
      if (insertError) throw insertError;

      // Update original to rescheduled
      const { error: updateError } = await supabase.from('appointments').update({
        status: 'rescheduled',
      }).eq('id', apt.id);
      if (updateError) throw updateError;

      toast.success(`Rescheduled to ${rescheduleDate}`);
      setShowRescheduleModal(false);
      setRescheduleDate('');
      setRescheduleReason('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to reschedule');
    } finally {
      setRescheduling(false);
    }
  };

  const loadComms = async () => {
    if (commsLoaded) return;
    const { data } = await supabase
      .from('appointment_communications')
      .select('*')
      .eq('appointment_id', apt.id)
      .order('created_at', { ascending: true });
    setComms((data || []) as AppointmentCommunication[]);
    setCommsLoaded(true);
  };

  useEffect(() => {
    if (logOpen && !commsLoaded) loadComms();
  }, [logOpen]);

  const handleCallPatient = async () => {
    setCalling(true);
    try {
      const { data, error } = await supabase.functions.invoke('manual-vapi-call', {
        body: { appointment_id: apt.id },
      });
      if (error) throw error;
      toast.success(`Calling ${apt.patient_name}...`);
      // Refresh comms
      setCommsLoaded(false);
      if (logOpen) loadComms();
    } catch (e: any) {
      toast.error(e.message || 'Failed to initiate call');
    } finally {
      setCalling(false);
    }
  };

  const confirm = confirmBadge[apt.confirmation_status] || confirmBadge.unconfirmed;

  return (
    <>
    <TabletCard className="p-2 space-y-1.5">
      {/* Upper row: info */}
      <div className="flex items-center gap-2 w-full">
        <div className="flex items-center gap-1 min-w-[80px]">
          <Clock className="h-3 w-3 text-primary flex-shrink-0" />
          <div>
            <span className="text-foreground text-[10px]">{formatTime(apt.appointment_time)}</span>
            <span className="text-[9px] text-muted-foreground ml-1">{apt.appointment_date}</span>
          </div>
        </div>

        <Badge className={`${confirm.className} text-[8px] px-1.5 py-0 flex-shrink-0`}>{confirm.label}</Badge>

        <div className="flex items-center gap-1 min-w-[120px]">
          <User className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-foreground text-[10px] truncate block">{apt.patient_name}</span>
            <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
              <Phone className="h-2 w-2" />{apt.phone}
            </span>
          </div>
          
          {apt.is_new_patient && <Badge variant="secondary" className="text-[8px] h-3.5 px-1">NEW</Badge>}
          {apt.no_show_count > 0 && (
            <Badge variant="destructive" className="text-[8px] h-3.5 px-1 flex items-center gap-0.5">
              <AlertTriangle className="h-2 w-2" />{apt.no_show_count}x
            </Badge>
          )}
        </div>

        <span className="text-[10px] text-foreground min-w-[70px]">{apt.service}</span>

        {apt.booked_by && (
          <span className="text-[9px] text-muted-foreground">
            <span className="text-muted-foreground/70">by</span> {apt.booked_by}
          </span>
        )}

        <button
          className="inline-flex items-center gap-0.5 text-green-600 hover:text-green-700 ml-2 flex-shrink-0"
          title="Chat on WhatsApp"
          onClick={e => { e.stopPropagation(); navigate(`/whatsapp?phone=${encodeURIComponent(apt.phone)}&name=${encodeURIComponent(apt.patient_name)}`); }}
        >
          <MessageCircle className="h-3 w-3 fill-current" />
          <span className="text-[10px]">W</span>
        </button>

        {showReminderStatus && (
          <div className="flex items-center gap-0.5">
            {apt.reminder_24hr_sent && <Badge variant="outline" className="text-[8px] h-4 px-1">📱 24hr</Badge>}
            {apt.reminder_2hr_sent && <Badge variant="outline" className="text-[8px] h-4 px-1 border-destructive text-destructive">⚠️ 2hr</Badge>}
            {!apt.reminder_24hr_sent && !apt.reminder_2hr_sent && <Badge variant="outline" className="text-[8px] h-4 px-1">No reminders</Badge>}
          </div>
        )}

        {showSlotAvailable && (
          <Badge className="bg-blue-100 text-blue-800 text-[8px] h-4 px-1">🔓 Slot</Badge>
        )}
      </div>

      {/* Lower row: actions */}
      <div className="flex items-center gap-1 flex-wrap">
        <Select value={apt.status} onValueChange={v => onUpdateStatus(apt.id, v)}>
          <SelectTrigger className={`!h-5 min-h-0 w-auto !text-[6px] !leading-none rounded-full border !py-0 !px-1 gap-0.5 [&_svg]:!h-1.5 [&_svg]:!w-1.5 [&>span]:!line-clamp-none ${statusColors[apt.status] || ''}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="min-w-[80px]">
            {STATUS_OPTIONS.map(s => (
              <SelectItem key={s} value={s} className="capitalize text-[10px] py-1 px-2">{s.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={apt.confirmation_status} onValueChange={v => onUpdateConfirmation(apt.id, v)}>
          <SelectTrigger className="h-5 min-h-0 w-auto text-[6px] leading-none rounded-full border py-0 px-1.5 gap-0.5 [&_svg]:h-2 [&_svg]:w-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="min-w-[100px]">
            {CONFIRMATION_OPTIONS.map(s => (
              <SelectItem key={s} value={s} className="capitalize text-[10px] py-1 px-2">{s.replace(/_/g, ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-5 cursor-pointer hover:bg-accent" onClick={handleCallPatient}>
          {calling ? <Loader2 className="h-2.5 w-2.5 animate-spin mr-0.5" /> : <><PhoneCall className="h-2.5 w-2.5 mr-0.5" /> Call</>}
        </Badge>

        {showReminderStatus && (
          <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-5 cursor-pointer hover:bg-accent" onClick={() => onUpdateConfirmation(apt.id, 'confirmed_call')}>
            <CheckCircle className="h-2.5 w-2.5 mr-0.5" /> Confirm
          </Badge>
        )}

        {apt.status === 'upcoming' && (
          <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-5 cursor-pointer hover:bg-accent" onClick={handleRegisterNewPatient}>
            <UserPlus className="h-2.5 w-2.5 mr-0.5" /> Register
          </Badge>
        )}

        {apt.status !== 'no_show' && apt.status !== 'rescheduled' && apt.status !== 'completed' && apt.status !== 'cancelled' && (
          <>
            <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-5 cursor-pointer hover:bg-accent text-orange-600 border-orange-300" onClick={() => setShowRescheduleModal(true)}>
              <CalendarClock className="h-2.5 w-2.5 mr-0.5" /> Reschedule
            </Badge>
            <Badge variant="outline" className="text-[9px] py-0 px-1.5 h-5 cursor-pointer hover:bg-accent text-destructive border-destructive/30" onClick={handleNoShow}>
              <XCircle className="h-2.5 w-2.5 mr-0.5" /> No Show
            </Badge>
          </>
        )}

        <Badge variant="outline" className="text-[9px] py-0 px-1 h-5 cursor-pointer hover:bg-accent" onClick={() => onEdit(apt)}>
          <Edit className="h-2.5 w-2.5" />
        </Badge>
      </div>

      {/* Expandable Communication Log */}
      <Collapsible open={logOpen} onOpenChange={setLogOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center gap-1 mt-3 text-xs text-primary hover:underline">
            <MessageSquare className="h-3.5 w-3.5" />
            Communication Log
            {logOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="mt-2 border-t border-border pt-2 space-y-2">
            {comms.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No communication logs yet</p>
            ) : (
              comms.map(c => (
                <div key={c.id} className="flex items-start gap-2 text-xs">
                  <span className="mt-0.5">
                    {c.channel === 'whatsapp' ? '📱' : '📞'}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium capitalize">{c.channel === 'vapi_call' ? 'Voice Call' : c.channel}</span>
                      <span className="text-muted-foreground">{c.direction}</span>
                      {c.call_status && (
                        <Badge variant="outline" className={`text-[10px] ${
                          c.call_status === 'answered' ? 'border-green-500 text-green-700' :
                          c.call_status === 'no_answer' ? 'border-orange-500 text-orange-700' :
                          c.call_status === 'voicemail' ? 'border-yellow-500 text-yellow-700' :
                          c.call_status === 'initiated' ? 'border-blue-500 text-blue-700' :
                          ''
                        }`}>
                          {c.call_status === 'initiated' ? '🔄 Calling...' : c.call_status.replace(/_/g, ' ')}
                        </Badge>
                      )}
                      {c.call_duration_seconds && c.call_duration_seconds > 0 && (
                        <span className="text-muted-foreground">⏱ {formatDuration(c.call_duration_seconds)}</span>
                      )}
                      <span className="text-muted-foreground ml-auto">{format(new Date(c.created_at), 'MMM d, h:mm a')}</span>
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

    {/* Reschedule Modal */}
    <Dialog open={showRescheduleModal} onOpenChange={setShowRescheduleModal}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reschedule — {apt.patient_name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label>New Date *</Label>
            <TabletInput type="date" value={rescheduleDate} min={format(new Date(), 'yyyy-MM-dd')} onChange={e => setRescheduleDate(e.target.value)} />
          </div>
          <div>
            <Label>Reason / Remarks</Label>
            <Textarea value={rescheduleReason} onChange={e => setRescheduleReason(e.target.value)} placeholder="e.g. Patient requested later date" rows={3} />
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="w-full" onClick={() => setShowRescheduleModal(false)}>Cancel</Button>
            <Button className="w-full" onClick={handleReschedule} disabled={rescheduling}>
              {rescheduling ? 'Saving...' : 'Confirm Reschedule'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}
