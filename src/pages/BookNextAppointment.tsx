import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { TabletCard } from '@/components/ui/tablet-card';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletInput } from '@/components/ui/tablet-input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CalendarPlus, Search, User, Phone, Package, Clock, CheckCircle, PhoneCall, XCircle, RefreshCw } from 'lucide-react';
import { WhatsAppLink } from '@/components/ui/whatsapp-link';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface CompletedVisit {
  id: string;
  patient_id: string;
  visit_number: number;
  completed_date: string;
  next_appointment_status: string | null;
  patient: {
    full_name: string;
    phone_number: string;
  };
  activePackages: {
    id: string;
    sessions_remaining: number;
    treatment: { treatment_name: string };
  }[];
  bookedAppointment?: {
    appointment_date: string;
    appointment_time: string;
    service: string;
  } | null;
}

type TabFilter = 'pending' | 'will_call' | 'handled';

export default function BookNextAppointment() {
  const [visits, setVisits] = useState<CompletedVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<TabFilter>('pending');
  const [bookingVisit, setBookingVisit] = useState<CompletedVisit | null>(null);
  const [bookForm, setBookForm] = useState({ date: '', time: '10:00', service: '', notes: '' });
  const [treatments, setTreatments] = useState<{ id: string; treatment_name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  const fetchVisits = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error } = await supabase
      .from('visits')
      .select(`
        id, patient_id, visit_number, completed_date, next_appointment_status,
        patient:patients (full_name, phone_number)
      `)
      .eq('current_status', 'completed')
      .gte('completed_date', today.toISOString())
      .lt('completed_date', tomorrow.toISOString())
      .order('completed_date', { ascending: false });

    if (error) {
      console.error('Error fetching visits:', error);
      setLoading(false);
      return;
    }

    // For each visit, fetch active packages for that patient
    const visitsWithPackages: CompletedVisit[] = [];
    const patientIds = [...new Set((data || []).map((v: any) => v.patient_id))];
    
    let packagesMap: Record<string, any[]> = {};
    if (patientIds.length > 0) {
      const { data: pkgs } = await supabase
        .from('packages')
        .select('id, patient_id, sessions_remaining, treatment:treatments(treatment_name)')
        .eq('status', 'active')
        .in('patient_id', patientIds);
      
      (pkgs || []).forEach((pkg: any) => {
        if (!packagesMap[pkg.patient_id]) packagesMap[pkg.patient_id] = [];
        packagesMap[pkg.patient_id].push(pkg);
      });
    }

    // For handled/booked visits, fetch the booked appointment
    const bookedVisitIds = (data || []).filter((v: any) => v.next_appointment_status === 'booked').map((v: any) => v.patient_id);
    let bookedAppointmentsMap: Record<string, any> = {};
    if (bookedVisitIds.length > 0) {
      const { data: bookedApts } = await supabase
        .from('appointments')
        .select('patient_name, phone, appointment_date, appointment_time, service')
        .eq('booked_by', 'Follow-up')
        .in('phone', (data || []).filter((v: any) => v.next_appointment_status === 'booked').map((v: any) => v.patient?.phone_number))
        .order('created_at', { ascending: false });

      // Map by phone to the latest appointment
      (bookedApts || []).forEach((apt: any) => {
        if (!bookedAppointmentsMap[apt.phone]) {
          bookedAppointmentsMap[apt.phone] = apt;
        }
      });
    }

    (data || []).forEach((v: any) => {
      const bookedApt = v.next_appointment_status === 'booked' ? bookedAppointmentsMap[v.patient?.phone_number] || null : null;
      visitsWithPackages.push({
        ...v,
        activePackages: packagesMap[v.patient_id] || [],
        bookedAppointment: bookedApt,
      });
    });

    setVisits(visitsWithPackages);
    setLoading(false);
  };

  useEffect(() => {
    fetchVisits();
    supabase.from('treatments').select('id, treatment_name').eq('status', 'active').then(({ data }) => {
      if (data) setTreatments(data);
    });

    const channel = supabase
      .channel('book-next-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visits' }, fetchVisits)
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  const filtered = useMemo(() => {
    let list = visits;

    if (tab === 'pending') {
      list = list.filter(v => !v.next_appointment_status);
    } else if (tab === 'will_call') {
      list = list.filter(v => v.next_appointment_status === 'will_call_later');
    } else {
      list = list.filter(v => v.next_appointment_status === 'booked' || v.next_appointment_status === 'package_finished');
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(v => v.patient?.full_name?.toLowerCase().includes(q) || v.patient?.phone_number?.includes(q));
    }

    return list;
  }, [visits, tab, search]);

  const pendingCount = visits.filter(v => !v.next_appointment_status).length;
  const willCallCount = visits.filter(v => v.next_appointment_status === 'will_call_later').length;
  const handledCount = visits.filter(v => v.next_appointment_status === 'booked' || v.next_appointment_status === 'package_finished').length;

  const handleMarkStatus = async (visitId: string, status: string) => {
    const { error } = await supabase.from('visits').update({ next_appointment_status: status }).eq('id', visitId);
    if (error) toast.error('Failed to update');
    else {
      toast.success(status === 'will_call_later' ? 'Marked as will call later' : status === 'package_finished' ? 'Marked as package finished' : 'Updated');
      fetchVisits();
    }
  };

  const openBookModal = (visit: CompletedVisit) => {
    setBookingVisit(visit);
    const activeTreatment = visit.activePackages[0]?.treatment?.treatment_name || '';
    setBookForm({ date: '', time: '10:00', service: activeTreatment, notes: '' });
  };

  const handleBookAppointment = async () => {
    if (!bookingVisit || !bookForm.date || !bookForm.service) {
      toast.error('Please fill date and service');
      return;
    }
    setSaving(true);
    try {
      const { error: aptError } = await supabase.from('appointments').insert({
        patient_name: bookingVisit.patient.full_name,
        phone: bookingVisit.patient.phone_number,
        appointment_date: bookForm.date,
        appointment_time: bookForm.time,
        service: bookForm.service,
        booked_by: 'Follow-up',
        special_instructions: bookForm.notes || null,
      });
      if (aptError) throw aptError;

      const { error: visitError } = await supabase.from('visits').update({ next_appointment_status: 'booked' }).eq('id', bookingVisit.id);
      if (visitError) throw visitError;

      // Send WhatsApp confirmation
      try {
        const dateFormatted = format(new Date(bookForm.date + 'T00:00:00'), 'EEEE, dd MMM yyyy');
        const message = `Hi ${bookingVisit.patient.full_name},\n\nYour next appointment at Cosmique Clinic has been booked.\n\nDate: ${dateFormatted}\nTime: ${bookForm.time}\nService: ${bookForm.service}\n\nFor any queries, please contact us at +971 58 590 8090.\n\nCosmique Aesthetics & Dermatology\nBeach Park Plaza, Al Mamzar, Dubai`;
        await supabase.functions.invoke('send-whatsapp', {
          body: { phone: bookingVisit.patient.phone_number, message, patient_name: bookingVisit.patient.full_name },
        });
      } catch (whatsappErr) {
        console.error('WhatsApp send error:', whatsappErr);
      }

      toast.success(`Appointment booked for ${bookingVisit.patient.full_name}`);
      setBookingVisit(null);
      fetchVisits();
    } catch (e: any) {
      toast.error(e.message || 'Failed to book');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer maxWidth="full">
      <PageHeader title="Book Next Appointment" subtitle={`${pendingCount} patients need follow-up booking`} />

      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Tabs value={tab} onValueChange={v => setTab(v as TabFilter)}>
            <TabsList className="h-11">
              <TabsTrigger value="pending" className="text-sm px-4">
                Pending ({pendingCount})
              </TabsTrigger>
              <TabsTrigger value="will_call" className="text-sm px-4">
                Will Call Later ({willCallCount})
              </TabsTrigger>
              <TabsTrigger value="handled" className="text-sm px-4">
                Handled ({handledCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <TabletInput placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-11" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <TabletCard className="p-8 text-center">
            <CalendarPlus className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">No patients in this category</p>
          </TabletCard>
        ) : (
          <div className="space-y-3">
            {filtered.map(visit => (
              <TabletCard key={visit.id} className="p-4 border-l-4 border-l-primary">
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Patient info */}
                  <div className="flex items-center gap-2 min-w-[200px]">
                    <User className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <span className="font-semibold text-foreground">{visit.patient?.full_name}</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />{visit.patient?.phone_number}
                        <WhatsAppLink phone={visit.patient?.phone_number} iconSize="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>

                  {/* Visit info */}
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    Visit #{visit.visit_number}
                    {visit.completed_date && (
                      <span className="ml-1">— {format(new Date(visit.completed_date), 'h:mm a')}</span>
                    )}
                  </div>

                  {/* Active packages */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {visit.activePackages.length > 0 ? (
                      visit.activePackages.map(pkg => (
                        <Badge key={pkg.id} className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">
                          <Package className="h-3 w-3 mr-1" />
                          {pkg.treatment?.treatment_name} — {pkg.sessions_remaining} left
                        </Badge>
                      ))
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">No active packages</Badge>
                    )}
                  </div>

                  <div className="flex-1" />

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {!visit.next_appointment_status && (
                      <>
                        {visit.activePackages.length > 0 && (
                          <TabletButton size="sm" className="text-xs h-9" onClick={() => openBookModal(visit)}>
                            <CalendarPlus className="h-4 w-4 mr-1" /> Book Next
                          </TabletButton>
                        )}
                        <TabletButton variant="outline" size="sm" className="text-xs h-9" onClick={() => handleMarkStatus(visit.id, 'will_call_later')}>
                          <PhoneCall className="h-4 w-4 mr-1" /> Will Call Later
                        </TabletButton>
                        <TabletButton variant="outline" size="sm" className="text-xs h-9 text-destructive border-destructive/30 hover:bg-destructive/10" onClick={() => handleMarkStatus(visit.id, 'package_finished')}>
                          <XCircle className="h-4 w-4 mr-1" /> Package Finished
                        </TabletButton>
                      </>
                    )}
                    {visit.next_appointment_status === 'booked' && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className="bg-green-100 text-green-800 text-xs"><CheckCircle className="h-3 w-3 mr-1" /> Booked</Badge>
                        {visit.bookedAppointment && (
                          <Badge variant="outline" className="text-xs">
                            <CalendarPlus className="h-3 w-3 mr-1" />
                            {format(new Date(visit.bookedAppointment.appointment_date + 'T00:00:00'), 'EEE, dd MMM')} at {visit.bookedAppointment.appointment_time} — {visit.bookedAppointment.service}
                          </Badge>
                        )}
                      </div>
                    )}
                    {visit.next_appointment_status === 'will_call_later' && (
                      <>
                        <Badge className="bg-orange-100 text-orange-800 text-xs"><PhoneCall className="h-3 w-3 mr-1" /> Will Call</Badge>
                        <TabletButton size="sm" className="text-xs h-9" onClick={() => openBookModal(visit)}>
                          <CalendarPlus className="h-4 w-4 mr-1" /> Book Now
                        </TabletButton>
                      </>
                    )}
                    {visit.next_appointment_status === 'package_finished' && (
                      <Badge variant="outline" className="text-xs text-muted-foreground"><XCircle className="h-3 w-3 mr-1" /> Finished</Badge>
                    )}
                  </div>
                </div>
              </TabletCard>
            ))}
          </div>
        )}
      </div>

      {/* Book Appointment Modal */}
      <Dialog open={!!bookingVisit} onOpenChange={open => { if (!open) setBookingVisit(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Book Next Appointment — {bookingVisit?.patient?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Date *</Label>
                <TabletInput type="date" value={bookForm.date} min={format(new Date(), 'yyyy-MM-dd')} onChange={e => setBookForm(f => ({ ...f, date: e.target.value }))} />
              </div>
              <div>
                <Label>Time *</Label>
                <TabletInput type="time" value={bookForm.time} onChange={e => setBookForm(f => ({ ...f, time: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label>Service / Treatment *</Label>
              <Select value={bookForm.service} onValueChange={v => setBookForm(f => ({ ...f, service: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select service" />
                </SelectTrigger>
                <SelectContent>
                  {treatments.map(t => (
                    <SelectItem key={t.id} value={t.treatment_name}>{t.treatment_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={bookForm.notes} onChange={e => setBookForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any special notes..." rows={2} />
            </div>
            <div className="flex gap-3 pt-2">
              <TabletButton variant="outline" fullWidth onClick={() => setBookingVisit(null)}>Cancel</TabletButton>
              <TabletButton fullWidth onClick={handleBookAppointment} disabled={saving}>
                {saving ? 'Booking...' : 'Confirm Booking'}
              </TabletButton>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
