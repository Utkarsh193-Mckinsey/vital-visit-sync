import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletCard, TabletCardContent } from '@/components/ui/tablet-card';
import { TabletInput } from '@/components/ui/tablet-input';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Save, User, Activity } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Visit, Patient } from '@/types/database';

interface VisitWithPatient extends Visit {
  patient: Patient;
}

// Normal ranges for vital signs - values outside these will show red
const VITAL_RANGES: Record<string, { min: number; max: number }> = {
  temperature: { min: 36.1, max: 37.2 },
  blood_pressure_systolic: { min: 90, max: 140 },
  blood_pressure_diastolic: { min: 60, max: 90 },
  heart_rate: { min: 60, max: 100 },
  respiratory_rate: { min: 12, max: 20 },
  spo2: { min: 95, max: 100 },
  sugar: { min: 70, max: 140 },
};

function isOutOfRange(field: string, value: string): boolean {
  const range = VITAL_RANGES[field];
  if (!range || !value) return false;
  const num = parseFloat(value);
  if (isNaN(num)) return false;
  return num < range.min || num > range.max;
}

export default function VitalsEntry() {
  const { visitId } = useParams<{ visitId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { staff } = useAuth();
  
  const [visit, setVisit] = useState<VisitWithPatient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [vitals, setVitals] = useState({
    temperature: '',
    heart_rate: '',
    blood_pressure_systolic: '',
    blood_pressure_diastolic: '',
    height_cm: '',
    weight_kg: '',
    respiratory_rate: '',
    spo2: '',
    hip_cm: '',
    waist_cm: '',
    head_circumference_cm: '',
    sugar: '',
    urinalysis: '',
    other_details: '',
    lmp: '',
  });
  const [selectedNurseId, setSelectedNurseId] = useState('');
  const [nurses, setNurses] = useState<{ id: string; full_name: string }[]>([]);

  useEffect(() => {
    const fetchVisit = async () => {
      if (!visitId) return;

      const { data, error } = await supabase
        .from('visits')
        .select(`
          *,
          patient:patients (*)
        `)
        .eq('id', visitId)
        .single();

      if (error) {
        console.error('Error fetching visit:', error);
        toast({
          title: 'Error',
          description: 'Failed to load visit details.',
          variant: 'destructive',
        });
        navigate('/waiting');
        return;
      }

      const visitData = data as unknown as VisitWithPatient;
      setVisit(visitData);
      
      // Pre-fill existing vitals if any
      setVitals({
        temperature: visitData.temperature?.toString() || '',
        heart_rate: visitData.heart_rate?.toString() || '',
        blood_pressure_systolic: visitData.blood_pressure_systolic?.toString() || '',
        blood_pressure_diastolic: visitData.blood_pressure_diastolic?.toString() || '',
        height_cm: visitData.height_cm?.toString() || '',
        weight_kg: visitData.weight_kg?.toString() || '',
        respiratory_rate: visitData.respiratory_rate?.toString() || '',
        spo2: visitData.spo2?.toString() || '',
        hip_cm: visitData.hip_cm?.toString() || '',
        waist_cm: visitData.waist_cm?.toString() || '',
        head_circumference_cm: visitData.head_circumference_cm?.toString() || '',
        sugar: visitData.sugar?.toString() || '',
        urinalysis: visitData.urinalysis || '',
        other_details: visitData.other_details || '',
        lmp: visitData.lmp || '',
      });
      
      setIsLoading(false);
    };

    const fetchNurses = async () => {
      const { data } = await supabase
        .from('staff')
        .select('id, full_name')
        .eq('status', 'active')
        .eq('role', 'nurse')
        .order('full_name');
      if (data) setNurses(data);
    };

    fetchVisit();
    fetchNurses();
  }, [visitId, navigate, toast]);

  const handleSaveVitals = async () => {
    if (!visitId) return;
    
    setIsSaving(true);

    if (!selectedNurseId) {
      toast({
        title: 'Select Nurse',
        description: 'Please select who is recording vitals.',
        variant: 'destructive',
      });
      setIsSaving(false);
      return;
    }

    const updateData: Record<string, unknown> = {
      vitals_completed: true,
      nurse_staff_id: selectedNurseId,
    };

    if (vitals.temperature) updateData.temperature = parseFloat(vitals.temperature);
    if (vitals.heart_rate) updateData.heart_rate = parseInt(vitals.heart_rate);
    if (vitals.blood_pressure_systolic) updateData.blood_pressure_systolic = parseInt(vitals.blood_pressure_systolic);
    if (vitals.blood_pressure_diastolic) updateData.blood_pressure_diastolic = parseInt(vitals.blood_pressure_diastolic);
    if (vitals.height_cm) updateData.height_cm = parseFloat(vitals.height_cm);
    if (vitals.weight_kg) updateData.weight_kg = parseFloat(vitals.weight_kg);
    if (vitals.respiratory_rate) updateData.respiratory_rate = parseInt(vitals.respiratory_rate);
    if (vitals.spo2) updateData.spo2 = parseInt(vitals.spo2);
    if (vitals.hip_cm) updateData.hip_cm = parseFloat(vitals.hip_cm);
    if (vitals.waist_cm) updateData.waist_cm = parseFloat(vitals.waist_cm);
    if (vitals.head_circumference_cm) updateData.head_circumference_cm = parseFloat(vitals.head_circumference_cm);
    if (vitals.sugar) updateData.sugar = parseFloat(vitals.sugar);
    if (vitals.urinalysis) updateData.urinalysis = vitals.urinalysis;
    if (vitals.other_details) updateData.other_details = vitals.other_details;
    if (vitals.lmp) updateData.lmp = vitals.lmp;

    const { error } = await supabase
      .from('visits')
      .update(updateData)
      .eq('id', visitId);

    if (error) {
      console.error('Error saving vitals:', error);
      toast({
        title: 'Error',
        description: 'Failed to save vitals. Please try again.',
        variant: 'destructive',
      });
      setIsSaving(false);
      return;
    }

    toast({
      title: 'Vitals saved',
      description: 'Patient vitals have been recorded successfully.',
    });

    if (staff?.role === 'doctor') {
      navigate(`/visit/${visitId}/treatment`);
    } else {
      navigate('/waiting');
    }
  };

  const handleBack = () => {
    navigate('/waiting');
  };

  const updateVital = (field: string, value: string) => {
    setVitals(prev => ({ ...prev, [field]: value }));
  };

  const vitalInputClass = (field: string) =>
    isOutOfRange(field, vitals[field as keyof typeof vitals])
      ? 'border-destructive text-destructive focus-visible:ring-destructive'
      : '';

  if (isLoading) {
    return (
      <PageContainer maxWidth="md">
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Loading visit details...</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!visit) {
    return (
      <PageContainer maxWidth="md">
        <div className="text-center py-16">
          <p className="text-muted-foreground">Visit not found.</p>
          <TabletButton onClick={handleBack} className="mt-4">
            Back to Waiting Area
          </TabletButton>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer maxWidth="lg">
      <PageHeader
        title="Record Vitals"
        subtitle={visit.patient.full_name}
        action={
          <TabletButton
            variant="ghost"
            onClick={handleBack}
            leftIcon={<ArrowLeft />}
          >
            Back
          </TabletButton>
        }
      />

      <TabletCard className="mb-6">
        <TabletCardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">{visit.patient.full_name}</h3>
              <p className="text-sm text-muted-foreground">
                Visit #{visit.visit_number}
              </p>
            </div>
          </div>
        </TabletCardContent>
      </TabletCard>

      <TabletCard>
        <TabletCardContent className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-semibold">Vital Signs</h3>
            </div>
            <p className="text-sm text-destructive font-medium">
              Required fields are marked with *
            </p>
          </div>

          {/* Nurse Selection */}
          <div className="mb-6">
            <label className="text-sm font-medium mb-1 block">Recorded By (Nurse / Beauty Therapist) *</label>
            <Select value={selectedNurseId} onValueChange={setSelectedNurseId}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="Select your name" />
              </SelectTrigger>
              <SelectContent>
                {nurses.map(n => (
                  <SelectItem key={n.id} value={n.id} className="py-3">
                    {n.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Row 1: Temperature, Pulse, BPS, BPD, Height, Weight */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
            <TabletInput
              label="Temperature *"
              type="number"
              placeholder="Enter Temperature"
              value={vitals.temperature}
              onChange={(e) => updateVital('temperature', e.target.value)}
              className={vitalInputClass('temperature')}
            />
            <TabletInput
              label="Pulse *"
              type="number"
              placeholder="Enter Pulse"
              value={vitals.heart_rate}
              onChange={(e) => updateVital('heart_rate', e.target.value)}
              className={vitalInputClass('heart_rate')}
            />
            <TabletInput
              label="BPS *"
              type="number"
              placeholder="Enter BPS"
              value={vitals.blood_pressure_systolic}
              onChange={(e) => updateVital('blood_pressure_systolic', e.target.value)}
              className={vitalInputClass('blood_pressure_systolic')}
            />
            <TabletInput
              label="BPD *"
              type="number"
              placeholder="Enter BPD"
              value={vitals.blood_pressure_diastolic}
              onChange={(e) => updateVital('blood_pressure_diastolic', e.target.value)}
              className={vitalInputClass('blood_pressure_diastolic')}
            />
            <TabletInput
              label="Height (cm)"
              type="number"
              placeholder="Enter Height"
              value={vitals.height_cm}
              onChange={(e) => updateVital('height_cm', e.target.value)}
            />
            <TabletInput
              label="Weight (kg)"
              type="number"
              placeholder="Enter Weight"
              value={vitals.weight_kg}
              onChange={(e) => updateVital('weight_kg', e.target.value)}
            />
          </div>

          {/* Row 2: Respiratory, SpO2, Hip, Waist, Head Circumference, Sugar */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
            <TabletInput
              label="Respiratory"
              type="number"
              placeholder="Enter Respiratory"
              value={vitals.respiratory_rate}
              onChange={(e) => updateVital('respiratory_rate', e.target.value)}
              className={vitalInputClass('respiratory_rate')}
            />
            <TabletInput
              label="SpO2 *"
              type="number"
              placeholder="Enter SpO2"
              value={vitals.spo2}
              onChange={(e) => updateVital('spo2', e.target.value)}
              className={vitalInputClass('spo2')}
            />
            <TabletInput
              label="Hip (cm)"
              type="number"
              placeholder="Enter Hip"
              value={vitals.hip_cm}
              onChange={(e) => updateVital('hip_cm', e.target.value)}
            />
            <TabletInput
              label="Waist (cm)"
              type="number"
              placeholder="Enter Waist"
              value={vitals.waist_cm}
              onChange={(e) => updateVital('waist_cm', e.target.value)}
            />
            <TabletInput
              label="Head Circumference"
              type="number"
              placeholder="Enter Head Circ."
              value={vitals.head_circumference_cm}
              onChange={(e) => updateVital('head_circumference_cm', e.target.value)}
            />
            <TabletInput
              label="Sugar"
              type="number"
              placeholder="Enter Sugar"
              value={vitals.sugar}
              onChange={(e) => updateVital('sugar', e.target.value)}
              className={vitalInputClass('sugar')}
            />
          </div>

          {/* Row 3: Urinalysis, Other Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <TabletInput
              label="Urinalysis"
              type="text"
              placeholder="Enter Urinalysis"
              value={vitals.urinalysis}
              onChange={(e) => updateVital('urinalysis', e.target.value)}
            />
            <TabletInput
              label="Other Details"
              type="text"
              placeholder="Enter Other Details"
              value={vitals.other_details}
              onChange={(e) => updateVital('other_details', e.target.value)}
            />
          </div>

          {/* Row 4: LMP */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <TabletInput
              label="LMP (Last Menstrual Period)"
              type="text"
              placeholder="Enter Details"
              value={vitals.lmp}
              onChange={(e) => updateVital('lmp', e.target.value)}
            />
          </div>

          <div className="mt-8">
            <TabletButton
              onClick={handleSaveVitals}
              isLoading={isSaving}
              leftIcon={<Save />}
              className="w-full"
              size="lg"
            >
              Save Vitals
            </TabletButton>
          </div>
        </TabletCardContent>
      </TabletCard>
    </PageContainer>
  );
}
