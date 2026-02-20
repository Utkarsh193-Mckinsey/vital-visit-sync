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
import { ArrowLeft, CheckCircle, Check, Syringe, FileText, User, Package, AlertTriangle, FileSignature, Plus, Save } from 'lucide-react';
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
 import { ConsumablesSelector, SelectedConsumable } from '@/components/treatment/ConsumablesSelector';
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
  isCustomDose: boolean;
  customDoseValue: string;
  customDoseUnit: string;
  customBrand: string;
  saveAsDefault: boolean;
  doctorId: string;
  nurseId: string;
}

interface StaffOption {
  id: string;
  full_name: string;
  role: string;
  title: string | null;
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
  const [selectedConsumables, setSelectedConsumables] = useState<SelectedConsumable[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedNurseId, setSelectedNurseId] = useState('');
  const [doctors, setDoctors] = useState<StaffOption[]>([]);
  const [nurses, setNurses] = useState<StaffOption[]>([]);
  const [doseUnits, setDoseUnits] = useState(['mg', 'ml', 'Units', 'mcg', 'Session', 'vial', 'pen', 'amp']);
  const [addingUnitForIndex, setAddingUnitForIndex] = useState<number | null>(null);
  const [newUnitValue, setNewUnitValue] = useState('');
  const [showCompletionConfirm, setShowCompletionConfirm] = useState(false);
  const { staff } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchVisitData();
    fetchStaffOptions();
  }, [visitId]);

  const fetchStaffOptions = async () => {
    const { data } = await supabase
      .from('staff')
      .select('id, full_name, role, title')
      .eq('status', 'active')
      .in('role', ['doctor', 'nurse'])
      .order('full_name');

    if (data) {
      setDoctors(data.filter(s => s.role === 'doctor'));
      setNurses(data.filter(s => s.role === 'nurse'));
    }
  };

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

      // Initialize treatment entries from ALL packages with default doses pre-filled
      const entries: TreatmentEntry[] = (packagesData as unknown as PackageWithTreatment[]).map((pkg) => ({
        packageId: pkg.id,
        treatmentId: pkg.treatment_id,
        treatmentName: pkg.treatment?.treatment_name || 'Unknown Treatment',
        doseAdministered: (pkg.treatment as any)?.default_dose || '',
        doseUnit: pkg.treatment?.dosage_unit || 'Session',
        administrationDetails: '',
        sessionsRemaining: pkg.sessions_remaining,
        sessionsPurchased: pkg.sessions_purchased,
        commonDoses: (pkg.treatment?.common_doses as string[]) || [],
        hasConsentSigned: signedTreatmentIds.has(pkg.treatment_id),
        isCustomDose: false,
        customDoseValue: '',
        customDoseUnit: pkg.treatment?.dosage_unit || 'Session',
        customBrand: '',
        saveAsDefault: false,
        doctorId: '',
        nurseId: '',
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

  const addNewUnit = (unit: string, index?: number) => {
    const trimmed = unit.trim();
    if (!trimmed) return;
    if (!doseUnits.includes(trimmed)) {
      setDoseUnits(prev => [...prev, trimmed]);
    }
    if (index !== undefined) {
      updateCustomField(index, 'customDoseUnit', trimmed);
    }
    setNewUnitValue('');
    setAddingUnitForIndex(null);
  };

  const DOSE_UNITS = doseUnits;

  const handleDoseChange = (index: number, value: string) => {
    const treatment = treatments[index];
    
    // Treat "__skip__" as empty (clearing the dose)
    const actualValue = value === '__skip__' ? '' : value;
    
    // If selecting custom, toggle custom mode
    if (value === 'custom') {
      setTreatments(prev => {
        const updated = [...prev];
        updated[index] = { ...updated[index], isCustomDose: true, doseAdministered: '' };
        return updated;
      });
      return;
    }
    
    // If trying to set a dose but consent not signed, show warning
    if (actualValue && !treatment.hasConsentSigned) {
      setConsentWarning({ treatmentName: treatment.treatmentName, treatmentId: treatment.treatmentId, index });
      return;
    }
    
    setTreatments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], doseAdministered: actualValue, isCustomDose: false };
      return updated;
    });
  };

  const handleCustomDoseConfirm = (index: number) => {
    const treatment = treatments[index];
    if (!treatment.customDoseValue.trim()) return;
    
    // Check consent
    if (!treatment.hasConsentSigned) {
      setConsentWarning({ treatmentName: treatment.treatmentName, treatmentId: treatment.treatmentId, index });
      return;
    }
    
    setTreatments(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        doseAdministered: treatment.customDoseValue.trim(),
        doseUnit: treatment.customDoseUnit,
      };
      return updated;
    });
  };

  const handleSaveCustomDoseAsDefault = async (index: number) => {
    const treatment = treatments[index];
    if (!treatment.customDoseValue.trim()) return;
    
    try {
      // Fetch current treatment to get existing common_doses
      const { data: treatmentData } = await supabase
        .from('treatments')
        .select('common_doses, dosage_unit')
        .eq('id', treatment.treatmentId)
        .single();
      
      const existingDoses: string[] = (treatmentData?.common_doses as string[]) || [];
      const newDose = treatment.customDoseValue.trim();
      
      if (!existingDoses.includes(newDose)) {
        const updatedDoses = [...existingDoses, newDose];
        await supabase
          .from('treatments')
          .update({ 
            common_doses: updatedDoses,
            dosage_unit: treatment.customDoseUnit as any,
          })
          .eq('id', treatment.treatmentId);
        
        // Update local state
        setTreatments(prev => {
          const updated = [...prev];
          updated[index] = {
            ...updated[index],
            commonDoses: updatedDoses,
            saveAsDefault: false,
          };
          return updated;
        });
        
        toast({
          title: 'Dose Saved',
          description: `${newDose} ${treatment.customDoseUnit} added as a default dose for ${treatment.treatmentName}.`,
        });
      }
    } catch (error) {
      console.error('Error saving custom dose:', error);
      toast({
        title: 'Error',
        description: 'Failed to save dose as default.',
        variant: 'destructive',
      });
    }
  };

  const updateTreatmentDetails = (index: number, value: string) => {
    setTreatments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], administrationDetails: value };
      return updated;
    });
  };

  const updateCustomField = (index: number, field: keyof TreatmentEntry, value: any) => {
    setTreatments(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleCompleteVisit = async () => {
    if (!visit || !staff) return;

    if (!selectedDoctorId) {
      toast({
        title: 'Select Doctor',
        description: 'Please select which doctor is administering the treatment.',
        variant: 'destructive',
      });
      return;
    }

    // Filter only treatments that have a dose entered (non-empty)
    const treatmentsToAdminister = treatments.filter(t => t.doseAdministered.trim() !== '');

    setIsSaving(true);

    try {
      const doctorId = selectedDoctorId;
      const nurseId = selectedNurseId && selectedNurseId !== '__none__' ? selectedNurseId : null;

      // First update visit (without locking) so RLS allows subsequent updates
      const { error: visitUpdateError } = await supabase
        .from('visits')
        .update({
          current_status: 'completed',
          treatment_completed: true,
          doctor_notes: doctorNotes || null,
          doctor_staff_id: doctorId,
          nurse_staff_id: nurseId,
          completed_date: new Date().toISOString(),
        })
        .eq('id', visitId);

      if (visitUpdateError) throw visitUpdateError;

      // Insert visit treatments and deduct sessions ONLY for treatments with dose
      for (const treatment of treatmentsToAdminister) {
        const treatmentDoctorId = (treatment.doctorId && treatment.doctorId !== '__default__') ? treatment.doctorId : doctorId;
        const treatmentNurseId = (treatment.nurseId && treatment.nurseId !== '__default__' && treatment.nurseId !== '__none__') ? treatment.nurseId : nurseId;
        
        // Insert visit treatment
        const { error: treatmentError } = await supabase
          .from('visit_treatments')
          .insert({
            visit_id: visitId,
            treatment_id: treatment.treatmentId,
            package_id: treatment.packageId,
            dose_administered: treatment.doseAdministered,
            dose_unit: treatment.doseUnit,
            administration_details: [treatment.customBrand, treatment.administrationDetails].filter(Boolean).join(' - ') || null,
            performed_by: treatmentDoctorId,
            sessions_deducted: 1,
            doctor_staff_id: treatmentDoctorId,
            nurse_staff_id: treatmentNurseId,
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

       // Insert consumables used
       if (selectedConsumables.length > 0) {
         for (const consumable of selectedConsumables) {
           const { error: consumableError } = await supabase
             .from('visit_consumables')
             .insert({
               visit_id: visitId,
               stock_item_id: consumable.stockItemId,
               quantity_used: consumable.quantity,
               notes: consumable.notes || null,
               recorded_by: staff.id,
             });
 
           if (consumableError) {
             console.error('Error recording consumable:', consumableError);
           }
         }
       }
 
      const treatmentCount = treatmentsToAdminister.length;
      toast({
        title: 'Visit Completed',
        description: treatmentCount > 0 
           ? `${treatmentCount} treatment(s) and ${selectedConsumables.length} consumable(s) recorded.`
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

      {/* Default Staff Selection (applies to all treatments unless overridden) */}
      <TabletCard className="mb-6">
        <TabletCardContent className="p-4">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <User className="h-4 w-4" />
            Default Performed By <span className="text-sm text-muted-foreground font-normal">(can override per treatment)</span>
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Doctor</label>
              <Select value={selectedDoctorId} onValueChange={setSelectedDoctorId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select doctor" />
                </SelectTrigger>
                <SelectContent>
                  {doctors.map(d => (
                    <SelectItem key={d.id} value={d.id} className="py-3">
                      {d.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Nurse / Beauty Therapist</label>
              <Select value={selectedNurseId} onValueChange={setSelectedNurseId}>
                <SelectTrigger className="h-12">
                  <SelectValue placeholder="Select nurse (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__" className="text-muted-foreground">-- None --</SelectItem>
                  {nurses.map(n => (
                    <SelectItem key={n.id} value={n.id} className="py-3">
                      {n.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setConsentWarning({ treatmentName: treatment.treatmentName, treatmentId: treatment.treatmentId, index });
                          setShowConsentModal(true);
                        }}
                        className="inline-flex items-center gap-1 text-xs text-warning bg-warning/10 px-2 py-0.5 rounded-full hover:bg-warning/20 transition-colors cursor-pointer"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        No consent — Sign now
                      </button>
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
                    {treatment.commonDoses.length > 0 && !treatment.isCustomDose ? (
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
                            + Custom dose...
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    ) : treatment.isCustomDose ? (
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <TabletInput
                            type="text"
                            placeholder="Dose value (e.g. 2.5)"
                            value={treatment.customDoseValue}
                            onChange={(e) => updateCustomField(index, 'customDoseValue', e.target.value)}
                            className="flex-1"
                          />
                          {addingUnitForIndex === index ? (
                            <div className="flex gap-1">
                              <TabletInput
                                type="text"
                                placeholder="New unit"
                                value={newUnitValue}
                                onChange={(e) => setNewUnitValue(e.target.value)}
                                className="w-20 h-12"
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') addNewUnit(newUnitValue, index);
                                  if (e.key === 'Escape') setAddingUnitForIndex(null);
                                }}
                              />
                              <TabletButton size="icon" className="h-12 w-10" onClick={() => addNewUnit(newUnitValue, index)}>
                                <Check className="h-3 w-3" />
                              </TabletButton>
                            </div>
                          ) : (
                            <div className="flex gap-1">
                              <Select
                                value={treatment.customDoseUnit}
                                onValueChange={(value) => updateCustomField(index, 'customDoseUnit', value)}
                              >
                                <SelectTrigger className="w-24 h-12">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {DOSE_UNITS.map((unit) => (
                                    <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <TabletButton
                                size="icon"
                                variant="ghost"
                                className="h-12 w-8"
                                onClick={() => { setAddingUnitForIndex(index); setNewUnitValue(''); }}
                              >
                                <Plus className="h-3 w-3" />
                              </TabletButton>
                            </div>
                          )}
                        </div>
                        <TabletInput
                          type="text"
                          placeholder="Brand name (optional)"
                          value={treatment.customBrand}
                          onChange={(e) => updateCustomField(index, 'customBrand', e.target.value)}
                        />
                        <div className="flex items-center gap-3">
                          <TabletButton
                            size="sm"
                            onClick={() => handleCustomDoseConfirm(index)}
                            leftIcon={<CheckCircle className="h-3 w-3" />}
                            disabled={!treatment.customDoseValue.trim()}
                          >
                            Use This Dose
                          </TabletButton>
                          <TabletButton
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              handleCustomDoseConfirm(index);
                              handleSaveCustomDoseAsDefault(index);
                            }}
                            leftIcon={<Save className="h-3 w-3" />}
                            disabled={!treatment.customDoseValue.trim()}
                          >
                            Use & Save as Default
                          </TabletButton>
                          {treatment.commonDoses.length > 0 && (
                            <TabletButton
                              size="sm"
                              variant="ghost"
                              onClick={() => updateCustomField(index, 'isCustomDose', false)}
                            >
                              Cancel
                            </TabletButton>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
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
                        <TabletButton
                          size="sm"
                          variant="ghost"
                          onClick={() => updateCustomField(index, 'isCustomDose', true)}
                          leftIcon={<Plus className="h-3 w-3" />}
                          className="text-xs"
                        >
                          Create new dose with unit & brand
                        </TabletButton>
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

                {/* Per-treatment staff override */}
                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-dashed">
                  <div>
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Doctor (override)</label>
                    <Select value={treatment.doctorId} onValueChange={(v) => updateCustomField(index, 'doctorId', v)}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Use default" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default__" className="text-muted-foreground">Use default</SelectItem>
                        {doctors.map(d => (
                          <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Nurse (override)</label>
                    <Select value={treatment.nurseId} onValueChange={(v) => updateCustomField(index, 'nurseId', v)}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Use default" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default__" className="text-muted-foreground">Use default</SelectItem>
                        <SelectItem value="__none__" className="text-muted-foreground">-- None --</SelectItem>
                        {nurses.map(n => (
                          <SelectItem key={n.id} value={n.id}>{n.full_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </TabletCardContent>
            </TabletCard>
          ))
        )}
      </div>

      {/* Doctor Notes */}
       {/* Consumables Selection */}
       <div className="mb-6">
         <ConsumablesSelector
           selectedConsumables={selectedConsumables}
           onConsumablesChange={setSelectedConsumables}
           treatmentIds={treatments.map(t => t.treatmentId)}
         />
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