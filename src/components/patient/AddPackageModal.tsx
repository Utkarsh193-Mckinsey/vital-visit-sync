import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletInput } from '@/components/ui/tablet-input';
import { useToast } from '@/hooks/use-toast';
import { Package as PackageIcon } from 'lucide-react';
import type { Treatment } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface AddPackageModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  onSuccess: () => void;
}

export default function AddPackageModal({
  open,
  onOpenChange,
  patientId,
  onSuccess,
}: AddPackageModalProps) {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [selectedTreatment, setSelectedTreatment] = useState<string>('');
  const [sessions, setSessions] = useState<number>(4);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending'>('paid');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { staff } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchTreatments();
    }
  }, [open]);

  const fetchTreatments = async () => {
    const { data, error } = await supabase
      .from('treatments')
      .select('*')
      .eq('status', 'active')
      .order('treatment_name');

    if (error) {
      console.error('Error fetching treatments:', error);
      return;
    }

    setTreatments(data as Treatment[]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTreatment) {
      toast({
        title: 'Select Treatment',
        description: 'Please select a treatment.',
        variant: 'destructive',
      });
      return;
    }

    if (sessions < 1) {
      toast({
        title: 'Invalid Sessions',
        description: 'Please enter at least 1 session.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('packages')
        .insert({
          patient_id: patientId,
          treatment_id: selectedTreatment,
          sessions_purchased: sessions,
          sessions_remaining: sessions,
          payment_status: paymentStatus,
          status: 'active',
          created_by: staff?.id,
        });

      if (error) throw error;

      // Reset form
      setSelectedTreatment('');
      setSessions(4);
      setPaymentStatus('paid');
      
      onSuccess();
    } catch (error) {
      console.error('Error adding package:', error);
      toast({
        title: 'Error',
        description: 'Failed to add package. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const sessionPresets = [4, 8, 12];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageIcon className="h-5 w-5" />
            Add New Package
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium">Treatment *</label>
            <Select value={selectedTreatment} onValueChange={setSelectedTreatment}>
              <SelectTrigger className="h-14 text-base">
                <SelectValue placeholder="Select a treatment" />
              </SelectTrigger>
              <SelectContent>
                {treatments.map((treatment) => (
                  <SelectItem 
                    key={treatment.id} 
                    value={treatment.id}
                    className="py-3"
                  >
                    <div>
                      <div className="font-medium">{treatment.treatment_name}</div>
                      <div className="text-sm text-muted-foreground">{treatment.category}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Number of Sessions *</label>
            <div className="flex gap-2 mb-2">
              {sessionPresets.map((preset) => (
                <TabletButton
                  key={preset}
                  type="button"
                  variant={sessions === preset ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSessions(preset)}
                >
                  {preset}
                </TabletButton>
              ))}
            </div>
            <TabletInput
              type="number"
              min={1}
              value={sessions === 0 ? '' : sessions}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '') {
                  setSessions(0);
                } else {
                  setSessions(parseInt(value) || 0);
                }
              }}
              placeholder="Custom number"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium">Payment Status *</label>
            <div className="flex gap-2">
              <TabletButton
                type="button"
                variant={paymentStatus === 'paid' ? 'success' : 'outline'}
                fullWidth
                onClick={() => setPaymentStatus('paid')}
              >
                Paid
              </TabletButton>
              <TabletButton
                type="button"
                variant={paymentStatus === 'pending' ? 'warning' : 'outline'}
                fullWidth
                onClick={() => setPaymentStatus('pending')}
              >
                Pending
              </TabletButton>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <TabletButton
              type="button"
              variant="outline"
              fullWidth
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </TabletButton>
            <TabletButton
              type="submit"
              fullWidth
              isLoading={isSubmitting}
            >
              Add Package
            </TabletButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
