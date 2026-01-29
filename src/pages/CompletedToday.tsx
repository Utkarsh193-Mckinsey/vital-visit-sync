import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TabletCard, TabletCardContent } from '@/components/ui/tablet-card';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { CheckCircle, ClipboardCheck } from 'lucide-react';
import type { Visit, Patient, ConsentForm, Treatment, Staff } from '@/types/database';

interface CompletedVisit extends Visit {
  patient: Patient;
  consent_forms: (ConsentForm & { treatment: Treatment })[];
  nurse_staff?: Staff | null;
  doctor_staff?: Staff | null;
}

export default function CompletedToday() {
  const [visits, setVisits] = useState<CompletedVisit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchVisits = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error } = await supabase
      .from('visits')
      .select(`
        *,
        patient:patients (*),
        consent_forms (
          *,
          treatment:treatments (*)
        ),
        nurse_staff:staff!visits_nurse_staff_id_fkey (*),
        doctor_staff:staff!visits_doctor_staff_id_fkey (*)
      `)
      .eq('current_status', 'completed')
      .gte('completed_date', today.toISOString())
      .lt('completed_date', tomorrow.toISOString())
      .order('completed_date', { ascending: false });

    if (error) {
      console.error('Error fetching completed visits:', error);
    } else {
      setVisits(data as unknown as CompletedVisit[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchVisits();

    const interval = setInterval(fetchVisits, 10000);

    const channel = supabase
      .channel('completed-visits')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visits' },
        fetchVisits
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, []);

  return (
    <PageContainer maxWidth="xl">
      <PageHeader 
        title="Completed Today"
        subtitle={`${visits.length} treatment${visits.length !== 1 ? 's' : ''} completed`}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      ) : visits.length === 0 ? (
        <TabletCard>
          <TabletCardContent className="p-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <ClipboardCheck className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No completed treatments today</p>
          </TabletCardContent>
        </TabletCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {visits.map((visit) => (
            <TabletCard key={visit.id} className="overflow-hidden border-l-4 border-l-success">
              <TabletCardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold">{visit.patient.full_name}</span>
                  <span className="text-sm text-muted-foreground">
                    Visit #{visit.visit_number}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {visit.consent_forms.map((cf) => (
                    <span 
                      key={cf.id}
                      className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"
                    >
                      {cf.treatment?.treatment_name}
                    </span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3.5 w-3.5 text-success" />
                    Completed
                  </span>
                  {visit.completed_date && (
                    <span>
                      {new Date(visit.completed_date).toLocaleTimeString('en-AE', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
              </TabletCardContent>
            </TabletCard>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
