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
import type { Visit, Patient } from '@/types/database';

interface VisitWithPatient extends Visit {
  patient: Patient;
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
    weight_kg: '',
    blood_pressure_systolic: '',
    blood_pressure_diastolic: '',
    heart_rate: '',
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
        weight_kg: visitData.weight_kg?.toString() || '',
        blood_pressure_systolic: visitData.blood_pressure_systolic?.toString() || '',
        blood_pressure_diastolic: visitData.blood_pressure_diastolic?.toString() || '',
        heart_rate: visitData.heart_rate?.toString() || '',
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

    if (vitals.weight_kg) updateData.weight_kg = parseFloat(vitals.weight_kg);
    if (vitals.blood_pressure_systolic) updateData.blood_pressure_systolic = parseInt(vitals.blood_pressure_systolic);
    if (vitals.blood_pressure_diastolic) updateData.blood_pressure_diastolic = parseInt(vitals.blood_pressure_diastolic);
    if (vitals.heart_rate) updateData.heart_rate = parseInt(vitals.heart_rate);

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

    // Navigate to treatment or back to waiting based on role
    if (staff?.role === 'doctor') {
      // Doctor can proceed to treatment
      navigate(`/visit/${visitId}/treatment`);
    } else {
      // Nurse goes back to waiting area
      navigate('/waiting');
    }
  };

  const handleBack = () => {
    navigate('/waiting');
  };

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
    <PageContainer maxWidth="md">
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
          <div className="flex items-center gap-3 mb-4">
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
          <div className="flex items-center gap-2 mb-6">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-semibold">Vital Signs</h3>
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

          <div className="space-y-6">
            <TabletInput
              label="Weight (kg)"
              type="number"
              placeholder="Enter weight"
              value={vitals.weight_kg}
              onChange={(e) => setVitals({ ...vitals, weight_kg: e.target.value })}
            />

            <div className="grid grid-cols-2 gap-4">
              <TabletInput
                label="Systolic BP (mmHg)"
                type="number"
                placeholder="Systolic"
                value={vitals.blood_pressure_systolic}
                onChange={(e) => setVitals({ ...vitals, blood_pressure_systolic: e.target.value })}
              />
              <TabletInput
                label="Diastolic BP (mmHg)"
                type="number"
                placeholder="Diastolic"
                value={vitals.blood_pressure_diastolic}
                onChange={(e) => setVitals({ ...vitals, blood_pressure_diastolic: e.target.value })}
              />
            </div>

            <TabletInput
              label="Heart Rate (bpm)"
              type="number"
              placeholder="Enter heart rate"
              value={vitals.heart_rate}
              onChange={(e) => setVitals({ ...vitals, heart_rate: e.target.value })}
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
