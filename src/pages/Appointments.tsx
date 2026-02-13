import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { TabletCard } from '@/components/ui/tablet-card';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletInput } from '@/components/ui/tablet-input';
import { Badge } from '@/components/ui/badge';
import { Calendar, Plus, Search, Phone, User, Clock, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addDays, subDays, isToday, isTomorrow, isYesterday } from 'date-fns';
import { toast } from 'sonner';
import { AddAppointmentModal } from '@/components/appointments/AddAppointmentModal';
import { AppointmentCard } from '@/components/appointments/AppointmentCard';

export interface Appointment {
  id: string;
  patient_name: string;
  phone: string;
  appointment_date: string;
  appointment_time: string;
  service: string;
  booked_by: string | null;
  status: string;
  confirmation_status: string;
  is_new_patient: boolean;
  no_show_count: number;
  followup_step: number;
  followup_status: string | null;
  last_reply: string | null;
  reminder_24hr_sent: boolean;
  reminder_2hr_sent: boolean;
  confirmed_at: string | null;
  rescheduled_from: string | null;
  created_at: string;
  updated_at: string | null;
}

const STATUS_OPTIONS = ['upcoming', 'checked_in', 'in_treatment', 'completed', 'no_show', 'rescheduled', 'cancelled'];
const CONFIRMATION_OPTIONS = ['unconfirmed', 'message_sent', 'confirmed_whatsapp', 'confirmed_call', 'double_confirmed', 'called_no_answer', 'called_reschedule', 'cancelled'];

export default function Appointments() {
  const { staff } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  const fetchAppointments = async () => {
    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('appointment_date', dateStr)
      .order('appointment_time', { ascending: true });

    if (error) {
      console.error('Error fetching appointments:', error);
      toast.error('Failed to load appointments');
    } else {
      setAppointments((data || []) as Appointment[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    fetchAppointments();
  }, [dateStr]);

  useEffect(() => {
    const channel = supabase
      .channel('appointments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        fetchAppointments();
      })
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [dateStr]);

  const filtered = useMemo(() => {
    let result = appointments;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a =>
        a.patient_name.toLowerCase().includes(q) ||
        a.phone.includes(q) ||
        a.service.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter(a => a.status === statusFilter);
    }
    return result;
  }, [appointments, searchQuery, statusFilter]);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('appointments')
      .update({ status })
      .eq('id', id);
    if (error) toast.error('Failed to update status');
    else toast.success(`Status updated to ${status}`);
  };

  const updateConfirmation = async (id: string, confirmation_status: string) => {
    const updates: Record<string, unknown> = { confirmation_status };
    if (confirmation_status.includes('confirmed')) {
      updates.confirmed_at = new Date().toISOString();
    }
    const { error } = await supabase
      .from('appointments')
      .update(updates)
      .eq('id', id);
    if (error) toast.error('Failed to update confirmation');
    else toast.success(`Confirmation updated`);
  };

  const getDateLabel = () => {
    if (isToday(selectedDate)) return `Today — ${format(selectedDate, 'EEE, MMM d')}`;
    if (isTomorrow(selectedDate)) return `Tomorrow — ${format(selectedDate, 'EEE, MMM d')}`;
    if (isYesterday(selectedDate)) return `Yesterday — ${format(selectedDate, 'EEE, MMM d')}`;
    return format(selectedDate, 'EEEE, MMM d, yyyy');
  };

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = {};
    appointments.forEach(a => { c[a.status] = (c[a.status] || 0) + 1; });
    return c;
  }, [appointments]);

  return (
    <PageContainer maxWidth="full">
      <PageHeader title="Appointments" />
      <div className="space-y-4">
        {/* Date navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TabletButton variant="outline" size="icon" onClick={() => setSelectedDate(d => subDays(d, 1))}>
              <ChevronLeft className="h-5 w-5" />
            </TabletButton>
            <div className="flex items-center gap-2 px-4 py-2 bg-card rounded-xl border border-border">
              <Calendar className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">{getDateLabel()}</span>
            </div>
            <TabletButton variant="outline" size="icon" onClick={() => setSelectedDate(d => addDays(d, 1))}>
              <ChevronRight className="h-5 w-5" />
            </TabletButton>
            {!isToday(selectedDate) && (
              <TabletButton variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())}>
                Today
              </TabletButton>
            )}
            <input
              type="date"
              value={dateStr}
              onChange={e => setSelectedDate(new Date(e.target.value + 'T00:00:00'))}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
            />
          </div>
          <TabletButton onClick={() => { setEditingAppointment(null); setShowAddModal(true); }} leftIcon={<Plus className="h-5 w-5" />}>
            New Appointment
          </TabletButton>
        </div>

        {/* Summary badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant={statusFilter === 'all' ? 'default' : 'outline'} className="cursor-pointer text-sm py-1 px-3" onClick={() => setStatusFilter('all')}>
            All ({appointments.length})
          </Badge>
          {STATUS_OPTIONS.map(s => (
            (statusCounts[s] || 0) > 0 && (
              <Badge key={s} variant={statusFilter === s ? 'default' : 'outline'} className="cursor-pointer text-sm py-1 px-3 capitalize" onClick={() => setStatusFilter(s)}>
                {s.replace('_', ' ')} ({statusCounts[s]})
              </Badge>
            )
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <TabletInput
            placeholder="Search by name, phone, or service..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-11"
          />
        </div>

        {/* Appointments list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <TabletCard className="p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">No appointments found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {appointments.length === 0 ? 'No appointments for this date' : 'No matches for your filter'}
            </p>
          </TabletCard>
        ) : (
          <div className="space-y-3">
            {filtered.map(apt => (
              <AppointmentCard
                key={apt.id}
                appointment={apt}
                onUpdateStatus={updateStatus}
                onUpdateConfirmation={updateConfirmation}
                onEdit={(a) => { setEditingAppointment(a); setShowAddModal(true); }}
              />
            ))}
          </div>
        )}
      </div>

      <AddAppointmentModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        appointment={editingAppointment}
        defaultDate={dateStr}
        onSaved={fetchAppointments}
      />
    </PageContainer>
  );
}
