import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { TabletButton } from '@/components/ui/tablet-button';
import { Label } from '@/components/ui/label';

const TREATMENT_INTERESTS = ['Hair', 'Skin', 'Fat Loss', 'IV'];

interface ConsultationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: any;
  onComplete: () => void;
}

export function ConsultationModal({ open, onOpenChange, patient, onComplete }: ConsultationModalProps) {
  const [doctors, setDoctors] = useState<{ id: string; full_name: string }[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const fetchDoctors = async () => {
      const { data } = await supabase
        .from('staff')
        .select('id, full_name')
        .eq('status', 'active')
        .eq('role', 'doctor')
        .order('full_name');
      if (data) setDoctors(data);
    };
    if (open) fetchDoctors();
  }, [open]);

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const handleConfirm = async () => {
    if (!selectedDoctorId) {
      toast({ title: 'Select Doctor', description: 'Please select the consulting doctor.', variant: 'destructive' });
      return;
    }
    if (selectedInterests.length === 0) {
      toast({ title: 'Select Treatment', description: 'Please select at least one treatment interest.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('patients').update({
        consultation_status: 'consulted',
        consultation_done_by: selectedDoctorId,
        consultation_date: new Date().toISOString(),
        treatment_interests: selectedInterests,
      } as any).eq('id', patient.id);

      if (error) throw error;

      toast({ title: 'Consultation Recorded', description: `${patient.full_name}'s consultation has been completed.` });
      onComplete();
      onOpenChange(false);
    } catch (error) {
      console.error('Error recording consultation:', error);
      toast({ title: 'Error', description: 'Failed to record consultation.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Consultation — {patient?.full_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Consultation Done By *</Label>
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

          <div className="space-y-3">
            <Label className="text-sm font-medium">Treatment Interested In *</Label>
            <div className="grid grid-cols-2 gap-3">
              {TREATMENT_INTERESTS.map(interest => (
                <label
                  key={interest}
                  className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:bg-accent transition-colors"
                >
                  <Checkbox
                    checked={selectedInterests.includes(interest)}
                    onCheckedChange={() => toggleInterest(interest)}
                  />
                  <span className="text-sm font-medium">{interest}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <TabletButton variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </TabletButton>
          <TabletButton onClick={handleConfirm} isLoading={isSubmitting}>
            Confirm Consultation
          </TabletButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
