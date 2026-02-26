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
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, ShieldAlert, Package as PackageIcon } from 'lucide-react';
import type { Treatment } from '@/types/database';

const TREATMENT_INTERESTS = ['Hair', 'Skin', 'Fat Loss', 'IV'];

interface ConsultationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patient: any;
  onComplete: () => void;
}

export function ConsultationModal({ open, onOpenChange, patient, onComplete }: ConsultationModalProps) {
  const [doctors, setDoctors] = useState<{ id: string; full_name: string }[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [packageNotes, setPackageNotes] = useState('');
  const [cautionNotes, setCautionNotes] = useState('');
  const [contraindicatedTreatmentIds, setContraindicatedTreatmentIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchData();
      // Pre-fill existing values
      setCautionNotes((patient as any)?.caution_notes || '');
      setPackageNotes((patient as any)?.package_notes || '');
      setContraindicatedTreatmentIds((patient as any)?.contraindicated_treatments || []);
    }
  }, [open]);

  const fetchData = async () => {
    const [docRes, tRes] = await Promise.all([
      supabase.from('staff').select('id, full_name').eq('status', 'active').eq('role', 'doctor').order('full_name'),
      supabase.from('treatments').select('*').eq('status', 'active').order('treatment_name'),
    ]);
    if (docRes.data) setDoctors(docRes.data);
    if (tRes.data) setTreatments(tRes.data as Treatment[]);
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest) ? prev.filter(i => i !== interest) : [...prev, interest]
    );
  };

  const toggleContraindicated = (treatmentId: string) => {
    setContraindicatedTreatmentIds(prev =>
      prev.includes(treatmentId) ? prev.filter(id => id !== treatmentId) : [...prev, treatmentId]
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
        package_notes: packageNotes.trim() || null,
        caution_notes: cautionNotes.trim() || null,
        contraindicated_treatments: contraindicatedTreatmentIds,
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Consultation — {patient?.full_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Doctor Selection */}
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

          {/* Treatment Interests */}
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

          {/* Package Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <PackageIcon className="h-4 w-4" /> Package Notes
            </Label>
            <Textarea
              placeholder="Notes about recommended packages, pricing discussions, etc."
              value={packageNotes}
              onChange={(e) => setPackageNotes(e.target.value)}
              rows={2}
              className="text-sm"
            />
          </div>

          {/* Caution Notes */}
          <div className="space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <Label className="text-sm font-medium flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" /> General Caution Notes
            </Label>
            <p className="text-xs text-muted-foreground">This will always appear in red at the top of the patient's profile.</p>
            <Textarea
              placeholder="e.g. Patient has severe allergy to lidocaine, avoid all topical anaesthetics…"
              value={cautionNotes}
              onChange={(e) => setCautionNotes(e.target.value)}
              rows={2}
              className="text-sm border-destructive/30"
            />
          </div>

          {/* Contraindicated Treatments */}
          <div className="space-y-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <Label className="text-sm font-medium flex items-center gap-2 text-destructive">
              <ShieldAlert className="h-4 w-4" /> Contraindicated Treatments
            </Label>
            <p className="text-xs text-muted-foreground">Treatments this patient must NOT receive. Staff will be warned if they try to add these.</p>
            <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
              {treatments.map(t => (
                <label
                  key={t.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition-colors text-sm ${
                    contraindicatedTreatmentIds.includes(t.id)
                      ? 'bg-destructive/10 border-destructive/40 text-destructive'
                      : 'hover:bg-accent'
                  }`}
                >
                  <Checkbox
                    checked={contraindicatedTreatmentIds.includes(t.id)}
                    onCheckedChange={() => toggleContraindicated(t.id)}
                  />
                  <span className="font-medium">{t.treatment_name}</span>
                  <span className="text-xs text-muted-foreground ml-auto">{t.category}</span>
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
