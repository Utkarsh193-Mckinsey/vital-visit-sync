import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Appointment, AppointmentCommunication } from '@/pages/Appointments';
import { TabletCard } from '@/components/ui/tablet-card';
import { Badge } from '@/components/ui/badge';
import { TabletButton } from '@/components/ui/tablet-button';
import { Phone, Clock, User, Edit, AlertTriangle, MessageSquare, PhoneCall, ChevronDown, ChevronUp, CheckCircle, Send, Loader2 } from 'lucide-react';
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
    <TabletCard className="p-4">
      <div className="flex items-start justify-between gap-4">
        {/* Left: time + patient info */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          <div className="flex flex-col items-center min-w-[75px]">
            <div className="flex items-center gap-1 text-lg font-bold text-foreground">
              <Clock className="h-4 w-4 text-primary" />
              {formatTime(apt.appointment_time)}
            </div>
            <span className="text-xs text-muted-foreground">{apt.appointment_date}</span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="font-semibold text-foreground">{apt.patient_name}</span>
              {apt.is_new_patient && <Badge variant="secondary" className="text-xs">NEW</Badge>}
              {apt.no_show_count > 0 && (
                <Badge variant="destructive" className="text-xs flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {apt.no_show_count}x No-Show
                </Badge>
              )}
              {showSlotAvailable && (
                <Badge className="bg-blue-100 text-blue-800 text-xs">🔓 Slot Available</Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{apt.phone}</span>
              <span className="font-medium text-foreground">{apt.service}</span>
              {apt.booked_by && <span className="text-xs">Booked: {apt.booked_by}</span>}
            </div>

            {/* Reminder status for unconfirmed */}
            {showReminderStatus && (
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {apt.reminder_24hr_sent && (
                  <Badge variant="outline" className="text-xs">📱 24hr msg sent</Badge>
                )}
                {apt.reminder_2hr_sent && (
                  <Badge variant="outline" className="text-xs border-destructive text-destructive">⚠️ 2hr reminder sent</Badge>
                )}
                {!apt.reminder_24hr_sent && !apt.reminder_2hr_sent && (
                  <Badge variant="outline" className="text-xs">No reminders sent</Badge>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: badges + actions */}
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <Badge className={`${confirm.className} text-xs`}>{confirm.label}</Badge>

          <Select value={apt.status} onValueChange={v => onUpdateStatus(apt.id, v)}>
            <SelectTrigger className={`h-8 w-[130px] text-xs font-medium rounded-full border-0 ${statusColors[apt.status] || ''}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={apt.confirmation_status} onValueChange={v => onUpdateConfirmation(apt.id, v)}>
            <SelectTrigger className="h-8 w-[150px] text-xs font-medium rounded-full border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONFIRMATION_OPTIONS.map(s => (
                <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Call Patient button */}
          <TabletButton
            variant="outline"
            size="sm"
            className="text-xs h-8"
            onClick={handleCallPatient}
            disabled={calling}
          >
            {calling ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> Calling...</>
            ) : (
              <><PhoneCall className="h-3.5 w-3.5 mr-1" /> Call</>
            )}
          </TabletButton>

          {showReminderStatus && (
            <TabletButton variant="outline" size="sm" className="text-xs h-8" onClick={() => onUpdateConfirmation(apt.id, 'confirmed_call')}>
              <CheckCircle className="h-3.5 w-3.5 mr-1" /> Mark Confirmed
            </TabletButton>
          )}

          <TabletButton variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(apt)}>
            <Edit className="h-4 w-4" />
          </TabletButton>
        </div>
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
  );
}
