import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { TabletCard } from '@/components/ui/tablet-card';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletInput } from '@/components/ui/tablet-input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, Plus, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { format, addDays, isToday, isTomorrow, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
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
  reminder_24hr_sent_at: string | null;
  reminder_2hr_sent: boolean;
  reminder_2hr_sent_at: string | null;
  confirmed_at: string | null;
  rescheduled_from: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface AppointmentCommunication {
  id: string;
  appointment_id: string;
  channel: string;
  direction: string;
  message_sent: string | null;
  patient_reply: string | null;
  call_duration_seconds: number | null;
  call_status: string | null;
  call_summary: string | null;
  ai_parsed_intent: string | null;
  ai_confidence: string | null;
  needs_human_review: boolean;
  raw_response: unknown;
  created_at: string;
}

type TabFilter = 'today' | 'tomorrow' | 'this_week' | 'upcoming' | 'past';

export default function Appointments() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabFilter>('tomorrow');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [confirmedOpen, setConfirmedOpen] = useState(true);
  const [unconfirmedOpen, setUnconfirmedOpen] = useState(true);
  const [cancelledOpen, setCancelledOpen] = useState(true);

  const getDateRange = (tab: TabFilter): { from: string; to: string } | { mode: 'past' | 'upcoming' } => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const tmrw = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    switch (tab) {
      case 'today': return { from: today, to: today };
      case 'tomorrow': return { from: tmrw, to: tmrw };
      case 'this_week': {
        const start = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        const end = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd');
        return { from: start, to: end };
      }
      case 'upcoming': return { mode: 'upcoming' };
      case 'past': return { mode: 'past' };
    }
  };

  const fetchAppointments = async () => {
    const range = getDateRange(activeTab);
    let query = supabase.from('appointments').select('*').order('appointment_date').order('appointment_time');

    if ('mode' in range) {
      const today = format(new Date(), 'yyyy-MM-dd');
      if (range.mode === 'upcoming') query = query.gte('appointment_date', today);
      else query = query.lt('appointment_date', today);
    } else {
      query = query.gte('appointment_date', range.from).lte('appointment_date', range.to);
    }

    const { data, error } = await query;
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
  }, [activeTab]);

  useEffect(() => {
    const channel = supabase
      .channel('appointments-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, fetchAppointments)
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, [activeTab]);

  const filtered = useMemo(() => {
    if (!searchQuery) return appointments;
    const q = searchQuery.toLowerCase();
    return appointments.filter(a =>
      a.patient_name.toLowerCase().includes(q) ||
      a.phone.includes(q) ||
      a.service.toLowerCase().includes(q)
    );
  }, [appointments, searchQuery]);

  // Group by confirmation category
  const confirmed = useMemo(() => filtered.filter(a =>
    ['confirmed_whatsapp', 'confirmed_call', 'double_confirmed'].includes(a.confirmation_status) && a.status !== 'cancelled'
  ), [filtered]);

  const unconfirmed = useMemo(() => filtered.filter(a =>
    !['confirmed_whatsapp', 'confirmed_call', 'double_confirmed', 'cancelled'].includes(a.confirmation_status) && a.status !== 'cancelled'
  ), [filtered]);

  const cancelled = useMemo(() => filtered.filter(a =>
    a.status === 'cancelled' || a.confirmation_status === 'cancelled'
  ), [filtered]);

  // Summary stats
  const total = filtered.length;
  const confirmedCount = confirmed.length;
  const unconfirmedCount = unconfirmed.length;
  const cancelledCount = cancelled.length;
  const confirmPct = total > 0 ? Math.round((confirmedCount / total) * 100) : 0;

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('appointments').update({ status }).eq('id', id);
    if (error) toast.error('Failed to update status');
    else toast.success(`Status updated to ${status}`);
  };

  const updateConfirmation = async (id: string, confirmation_status: string) => {
    const updates: Record<string, unknown> = { confirmation_status };
    if (confirmation_status.includes('confirmed')) updates.confirmed_at = new Date().toISOString();
    const { error } = await supabase.from('appointments').update(updates).eq('id', id);
    if (error) toast.error('Failed to update confirmation');
    else toast.success('Confirmation updated');
  };

  const getTabLabel = () => {
    switch (activeTab) {
      case 'today': return `Today — ${format(new Date(), 'EEE, MMM d')}`;
      case 'tomorrow': return `Tomorrow — ${format(addDays(new Date(), 1), 'EEE, MMM d')}`;
      case 'this_week': return 'This Week';
      case 'upcoming': return 'All Upcoming';
      case 'past': return 'Past Appointments';
    }
  };

  return (
    <PageContainer maxWidth="full">
      <PageHeader
        title="Appointments"
        subtitle={getTabLabel()}
        action={
          <TabletButton onClick={() => { setEditingAppointment(null); setShowAddModal(true); }} leftIcon={<Plus className="h-5 w-5" />}>
            New Appointment
          </TabletButton>
        }
      />

      <div className="space-y-5">
        {/* Tab filters */}
        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabFilter)}>
          <TabsList className="h-11">
            <TabsTrigger value="today" className="text-sm px-4">Today</TabsTrigger>
            <TabsTrigger value="tomorrow" className="text-sm px-4">Tomorrow</TabsTrigger>
            <TabsTrigger value="this_week" className="text-sm px-4">This Week</TabsTrigger>
            <TabsTrigger value="upcoming" className="text-sm px-4">All Upcoming</TabsTrigger>
            <TabsTrigger value="past" className="text-sm px-4">Past</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Summary bar */}
        <TabletCard className="p-4">
          <div className="flex items-center gap-6 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold text-foreground">{total}</span>
              <span className="text-sm text-muted-foreground">Total</span>
            </div>
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-sm py-1 px-3">
              ✅ {confirmedCount} Confirmed
            </Badge>
            <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300 text-sm py-1 px-3">
              ⏳ {unconfirmedCount} Unconfirmed
            </Badge>
            <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-sm py-1 px-3">
              ❌ {cancelledCount} Cancelled
            </Badge>
            <div className="flex-1 min-w-[150px] max-w-[300px] ml-auto">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground">Confirmation</span>
                <span className="text-xs font-semibold text-foreground">{confirmPct}%</span>
              </div>
              <Progress value={confirmPct} className="h-2.5 [&>div]:bg-green-500" />
            </div>
          </div>
        </TabletCard>

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

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <TabletCard className="p-8 text-center">
            <Calendar className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">No appointments found</p>
          </TabletCard>
        ) : (
          <div className="space-y-4">
            {/* CONFIRMED section */}
            <CollapsibleSection
              title="Confirmed"
              count={confirmedCount}
              borderColor="border-l-green-500"
              badgeColor="bg-green-100 text-green-800"
              open={confirmedOpen}
              onToggle={() => setConfirmedOpen(v => !v)}
            >
              {confirmed.map(apt => (
                <AppointmentCard key={apt.id} appointment={apt} onUpdateStatus={updateStatus} onUpdateConfirmation={updateConfirmation} onEdit={a => { setEditingAppointment(a); setShowAddModal(true); }} />
              ))}
            </CollapsibleSection>

            {/* UNCONFIRMED section */}
            <CollapsibleSection
              title="Unconfirmed"
              count={unconfirmedCount}
              borderColor="border-l-orange-500"
              badgeColor="bg-orange-100 text-orange-800"
              open={unconfirmedOpen}
              onToggle={() => setUnconfirmedOpen(v => !v)}
            >
              {unconfirmed.map(apt => (
                <AppointmentCard key={apt.id} appointment={apt} onUpdateStatus={updateStatus} onUpdateConfirmation={updateConfirmation} onEdit={a => { setEditingAppointment(a); setShowAddModal(true); }} showReminderStatus />
              ))}
            </CollapsibleSection>

            {/* CANCELLED section */}
            {cancelledCount > 0 && (
              <CollapsibleSection
                title="Cancelled"
                count={cancelledCount}
                borderColor="border-l-gray-400"
                badgeColor="bg-gray-100 text-gray-800"
                open={cancelledOpen}
                onToggle={() => setCancelledOpen(v => !v)}
              >
                {cancelled.map(apt => (
                  <AppointmentCard key={apt.id} appointment={apt} onUpdateStatus={updateStatus} onUpdateConfirmation={updateConfirmation} onEdit={a => { setEditingAppointment(a); setShowAddModal(true); }} showSlotAvailable />
                ))}
              </CollapsibleSection>
            )}
          </div>
        )}
      </div>

      <AddAppointmentModal
        open={showAddModal}
        onOpenChange={setShowAddModal}
        appointment={editingAppointment}
        defaultDate={format(activeTab === 'tomorrow' ? addDays(new Date(), 1) : new Date(), 'yyyy-MM-dd')}
        onSaved={fetchAppointments}
      />
    </PageContainer>
  );
}

// Collapsible section component
function CollapsibleSection({ title, count, borderColor, badgeColor, open, onToggle, children }: {
  title: string;
  count: number;
  borderColor: string;
  badgeColor: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onToggle}>
      <CollapsibleTrigger asChild>
        <TabletCard className={`p-3 cursor-pointer border-l-4 ${borderColor} hover:bg-muted/50 transition-colors`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-semibold text-foreground">{title}</span>
              <Badge className={`${badgeColor} text-xs`}>{count}</Badge>
            </div>
            {open ? <ChevronUp className="h-5 w-5 text-muted-foreground" /> : <ChevronDown className="h-5 w-5 text-muted-foreground" />}
          </div>
        </TabletCard>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className={`ml-2 border-l-4 ${borderColor} pl-3 space-y-2 mt-2`}>
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
