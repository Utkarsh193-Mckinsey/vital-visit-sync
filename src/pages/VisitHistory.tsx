import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle } from '@/components/ui/tablet-card';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Calendar, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  ChevronRight,
  UserCheck,
  Stethoscope,
  PlayCircle,
  FileSignature,
  ClipboardList,
  Download,
  Loader2
} from 'lucide-react';
import type { Patient, Visit } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { generateConsentPDF } from '@/utils/generateConsentPDF';

interface ConsentFormWithDetails {
  id: string;
  signature_url: string;
  pdf_url: string | null;
  signed_date: string;
  consent_template_id: string;
  treatment: {
    treatment_name: string;
  } | null;
  consent_template?: {
    form_name: string;
    consent_text: string;
  } | null;
}

interface VisitWithDetails extends Omit<Visit, 'consent_forms'> {
  visit_treatments?: {
    id: string;
    dose_administered: string;
    dose_unit: string;
    treatment: {
      treatment_name: string;
    };
  }[];
  consent_forms?: ConsentFormWithDetails[];
}

export default function VisitHistory() {
  const { patientId } = useParams<{ patientId: string }>();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<VisitWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedVisit, setExpandedVisit] = useState<string | null>(null);
  const [generatingPDF, setGeneratingPDF] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasRole } = useAuth();

  useEffect(() => {
    fetchData();
  }, [patientId]);

  const fetchData = async () => {
    if (!patientId) return;

    try {
      // Fetch patient
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', patientId)
        .single();

      if (patientError) throw patientError;
      setPatient(patientData as Patient);

      // Fetch visits with treatments and consent forms
      const { data: visitsData, error: visitsError } = await supabase
        .from('visits')
        .select(`
          *,
          visit_treatments (
            id,
            dose_administered,
            dose_unit,
            treatment:treatments (
              treatment_name
            )
          ),
          consent_forms (
            id,
            signature_url,
            pdf_url,
            signed_date,
            consent_template_id,
            treatment:treatments (
              treatment_name
            ),
            consent_template:consent_templates (
              form_name,
              consent_text
            )
          )
        `)
        .eq('patient_id', patientId)
        .order('visit_date', { ascending: false });

      if (visitsError) throw visitsError;
      setVisits(visitsData as unknown as VisitWithDetails[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load visit history.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-AE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-AE', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-success/10 text-success border-success/20">Completed</Badge>;
      case 'in_progress':
        return <Badge className="bg-warning/10 text-warning border-warning/20">In Progress</Badge>;
      case 'waiting':
        return <Badge className="bg-info/10 text-info border-info/20">Waiting</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const getNextStep = (visit: VisitWithDetails) => {
    if (visit.current_status === 'completed') return null;
    if (visit.current_status === 'waiting') {
      return { label: 'Waiting for Staff', icon: Clock, action: null };
    }
    // In progress - check what's pending
    if (!visit.vitals_completed) {
      return { 
        label: 'Take Patient (Vitals)', 
        icon: UserCheck, 
        action: () => navigate(`/visit/${visit.id}/vitals`)
      };
    }
    if (!visit.treatment_completed) {
      return { 
        label: 'Start Treatment', 
        icon: Stethoscope, 
        action: () => navigate(`/visit/${visit.id}/treatment`)
      };
    }
    return null;
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Loading visit history...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!patient) {
    return (
      <PageContainer>
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold">Patient not found</h2>
          <TabletButton className="mt-4" onClick={() => navigate('/patients')}>
            Back to Search
          </TabletButton>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="lg">
      <PageHeader 
        title="Visit History"
        subtitle={patient.full_name}
        backButton={
          <TabletButton 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate(`/patient/${patientId}`)}
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </TabletButton>
        }
      />

      {visits.length === 0 ? (
        <TabletCard>
          <TabletCardContent className="p-8 text-center">
            <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Visits Yet</h3>
            <p className="text-muted-foreground mb-6">
              This patient hasn't had any visits recorded.
            </p>
            <TabletButton onClick={() => navigate(`/patient/${patientId}`)}>
              Go Back
            </TabletButton>
          </TabletCardContent>
        </TabletCard>
      ) : (
        <div className="space-y-4">
          {visits.map((visit) => (
            <TabletCard 
              key={visit.id}
              className="cursor-pointer transition-shadow hover:shadow-md"
              onClick={() => setExpandedVisit(expandedVisit === visit.id ? null : visit.id)}
            >
              <TabletCardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                      <span className="text-lg font-bold text-primary">#{visit.visit_number}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{formatDate(visit.visit_date)}</span>
                        <Clock className="h-4 w-4 text-muted-foreground ml-2" />
                        <span className="text-muted-foreground">{formatTime(visit.visit_date)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        {getStatusBadge(visit.current_status)}
                        {visit.consent_signed && (
                          <span className="flex items-center gap-1 text-xs text-success">
                            <CheckCircle2 className="h-3 w-3" />
                            Consent Signed
                          </span>
                        )}
                      </div>
                      {/* Show next step for in-progress visits */}
                      {visit.current_status === 'in_progress' && getNextStep(visit) && (
                        <div className="mt-2">
                          {hasRole(['admin', 'nurse', 'doctor']) && getNextStep(visit)?.action ? (
                            <TabletButton
                              size="sm"
                              variant="default"
                              onClick={(e) => {
                                e.stopPropagation();
                                getNextStep(visit)?.action?.();
                              }}
                              leftIcon={getNextStep(visit)?.icon && <PlayCircle className="h-4 w-4" />}
                            >
                              {getNextStep(visit)?.label}
                            </TabletButton>
                          ) : (
                            <span className="flex items-center gap-1.5 text-xs text-warning font-medium">
                              <AlertCircle className="h-3 w-3" />
                              Next: {getNextStep(visit)?.label}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <ChevronRight className={`h-5 w-5 text-muted-foreground transition-transform ${
                    expandedVisit === visit.id ? 'rotate-90' : ''
                  }`} />
                </div>

                {/* Expanded details */}
                {expandedVisit === visit.id && (
                  <div className="mt-4 pt-4 border-t border-border">
                    {/* Vitals */}
                    {visit.vitals_completed && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium mb-2">Vitals</h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {visit.weight_kg && (
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground">Weight</p>
                              <p className="font-medium">{visit.weight_kg} kg</p>
                            </div>
                          )}
                          {visit.blood_pressure_systolic && visit.blood_pressure_diastolic && (
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground">Blood Pressure</p>
                              <p className="font-medium">{visit.blood_pressure_systolic}/{visit.blood_pressure_diastolic}</p>
                            </div>
                          )}
                          {visit.heart_rate && (
                            <div className="bg-muted/50 rounded-lg p-3">
                              <p className="text-xs text-muted-foreground">Heart Rate</p>
                              <p className="font-medium">{visit.heart_rate} bpm</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Treatments */}
                    {visit.visit_treatments && visit.visit_treatments.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium mb-2">Treatments</h4>
                        <div className="space-y-2">
                          {visit.visit_treatments.map((vt) => (
                            <div key={vt.id} className="bg-muted/50 rounded-lg p-3 flex justify-between">
                              <span className="font-medium">{vt.treatment?.treatment_name}</span>
                              <span className="text-muted-foreground">
                                {vt.dose_administered} {vt.dose_unit}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Doctor notes */}
                    {visit.doctor_notes && (
                      <div>
                        <h4 className="text-sm font-medium mb-2">Notes</h4>
                        <p className="text-sm text-muted-foreground bg-muted/50 rounded-lg p-3">
                          {visit.doctor_notes}
                        </p>
                      </div>
                    )}

                    {/* Consent Forms Downloads */}
                    {visit.consent_forms && visit.consent_forms.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium mb-2">Consent Forms</h4>
                        <div className="flex flex-wrap gap-2">
                          {visit.consent_forms.map((cf) => (
                            <TabletButton
                              key={cf.id}
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                // Prefer PDF if available, otherwise fall back to signature
                                window.open(cf.pdf_url || cf.signature_url, '_blank');
                              }}
                              leftIcon={<FileSignature className="h-4 w-4" />}
                            >
                              {cf.treatment?.treatment_name || 'Consent'} {cf.pdf_url ? 'PDF' : 'Signature'}
                            </TabletButton>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Registration Form Download - show on first visit */}
                    {visit.visit_number === 1 && patient?.registration_signature_url && (
                      <div className="mb-4">
                        <h4 className="text-sm font-medium mb-2">Registration</h4>
                        <TabletButton
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(patient.registration_signature_url, '_blank');
                          }}
                          leftIcon={<ClipboardList className="h-4 w-4" />}
                        >
                          Registration Signature
                        </TabletButton>
                      </div>
                    )}

                    {!visit.vitals_completed && !visit.visit_treatments?.length && !visit.doctor_notes && !visit.consent_forms?.length && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No details recorded for this visit yet.
                      </p>
                    )}
                  </div>
                )}
              </TabletCardContent>
            </TabletCard>
          ))}
        </div>
      )}
    </PageContainer>
  );
}
