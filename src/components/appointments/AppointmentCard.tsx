import type { Appointment } from '@/pages/Appointments';
import { TabletCard } from '@/components/ui/tablet-card';
import { Badge } from '@/components/ui/badge';
import { TabletButton } from '@/components/ui/tablet-button';
import { Phone, Clock, User, Edit, AlertTriangle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

const confirmColors: Record<string, string> = {
  unconfirmed: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  message_sent: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300',
  confirmed_whatsapp: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  confirmed_call: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  double_confirmed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
  called_no_answer: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  called_reschedule: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

function formatTime(time: string) {
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

interface Props {
  appointment: Appointment;
  onUpdateStatus: (id: string, status: string) => void;
  onUpdateConfirmation: (id: string, status: string) => void;
  onEdit: (a: Appointment) => void;
}

export function AppointmentCard({ appointment: apt, onUpdateStatus, onUpdateConfirmation, onEdit }: Props) {
  return (
    <TabletCard className="p-4">
      <div className="flex items-start justify-between gap-4">
        {/* Left: time + patient info */}
        <div className="flex items-start gap-4 flex-1 min-w-0">
          {/* Time column */}
          <div className="flex flex-col items-center min-w-[70px]">
            <div className="flex items-center gap-1 text-lg font-bold text-foreground">
              <Clock className="h-4 w-4 text-primary" />
              {formatTime(apt.appointment_time)}
            </div>
          </div>

          {/* Patient info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold text-foreground truncate">{apt.patient_name}</span>
              {apt.is_new_patient && (
                <Badge variant="secondary" className="text-xs">NEW</Badge>
              )}
              {apt.no_show_count > 0 && (
                <Badge variant="destructive" className="text-xs flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {apt.no_show_count}x No-Show
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                {apt.phone}
              </span>
              <span className="font-medium text-foreground">{apt.service}</span>
              {apt.booked_by && <span>Booked: {apt.booked_by}</span>}
            </div>
          </div>
        </div>

        {/* Right: statuses + actions */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Visit status dropdown */}
          <Select value={apt.status} onValueChange={v => onUpdateStatus(apt.id, v)}>
            <SelectTrigger className={`h-9 w-[140px] text-xs font-medium rounded-full border-0 ${statusColors[apt.status] || ''}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Confirmation status dropdown */}
          <Select value={apt.confirmation_status} onValueChange={v => onUpdateConfirmation(apt.id, v)}>
            <SelectTrigger className={`h-9 w-[165px] text-xs font-medium rounded-full border-0 ${confirmColors[apt.confirmation_status] || ''}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONFIRMATION_OPTIONS.map(s => (
                <SelectItem key={s} value={s} className="capitalize">{s.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <TabletButton variant="ghost" size="icon" onClick={() => onEdit(apt)}>
            <Edit className="h-4 w-4" />
          </TabletButton>
        </div>
      </div>
    </TabletCard>
  );
}
