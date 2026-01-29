import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletCard, TabletCardContent } from '@/components/ui/tablet-card';
import { TabletInput } from '@/components/ui/tablet-input';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, CheckCircle, Syringe, FileText, User } from 'lucide-react';
import type { Visit, Patient, Package, Treatment } from '@/types/database';

interface ConsentFormWithTreatment {
  id: string;
  treatment_id: string;
  treatment: Treatment;
}

interface VisitWithDetails extends Omit<Visit, 'consent_forms'> {
  patient: Patient;
  consent_forms: ConsentFormWithTreatment[];
}

interface PackageWithTreatment extends Package {
  treatment: Treatment;
}

interface TreatmentEntry {
  packageId: string;
  treatmentId: string;
  treatmentName: string;
  doseAdministered: string;
  doseUnit: string;
  administrationDetails: string;
}

export default function TreatmentAdmin() {
  const { visitId } = useParams<{ visitId: string }>();
  const [visit, setVisit] = useState<VisitWithDetails | null>(null);
  const [packages, setPackages] = useState<PackageWithTreatment[]>([]);
  const [treatments, setTreatments] = useState<TreatmentEntry[]>([]);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { staff } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchVisitData();
  }, [visitId]);

  const fetchVisitData = async () => {
    if (!visitId) return;

    try {
      // Fetch visit with patient and consent forms
      const { data: visitData, error: visitError } = await supabase
        .from('visits')
        .select(`
          *,
          patient:patients (*),
          consent_forms (
            id,
            treatment_id,
            treatment:treatments (*)
          )
        `)
        .eq('id', visitId)
        .single();

      if (visitError) throw visitError;
      setVisit(visitData as unknown as VisitWithDetails);
      setDoctorNotes(visitData.doctor_notes || '');

      // Fetch active packages for the patient's treatments
      const treatmentIds = visitData.consent_forms.map((cf: any) => cf.treatment_id);
      
      if (treatmentIds.length > 0) {
        const { data: packagesData, error: packagesError } = await supabase
          .from('packages')
          .select(`
            *,
            treatment:treatments (*)
          `)
          .eq('patient_id', visitData.patient_id)
          .eq('status', 'active')
          .in('treatment_id', treatmentIds);

        if (packagesError) throw packagesError;
        setPackages(packagesData as unknown as PackageWithTreatment[]);

        // Initialize treatment entries
        const entries: TreatmentEntry[] = visitData.consent_forms.map((cf: any) => {
          const pkg = packagesData?.find((p: any) => p.treatment_id === cf.treatment_id);
          return {
            packageId: pkg?.id || '',
            treatmentId: cf.treatment_id,
            treatmentName: cf.treatment?.treatment_name || '',
            doseAdministered: '',
            doseUnit: cf.treatment?.dosage_unit || 'Session',
            administrationDetails: '',
          };
        });
        setTreatments(entries);
      }
    } catch (error) {
      console.error('Error fetching visit:', error);
      toast({
        title: 'Error',
        description: 'Failed to load visit data.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateTreatment = (index: number, field: keyof TreatmentEntry, value: string) => {
    setTreatments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleCompleteVisit = async () => {
    if (!visit || !staff) return;

    // Validate treatments have doses
    const incompleteTreatments = treatments.filter(t => !t.doseAdministered);
    if (incompleteTreatments.length > 0) {
      toast({
        title: 'Incomplete',
        description: 'Please enter dose for all treatments.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      // Insert visit treatments and deduct sessions
      for (const treatment of treatments) {
        if (!treatment.packageId) {
          toast({
            title: 'Error',
            description: `No active package found for ${treatment.treatmentName}`,
            variant: 'destructive',
          });
          setIsSaving(false);
          return;
        }

        // Insert visit treatment
        const { error: treatmentError } = await supabase
          .from('visit_treatments')
          .insert({
            visit_id: visitId,
            treatment_id: treatment.treatmentId,
            package_id: treatment.packageId,
            dose_administered: treatment.doseAdministered,
            dose_unit: treatment.doseUnit,
            administration_details: treatment.administrationDetails || null,
            performed_by: staff.id,
            sessions_deducted: 1,
          });

        if (treatmentError) throw treatmentError;

        // Deduct session from package
        const pkg = packages.find(p => p.id === treatment.packageId);
        if (pkg) {
          const newRemaining = pkg.sessions_remaining - 1;
          const { error: pkgError } = await supabase
            .from('packages')
            .update({
              sessions_remaining: newRemaining,
              status: newRemaining <= 0 ? 'depleted' : 'active',
            })
            .eq('id', treatment.packageId);

          if (pkgError) throw pkgError;
        }
      }

      // Update visit as completed
      const { error: visitError } = await supabase
        .from('visits')
        .update({
          current_status: 'completed',
          treatment_completed: true,
          doctor_notes: doctorNotes || null,
          doctor_staff_id: staff.id,
          completed_date: new Date().toISOString(),
          is_locked: true,
        })
        .eq('id', visitId);

      if (visitError) throw visitError;

      toast({
        title: 'Visit Completed',
        description: 'Treatment recorded and visit has been completed.',
      });

      // Navigate back based on role
      if (staff.role === 'doctor' || staff.role === 'admin') {
        navigate('/waiting');
      } else {
        navigate(`/patient/${visit.patient_id}`);
      }
    } catch (error) {
      console.error('Error completing visit:', error);
      toast({
        title: 'Error',
        description: 'Failed to complete visit. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Loading treatment data...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!visit) {
    return (
      <PageContainer>
        <div className="text-center py-16">
          <h2 className="text-xl font-semibold">Visit not found</h2>
          <TabletButton className="mt-4" onClick={() => navigate('/waiting')}>
            Back to Waiting Area
          </TabletButton>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="lg">
      <PageHeader 
        title="Treatment Administration"
        subtitle={`Visit #${visit.visit_number}`}
        backButton={
          <TabletButton 
            variant="ghost" 
            size="icon" 
            onClick={() => navigate('/waiting')}
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </TabletButton>
        }
      />

      {/* Patient Info */}
      <TabletCard className="mb-6">
        <TabletCardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">{visit.patient.full_name}</h3>
              <p className="text-sm text-muted-foreground">{visit.patient.phone_number}</p>
            </div>
          </div>
        </TabletCardContent>
      </TabletCard>

      {/* Vitals Summary */}
      {visit.vitals_completed && (
        <TabletCard className="mb-6">
          <TabletCardContent className="p-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              Vitals Recorded
            </h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              {visit.weight_kg && (
                <div>
                  <p className="text-muted-foreground">Weight</p>
                  <p className="font-medium">{visit.weight_kg} kg</p>
                </div>
              )}
              {visit.blood_pressure_systolic && (
                <div>
                  <p className="text-muted-foreground">BP</p>
                  <p className="font-medium">{visit.blood_pressure_systolic}/{visit.blood_pressure_diastolic}</p>
                </div>
              )}
              {visit.heart_rate && (
                <div>
                  <p className="text-muted-foreground">Heart Rate</p>
                  <p className="font-medium">{visit.heart_rate} bpm</p>
                </div>
              )}
            </div>
          </TabletCardContent>
        </TabletCard>
      )}

      {/* Treatments */}
      <div className="space-y-4 mb-6">
        <h4 className="font-medium flex items-center gap-2">
          <Syringe className="h-4 w-4" />
          Treatments to Administer
        </h4>

        {treatments.map((treatment, index) => {
          const pkg = packages.find(p => p.treatment_id === treatment.treatmentId);
          
          return (
            <TabletCard key={treatment.treatmentId}>
              <TabletCardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-semibold">{treatment.treatmentName}</h5>
                  {pkg && (
                    <span className="text-sm text-muted-foreground">
                      {pkg.sessions_remaining} sessions left
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Dose</label>
                    <div className="flex gap-2">
                      <TabletInput
                        type="text"
                        placeholder="Amount"
                        value={treatment.doseAdministered}
                        onChange={(e) => updateTreatment(index, 'doseAdministered', e.target.value)}
                        className="flex-1"
                      />
                      <span className="flex items-center px-3 bg-muted rounded-lg text-sm">
                        {treatment.doseUnit}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Details (optional)</label>
                    <TabletInput
                      type="text"
                      placeholder="e.g. IV, Left arm"
                      value={treatment.administrationDetails}
                      onChange={(e) => updateTreatment(index, 'administrationDetails', e.target.value)}
                    />
                  </div>
                </div>
              </TabletCardContent>
            </TabletCard>
          );
        })}
      </div>

      {/* Doctor Notes */}
      <TabletCard className="mb-6">
        <TabletCardContent className="p-4">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Doctor Notes (optional)
          </h4>
          <Textarea
            placeholder="Add any notes about this visit..."
            value={doctorNotes}
            onChange={(e) => setDoctorNotes(e.target.value)}
            rows={3}
            className="resize-none"
          />
        </TabletCardContent>
      </TabletCard>

      {/* Complete Button */}
      <TabletButton
        fullWidth
        size="lg"
        onClick={handleCompleteVisit}
        isLoading={isSaving}
        leftIcon={<CheckCircle />}
      >
        Complete Visit
      </TabletButton>
    </PageContainer>
  );
}
