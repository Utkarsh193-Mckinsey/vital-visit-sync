import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { TabletCard } from '@/components/ui/tablet-card';
import { Badge } from '@/components/ui/badge';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletInput } from '@/components/ui/tablet-input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserX, Search, Phone, PhoneCall, MessageSquare, CalendarPlus, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import type { Appointment } from './Appointments';

type FilterTab = 'active' | 'rescheduled' | 'lost';
type SortOption = 'recent' | 'no_show_count' | 'new_first';

export default function NoShow() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<FilterTab>('active');
  const [sort, setSort] = useState<SortOption>('recent');
  const [callingId, setCallingId] = useState<string | null>(null);

  const fetchData = async () => {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .eq('status', 'no_show')
      .order('appointment_date', { ascending: false });
    setAppointments((data || []) as Appointment[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('noshow-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, fetchData)
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  const filtered = useMemo(() => {
    let list = appointments;

    // Filter by tab
    if (tab === 'active') {
      list = list.filter(a => a.followup_status === 'active' || a.followup_status === 'stopped');
    } else if (tab === 'rescheduled') {
      list = list.filter(a => a.confirmation_status === 'called_reschedule' || a.followup_status === 'stopped');
    } else {
      list = list.filter(a => a.followup_status === 'completed');
    }

    // Search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a => a.patient_name.toLowerCase().includes(q) || a.phone.includes(q));
    }

    // Sort
    if (sort === 'no_show_count') {
      list = [...list].sort((a, b) => b.no_show_count - a.no_show_count);
    } else if (sort === 'new_first') {
      list = [...list].sort((a, b) => (b.is_new_patient ? 1 : 0) - (a.is_new_patient ? 1 : 0));
    }
    // 'recent' is default from DB ordering

    return list;
  }, [appointments, search, tab, sort]);

  const activeCount = appointments.filter(a => a.followup_status === 'active' || a.followup_status === 'stopped').length;
  const rescheduledCount = appointments.filter(a => a.confirmation_status === 'called_reschedule' || a.followup_status === 'stopped').length;
  const lostCount = appointments.filter(a => a.followup_status === 'completed').length;

  const handleCall = async (apt: Appointment) => {
    setCallingId(apt.id);
    try {
      const { error } = await supabase.functions.invoke('manual-vapi-call', {
        body: { appointment_id: apt.id },
      });
      if (error) throw error;
      toast.success(`Calling ${apt.patient_name}...`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to call');
    } finally {
      setCallingId(null);
    }
  };

  const handleMarkLost = async (apt: Appointment) => {
    const { error } = await supabase.from('appointments').update({
      followup_status: 'completed',
    }).eq('id', apt.id);
    if (error) toast.error('Failed to update');
    else toast.success('Marked as lost lead');
  };

  const getFollowupInfo = (apt: Appointment) => {
    const maxSteps = apt.is_new_patient ? 4 : 2;
    const step = apt.followup_step || 0;
    const daysSince = Math.floor((Date.now() - new Date(apt.appointment_date).getTime()) / (1000 * 60 * 60 * 24));
    return { step, maxSteps, daysSince };
  };

  return (
    <PageContainer maxWidth="full">
      <PageHeader title="No Show" subtitle={`${appointments.length} total no-shows`} />
      <div className="space-y-4">
        {/* Tabs + sort */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <Tabs value={tab} onValueChange={v => setTab(v as FilterTab)}>
            <TabsList className="h-11">
              <TabsTrigger value="active" className="text-sm px-4">
                Active Follow-up ({activeCount})
              </TabsTrigger>
              <TabsTrigger value="rescheduled" className="text-sm px-4">
                Rescheduled ({rescheduledCount})
              </TabsTrigger>
              <TabsTrigger value="lost" className="text-sm px-4">
                Lost Leads ({lostCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Select value={sort} onValueChange={v => setSort(v as SortOption)}>
            <SelectTrigger className="h-9 w-[180px] text-sm">
              <SelectValue placeholder="Sort by..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="no_show_count">Highest No-Show Count</SelectItem>
              <SelectItem value="new_first">New Patients First</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <TabletInput placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-11" />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <TabletCard className="p-8 text-center">
            <UserX className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">No records in this category</p>
          </TabletCard>
        ) : (
          <div className="space-y-3">
            {filtered.map(apt => {
              const { step, maxSteps, daysSince } = getFollowupInfo(apt);
              const isCalling = callingId === apt.id;

              return (
                <TabletCard key={apt.id} className="p-4 border-l-4 border-l-destructive">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left info */}
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="min-w-[85px] text-center">
                        <div className="font-bold text-foreground text-sm">{apt.appointment_date}</div>
                        <div className="text-xs text-muted-foreground">{apt.appointment_time}</div>
                        <div className="text-xs text-muted-foreground mt-1">{daysSince}d ago</div>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="font-semibold text-foreground">{apt.patient_name}</span>
                          {apt.is_new_patient ? (
                            <Badge className="bg-blue-100 text-blue-800 text-xs">New Patient</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-xs">Returning</Badge>
                          )}
                          {apt.no_show_count >= 3 && (
                            <Badge variant="destructive" className="text-xs flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              {apt.no_show_count}x No-Show!
                            </Badge>
                          )}
                          {apt.no_show_count > 0 && apt.no_show_count < 3 && (
                            <Badge variant="outline" className="text-xs border-destructive text-destructive">
                              {apt.no_show_count}x No-Show
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{apt.phone}</span>
                          <span className="font-medium text-foreground">{apt.service}</span>
                        </div>

                        {/* Follow-up progress */}
                        {apt.followup_status === 'active' && (
                          <div className="mt-2">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className="text-xs text-muted-foreground">Follow-up: Step {step}/{maxSteps}</span>
                            </div>
                            <div className="flex gap-1">
                              {Array.from({ length: maxSteps }).map((_, i) => (
                                <div
                                  key={i}
                                  className={`h-2 flex-1 rounded-full ${
                                    i < step
                                      ? 'bg-primary'
                                      : i === step
                                      ? 'bg-primary/40 animate-pulse'
                                      : 'bg-muted'
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                        )}

                        {apt.followup_status === 'completed' && (
                          <div className="mt-2">
                            <Badge variant="outline" className="text-xs">Sequence completed — no response</Badge>
                          </div>
                        )}

                        {apt.followup_status === 'stopped' && (
                          <div className="mt-2">
                            <Badge className="bg-green-100 text-green-800 text-xs">Patient responded</Badge>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                      <TabletButton
                        variant="outline"
                        size="sm"
                        className="text-xs h-8"
                        onClick={() => handleCall(apt)}
                        disabled={isCalling}
                      >
                        {isCalling ? (
                          <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Calling...</>
                        ) : (
                          <><PhoneCall className="h-3.5 w-3.5 mr-1" />Call Now</>
                        )}
                      </TabletButton>

                      {tab === 'active' && (
                        <TabletButton
                          variant="outline"
                          size="sm"
                          className="text-xs h-8 text-destructive border-destructive hover:bg-destructive/10"
                          onClick={() => handleMarkLost(apt)}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Mark Lost
                        </TabletButton>
                      )}
                    </div>
                  </div>
                </TabletCard>
              );
            })}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
