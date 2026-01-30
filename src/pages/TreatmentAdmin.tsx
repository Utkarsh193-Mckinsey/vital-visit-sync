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
import { ArrowLeft, CheckCircle, Syringe, FileText, User, Package, AlertTriangle, FileSignature } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { InlineConsentModal } from '@/components/treatment/InlineConsentModal';
import type { Visit, Patient, Treatment } from '@/types/database';

interface VisitWithPatient extends Omit<Visit, 'consent_forms'> {
  patient: Patient;
}

interface ConsentFormRecord {
  id: string;
  treatment_id: string;
}

interface PackageWithTreatment {
  id: string;
  patient_id: string;
  treatment_id: string;
  sessions_purchased: number;
  sessions_remaining: number;
  status: string;
  treatment: Treatment;
}

interface TreatmentEntry {
  packageId: string;
  treatmentId: string;
  treatmentName: string;
  doseAdministered: string;
  doseUnit: string;
  administrationDetails: string;
  sessionsRemaining: number;
  sessionsPurchased: number;
  commonDoses: string[];
  hasConsentSigned: boolean;
}

export default function TreatmentAdmin() {
  const { visitId } = useParams<{ visitId: string }>();
  const [visit, setVisit] = useState<VisitWithPatient | null>(null);
  const [treatments, setTreatments] = useState<TreatmentEntry[]>([]);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [consentWarning, setConsentWarning] = useState<{ treatmentName: string; treatmentId: string; index: number } | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const { staff } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchVisitData();
  }, [visitId]);

  const fetchVisitData = async () => {
    if (!visitId) return;

    try {
      // Fetch visit with patient
      const { data: visitData, error: visitError } = await supabase
        .from('visits')
        .select(`
          *,
          patient:patients (*)
        `)
        .eq('id', visitId)
        .single();

      if (visitError) throw visitError;
      setVisit(visitData as unknown as VisitWithPatient);
      setDoctorNotes(visitData.doctor_notes || '');

      // Fetch consent forms for this visit to know which treatments have signed consent
      const { data: consentFormsData, error: consentError } = await supabase
        .from('consent_forms')
        .select('id, treatment_id')
        .eq('visit_id', visitId);

      if (consentError) throw consentError;
      
      const signedTreatmentIds = new Set(
        (consentFormsData as ConsentFormRecord[]).map(cf => cf.treatment_id)
      );

      // Fetch ALL active packages for this patient
      const { data: packagesData, error: packagesError } = await supabase
        .from('packages')
        .select(`
          *,
          treatment:treatments (*)
        `)
        .eq('patient_id', visitData.patient_id)
        .eq('status', 'active')
        .gt('sessions_remaining', 0);

      if (packagesError) throw packagesError;

      // Initialize treatment entries from ALL packages
      const entries: TreatmentEntry[] = (packagesData as unknown as PackageWithTreatment[]).map((pkg) => ({
        packageId: pkg.id,
        treatmentId: pkg.treatment_id,
        treatmentName: pkg.treatment?.treatment_name || 'Unknown Treatment',
        doseAdministered: '',
        doseUnit: pkg.treatment?.dosage_unit || 'Session',
        administrationDetails: '',
        sessionsRemaining: pkg.sessions_remaining,
        sessionsPurchased: pkg.sessions_purchased,
        commonDoses: (pkg.treatment?.common_doses as string[]) || [],
        hasConsentSigned: signedTreatmentIds.has(pkg.treatment_id),
      }));
      
      setTreatments(entries);
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

  const handleDoseChange = (index: number, value: string) => {
    const treatment = treatments[index];
    
    // Treat "__skip__" as empty (clearing the dose)
    const actualValue = value === '__skip__' ? '' : value;
    
    // If trying to set a dose but consent not signed, show warning
    if (actualValue && !treatment.hasConsentSigned) {
      setConsentWarning({ treatmentName: treatment.treatmentName, treatmentId: treatment.treatmentId, index });
      return;
    }
    
    setTreatments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], doseAdministered: actualValue };
      return updated;
    });
  };

  const updateTreatmentDetails = (index: number, value: string) => {
    setTreatments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], administrationDetails: value };
      return updated;
    });
  };

  const handleCompleteVisit = async () => {
    if (!visit || !staff) return;

    // Filter only treatments that have a dose entered (non-empty)
    const treatmentsToAdminister = treatments.filter(t => t.doseAdministered.trim() !== '');

    setIsSaving(true);

    try {
      // First update visit (without locking) so RLS allows subsequent updates
      const { error: visitUpdateError } = await supabase
        .from('visits')
        .update({
          current_status: 'completed',
          treatment_completed: true,
          doctor_notes: doctorNotes || null,
          doctor_staff_id: staff.id,
          completed_date: new Date().toISOString(),
        })
        .eq('id', visitId);

      if (visitUpdateError) throw visitUpdateError;

      // Insert visit treatments and deduct sessions ONLY for treatments with dose
      for (const treatment of treatmentsToAdminister) {
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
        const newRemaining = treatment.sessionsRemaining - 1;
        const { error: pkgError } = await supabase
          .from('packages')
          .update({
            sessions_remaining: newRemaining,
            status: newRemaining <= 0 ? 'depleted' : 'active',
          })
          .eq('id', treatment.packageId);

        if (pkgError) throw pkgError;
      }

      // Finally lock the visit (last operation since RLS checks is_locked)
      const { error: lockError } = await supabase
        .from('visits')
        .update({ is_locked: true })
        .eq('id', visitId);

      if (lockError) {
        console.warn('Could not lock visit:', lockError);
      }

      const treatmentCount = treatmentsToAdminister.length;
      toast({
        title: 'Visit Completed',
        description: treatmentCount > 0 
          ? `${treatmentCount} treatment(s) recorded and visit completed.`
          : 'Visit completed with no treatments administered.',
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

  const treatmentsWithDose = treatments.filter(t => t.doseAdministered.trim() !== '');

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
              <CheckCircle className="h-4 w-4 text-green-600" />
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

      {/* Available Packages / Treatments */}
      <div className="space-y-4 mb-6">
        <h4 className="font-medium flex items-center gap-2">
          <Package className="h-4 w-4" />
          Patient's Active Packages
          <span className="text-sm text-muted-foreground font-normal">
            (Select dose for treatments to administer)
          </span>
        </h4>

        {treatments.length === 0 ? (
          <TabletCard>
            <TabletCardContent className="p-6 text-center">
              <p className="text-muted-foreground">No active packages found for this patient.</p>
            </TabletCardContent>
          </TabletCard>
        ) : (
          treatments.map((treatment, index) => (
            <TabletCard 
              key={treatment.packageId}
              className={!treatment.hasConsentSigned ? 'border-warning/50' : ''}
            >
              <TabletCardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-semibold flex items-center gap-2">
                    <Syringe className="h-4 w-4 text-primary" />
                    {treatment.treatmentName}
                    {!treatment.hasConsentSigned && (
                      <span className="inline-flex items-center gap-1 text-xs text-warning bg-warning/10 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="h-3 w-3" />
                        No consent
                      </span>
                    )}
                  </h5>
                  <span className="text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded">
                    {treatment.sessionsRemaining} of {treatment.sessionsPurchased} sessions left
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Dose <span className="text-muted-foreground font-normal">(leave empty to skip)</span>
                    </label>
                    {treatment.commonDoses.length > 0 ? (
                      <Select
                        value={treatment.doseAdministered}
                        onValueChange={(value) => handleDoseChange(index, value)}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Select dose" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__skip__" className="text-muted-foreground">
                            -- Skip (no dose) --
                          </SelectItem>
                          {treatment.commonDoses.map((dose) => (
                            <SelectItem key={dose} value={dose} className="py-3">
                              {dose} {treatment.doseUnit}
                            </SelectItem>
                          ))}
                          <SelectItem value="custom" className="py-3 text-muted-foreground">
                            Custom dose...
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex gap-2">
                        <TabletInput
                          type="text"
                          placeholder="Amount"
                          value={treatment.doseAdministered}
                          onChange={(e) => handleDoseChange(index, e.target.value)}
                          className="flex-1"
                        />
                        <span className="flex items-center px-3 bg-muted rounded-lg text-sm">
                          {treatment.doseUnit}
                        </span>
                      </div>
                    )}
                    {treatment.doseAdministered === 'custom' && treatment.commonDoses.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        <TabletInput
                          type="text"
                          placeholder="Enter custom dose"
                          onChange={(e) => {
                            if (e.target.value) {
                              handleDoseChange(index, e.target.value);
                            }
                          }}
                          className="flex-1"
                        />
                        <span className="flex items-center px-3 bg-muted rounded-lg text-sm">
                          {treatment.doseUnit}
                        </span>
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Details (optional)</label>
                    <TabletInput
                      type="text"
                      placeholder="e.g. IV, Left arm"
                      value={treatment.administrationDetails}
                      onChange={(e) => updateTreatmentDetails(index, e.target.value)}
                    />
                  </div>
                </div>
              </TabletCardContent>
            </TabletCard>
          ))
        )}
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

      {/* Summary */}
      {treatmentsWithDose.length > 0 && (
        <div className="mb-4 p-3 bg-primary/5 rounded-lg border border-primary/20">
          <p className="text-sm">
            <strong>{treatmentsWithDose.length}</strong> treatment(s) will be administered:
            <span className="text-muted-foreground ml-1">
              {treatmentsWithDose.map(t => `${t.treatmentName} (${t.doseAdministered} ${t.doseUnit})`).join(', ')}
            </span>
          </p>
        </div>
      )}

      {/* Complete Button */}
      <TabletButton
        fullWidth
        size="lg"
        onClick={handleCompleteVisit}
        isLoading={isSaving}
        leftIcon={<CheckCircle />}
      >
        {treatmentsWithDose.length > 0 
          ? `Complete Visit (${treatmentsWithDose.length} treatment${treatmentsWithDose.length > 1 ? 's' : ''})`
          : 'Complete Visit (No Treatments)'
        }
      </TabletButton>

      {/* Consent Warning Dialog */}
      <AlertDialog open={!!consentWarning && !showConsentModal} onOpenChange={() => setConsentWarning(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-warning">
              <AlertTriangle className="h-5 w-5" />
              Consent Not Signed
            </AlertDialogTitle>
            <AlertDialogDescription>
              The patient has not signed consent for <strong>{consentWarning?.treatmentName}</strong> during this visit.
              Please have the patient sign the consent form before administering this treatment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => setShowConsentModal(true)}
              className="bg-primary"
            >
              <FileSignature className="h-4 w-4 mr-2" />
              Sign Consent Now
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Inline Consent Signing Modal */}
      {visit && consentWarning && (
        <InlineConsentModal
          open={showConsentModal}
          onClose={() => {
            setShowConsentModal(false);
            setConsentWarning(null);
          }}
          onConsentSigned={() => {
            // Refresh the consent status for this treatment
            fetchVisitData();
            setShowConsentModal(false);
            setConsentWarning(null);
          }}
          visitId={visit.id}
          patient={visit.patient}
          treatmentId={consentWarning.treatmentId}
          treatmentName={consentWarning.treatmentName}
        />
      )}
    </PageContainer>
  );
}