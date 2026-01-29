import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletCard, TabletCardContent } from '@/components/ui/tablet-card';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { useToast } from '@/hooks/use-toast';
import { Clock, CheckCircle, AlertCircle, UserCheck, LogOut, Search } from 'lucide-react';
import type { Visit, Patient, ConsentForm, Treatment } from '@/types/database';

interface WaitingVisit extends Visit {
  patient: Patient;
  consent_forms: (ConsentForm & { treatment: Treatment })[];
}

export default function WaitingArea() {
  const [visits, setVisits] = useState<WaitingVisit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [takingPatient, setTakingPatient] = useState<string | null>(null);
  const { staff, signOut, hasRole } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const fetchWaitingVisits = async () => {
    const { data, error } = await supabase
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

    if (error) {
      console.error('Error fetching visits:', error);
      return;
    }

    setVisits(data as unknown as WaitingVisit[]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchWaitingVisits();

    // Poll every 10 seconds
    const interval = setInterval(fetchWaitingVisits, 10000);

    // Also set up realtime subscription
    const channel = supabase
      .channel('waiting-visits')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'visits',
          filter: 'current_status=eq.waiting'
        },
        () => {
          fetchWaitingVisits();
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

    // Navigate to vitals entry
    navigate(`/visit/${visit.id}/vitals`);
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

  return (
    <PageContainer maxWidth="xl">
      <PageHeader 
        title="Waiting Area"
        subtitle={`${visits.length} patient${visits.length !== 1 ? 's' : ''} waiting`}
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
            <p className="text-muted-foreground">Loading waiting area...</p>
          </div>
        </div>
      ) : visits.length === 0 ? (
        <TabletCard>
          <TabletCardContent className="p-12 text-center">
            <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
              <CheckCircle className="h-10 w-10 text-success" />
            </div>
            <h3 className="text-xl font-semibold">No patients waiting</h3>
            <p className="mt-2 text-muted-foreground">
              The waiting area is clear. New patients will appear here automatically.
            </p>
          </TabletCardContent>
        </TabletCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visits.map((visit) => (
            <TabletCard key={visit.id} className="overflow-hidden">
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
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-medium">
                      {getWaitingTime(visit.visit_date)}
                    </span>
                  </div>
                </div>

                <div className="p-5">
                  <div className="mb-4">
                    <h4 className="mb-2 text-sm font-medium text-muted-foreground">
                      Treatments
                    </h4>
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

                    <TabletButton
                      variant="default"
                      size="sm"
                      onClick={() => handleTakePatient(visit)}
                      isLoading={takingPatient === visit.id}
                      leftIcon={<UserCheck />}
                    >
                      Take Patient
                    </TabletButton>
                  </div>
                </div>
              </TabletCardContent>
            </TabletCard>
          ))}
        </div>
      )}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Auto-refreshing every 10 seconds
      </p>
    </PageContainer>
  );
}
