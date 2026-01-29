import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle } from '@/components/ui/tablet-card';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { useToast } from '@/hooks/use-toast';
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  UserCheck, 
  LogOut, 
  Search,
  Activity,
  Stethoscope,
  ClipboardCheck
} from 'lucide-react';
import type { Visit, Patient, ConsentForm, Treatment, Staff } from '@/types/database';

interface WaitingVisit extends Visit {
  patient: Patient;
  consent_forms: (ConsentForm & { treatment: Treatment })[];
  nurse_staff?: Staff | null;
  doctor_staff?: Staff | null;
}

export default function WaitingArea() {
  const [waitingVisits, setWaitingVisits] = useState<WaitingVisit[]>([]);
  const [inProgressVisits, setInProgressVisits] = useState<WaitingVisit[]>([]);
  const [completedVisits, setCompletedVisits] = useState<WaitingVisit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [takingPatient, setTakingPatient] = useState<string | null>(null);
  const { staff, signOut, hasRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchAllVisits = async () => {
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Fetch waiting visits
    const { data: waiting, error: waitingError } = await supabase
      .from('visits')
      .select(`
        *,
        patient:patients (*),
        consent_forms (
          *,
          treatment:treatments (*)
        )
      `)
      .eq('current_status', 'waiting')
      .order('visit_date', { ascending: true });

    if (waitingError) {
      console.error('Error fetching waiting visits:', waitingError);
    } else {
      setWaitingVisits(waiting as unknown as WaitingVisit[]);
    }

    // Fetch in-progress visits
    const { data: inProgress, error: inProgressError } = await supabase
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

    if (inProgressError) {
      console.error('Error fetching in-progress visits:', inProgressError);
    } else {
      setInProgressVisits(inProgress as unknown as WaitingVisit[]);
    }

    // Fetch today's completed visits
    const { data: completed, error: completedError } = await supabase
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

    if (completedError) {
      console.error('Error fetching completed visits:', completedError);
    } else {
      setCompletedVisits(completed as unknown as WaitingVisit[]);
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchAllVisits();

    // Poll every 10 seconds
    const interval = setInterval(fetchAllVisits, 10000);

    // Also set up realtime subscription
    const channel = supabase
      .channel('all-visits')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visits',
        },
        () => {
          fetchAllVisits();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, []);

  const handleTakePatient = async (visit: WaitingVisit) => {
    setTakingPatient(visit.id);

    const updateData: Record<string, unknown> = {
      current_status: 'in_progress',
    };

    // Assign staff based on role
    if (staff?.role === 'nurse') {
      updateData.nurse_staff_id = staff.id;
    } else if (staff?.role === 'doctor') {
      updateData.doctor_staff_id = staff.id;
    }

    const { error } = await supabase
      .from('visits')
      .update(updateData)
      .eq('id', visit.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'Failed to take patient. Please try again.',
        variant: 'destructive',
      });
      setTakingPatient(null);
      return;
    }

    toast({
      title: 'Patient taken',
      description: `Now attending to ${visit.patient.full_name}`,
    });

    // Navigate based on role and visit state
    if (staff?.role === 'nurse' && !visit.vitals_completed) {
      navigate(`/visit/${visit.id}/vitals`);
    } else if (staff?.role === 'doctor' || staff?.role === 'admin') {
      navigate(`/visit/${visit.id}/treatment`);
    } else {
      navigate(`/visit/${visit.id}/vitals`);
    }
  };

  const handleContinueTreatment = (visit: WaitingVisit) => {
    if (staff?.role === 'nurse' && !visit.vitals_completed) {
      navigate(`/visit/${visit.id}/vitals`);
    } else {
      navigate(`/visit/${visit.id}/treatment`);
    }
  };

  const getWaitingTime = (visitDate: string) => {
    const now = new Date();
    const visit = new Date(visitDate);
    const diffMs = now.getTime() - visit.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min${diffMins !== 1 ? 's' : ''}`;
    
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours}h ${mins}m`;
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/login');
  };

  const handlePatientSearch = () => {
    navigate('/patients');
  };

  const totalActivePatients = waitingVisits.length + inProgressVisits.length;

  return (
    <PageContainer maxWidth="xl">
      <PageHeader 
        title="Waiting Area"
        subtitle={`${totalActivePatients} active patient${totalActivePatients !== 1 ? 's' : ''}`}
        action={
          <div className="flex gap-2">
            {hasRole(['admin', 'reception']) && (
              <TabletButton
                variant="outline"
                onClick={handlePatientSearch}
                leftIcon={<Search />}
              >
                Patient Search
              </TabletButton>
            )}
            <TabletButton 
              variant="ghost" 
              size="icon" 
              onClick={handleLogout}
              aria-label="Logout"
            >
              <LogOut className="h-5 w-5" />
            </TabletButton>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Waiting Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="h-5 w-5 text-warning" />
              <h2 className="text-lg font-semibold">Waiting</h2>
              <span className="rounded-full bg-warning/10 px-2.5 py-0.5 text-sm font-medium text-warning">
                {waitingVisits.length}
              </span>
            </div>

            {waitingVisits.length === 0 ? (
              <TabletCard>
                <TabletCardContent className="p-8 text-center">
                  <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-success/10">
                    <CheckCircle className="h-7 w-7 text-success" />
                  </div>
                  <p className="text-muted-foreground">No patients waiting</p>
                </TabletCardContent>
              </TabletCard>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {waitingVisits.map((visit) => (
                  <TabletCard key={visit.id} className="overflow-hidden border-l-4 border-l-warning">
                    <TabletCardContent className="p-0">
                      <div className="flex items-center justify-between border-b bg-secondary/30 px-5 py-3">
                        <div className="flex items-center gap-3">
                          <span className="text-lg font-semibold">
                            {visit.patient.full_name}
                          </span>
                          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-medium text-primary">
                            Visit #{visit.visit_number}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-warning">
                          <Clock className="h-4 w-4" />
                          <span className="text-sm font-medium">
                            {getWaitingTime(visit.visit_date)}
                          </span>
                        </div>
                      </div>

                      <div className="p-5">
                        <div className="mb-4">
                          <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                            Treatments for today
                          </h4>
                          <div className="flex flex-wrap gap-2">
                            {visit.consent_forms.length > 0 ? (
                              visit.consent_forms.map((cf) => (
                                <span 
                                  key={cf.id}
                                  className="rounded-full bg-accent px-3 py-1 text-sm font-medium text-accent-foreground"
                                >
                                  {cf.treatment?.treatment_name}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">No treatments specified</span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {visit.consent_signed ? (
                              <span className="flex items-center gap-1.5 text-sm text-success">
                                <CheckCircle className="h-4 w-4" />
                                Consent Signed
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-sm text-warning">
                                <AlertCircle className="h-4 w-4" />
                                Consent Pending
                              </span>
                            )}
                          </div>

                          {hasRole(['nurse', 'doctor', 'admin']) && (
                            <TabletButton
                              variant="default"
                              size="sm"
                              onClick={() => handleTakePatient(visit)}
                              isLoading={takingPatient === visit.id}
                              leftIcon={<UserCheck />}
                            >
                              Start Treatment
                            </TabletButton>
                          )}
                        </div>
                      </div>
                    </TabletCardContent>
                  </TabletCard>
                ))}
              </div>
            )}
          </section>

          {/* Treatment in Progress Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Activity className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Treatment in Progress</h2>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-sm font-medium text-primary">
                {inProgressVisits.length}
              </span>
            </div>

            {inProgressVisits.length === 0 ? (
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
                {inProgressVisits.map((visit) => (
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
          </section>

          {/* Completed Treatments Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <ClipboardCheck className="h-5 w-5 text-success" />
              <h2 className="text-lg font-semibold">Completed Today</h2>
              <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-sm font-medium text-success">
                {completedVisits.length}
              </span>
            </div>

            {completedVisits.length === 0 ? (
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
                {completedVisits.map((visit) => (
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
          </section>
        </div>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Auto-refreshing every 10 seconds
      </p>
    </PageContainer>
  );
}
