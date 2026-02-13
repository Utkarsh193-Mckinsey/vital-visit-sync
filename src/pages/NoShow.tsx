import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { TabletCard } from '@/components/ui/tablet-card';
import { Badge } from '@/components/ui/badge';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletInput } from '@/components/ui/tablet-input';
import { UserX, Search, Phone, Clock, User, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import type { Appointment } from './Appointments';

export default function NoShow() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('status', 'no_show')
        .order('appointment_date', { ascending: false });
      setAppointments((data || []) as Appointment[]);
      setLoading(false);
    };
    fetch();

    const channel = supabase.channel('noshow-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, fetch)
      .subscribe();
    return () => { channel.unsubscribe(); };
  }, []);

  const filtered = useMemo(() => {
    if (!search) return appointments;
    const q = search.toLowerCase();
    return appointments.filter(a => a.patient_name.toLowerCase().includes(q) || a.phone.includes(q));
  }, [appointments, search]);

  return (
    <PageContainer maxWidth="full">
      <PageHeader title="No Show" subtitle={`${filtered.length} patients`} />
      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <TabletInput placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-11" />
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>
        ) : filtered.length === 0 ? (
          <TabletCard className="p-8 text-center">
            <UserX className="h-12 w-12 mx-auto mb-3 text-muted-foreground" />
            <p className="text-lg font-medium text-muted-foreground">No no-show records</p>
          </TabletCard>
        ) : (
          <div className="space-y-3">
            {filtered.map(apt => (
              <TabletCard key={apt.id} className="p-4 border-l-4 border-l-destructive">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="min-w-[75px] text-center">
                      <div className="font-bold text-foreground">{apt.appointment_date}</div>
                      <div className="text-sm text-muted-foreground">{apt.appointment_time}</div>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground">{apt.patient_name}</span>
                        <Badge variant="destructive" className="text-xs">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          {apt.no_show_count}x No-Show
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1">
                        <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{apt.phone}</span>
                        <span>{apt.service}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </TabletCard>
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}
