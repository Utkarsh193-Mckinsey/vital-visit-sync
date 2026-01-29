import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletCard, TabletCardContent } from '@/components/ui/tablet-card';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { 
  Clock, 
  CheckCircle, 
  Activity,
  Stethoscope
} from 'lucide-react';
import type { Visit, Patient, ConsentForm, Treatment, Staff } from '@/types/database';

interface InProgressVisit extends Visit {
  patient: Patient;
  consent_forms: (ConsentForm & { treatment: Treatment })[];
  nurse_staff?: Staff | null;
  doctor_staff?: Staff | null;
}

export default function InTreatment() {
  const [visits, setVisits] = useState<InProgressVisit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { hasRole } = useAuth();
  const navigate = useNavigate();

  const fetchVisits = async () => {
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
      .eq('current_status', 'in_progress')
      .order('visit_date', { ascending: true });

    if (error) {
      console.error('Error fetching in-progress visits:', error);
    } else {
      setVisits(data as unknown as InProgressVisit[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchVisits();

    const interval = setInterval(fetchVisits, 10000);

    const channel = supabase
      .channel('in-progress-visits')
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

  const handleContinueTreatment = (visit: InProgressVisit) => {
    if (!visit.vitals_completed) {
      navigate(`/visit/${visit.id}/vitals`);
    } else {
      navigate(`/visit/${visit.id}/treatment`);
    }
  };

  return (
    <PageContainer maxWidth="xl">
      <PageHeader 
        title="In Treatment"
        subtitle={`${visits.length} patient${visits.length !== 1 ? 's' : ''} in treatment`}
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
              <Stethoscope className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">No patients in treatment</p>
          </TabletCardContent>
        </TabletCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visits.map((visit) => (
            <TabletCard key={visit.id} className="overflow-hidden border-l-4 border-l-primary">
              <TabletCardContent className="p-0">
                <div className="flex items-center justify-between border-b bg-primary/5 px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-semibold">
                      {visit.patient.full_name}
                    </span>
                    <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-medium text-primary">
                      Visit #{visit.visit_number}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {visit.vitals_completed ? (
                      <span className="flex items-center gap-1 text-sm text-success">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Vitals Done
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-sm text-warning">
                        <Clock className="h-3.5 w-3.5" />
                        Awaiting Vitals
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-4">
                    <div className="flex flex-wrap gap-2">
                      {visit.consent_forms.map((cf) => (
                        <span 
                          key={cf.id}
                          className="rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground"
                        >
                          {cf.treatment?.treatment_name}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {visit.nurse_staff && (
                        <span>Nurse: {visit.nurse_staff.full_name}</span>
                      )}
                    </div>

                    {hasRole(['nurse', 'doctor', 'admin']) && (
                      <TabletButton
                        variant="secondary"
                        size="sm"
                        onClick={() => handleContinueTreatment(visit)}
                        leftIcon={visit.vitals_completed ? <Stethoscope /> : <Activity />}
                      >
                        {visit.vitals_completed 
                          ? 'Administer Treatment' 
                          : 'Take Vitals'
                        }
                      </TabletButton>
                    )}
                  </div>
                </div>
              </TabletCardContent>
            </TabletCard>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
