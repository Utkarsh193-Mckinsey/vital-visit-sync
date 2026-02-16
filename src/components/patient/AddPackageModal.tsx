import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletInput } from '@/components/ui/tablet-input';
import { useToast } from '@/hooks/use-toast';
import { Package as PackageIcon, Plus, Trash2 } from 'lucide-react';
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

const PAYMENT_METHODS = ['Cash', 'Card', 'Tabby', 'Tamara', 'Toothpick'] as const;

interface PaymentSplit {
  method: string;
  amount: number;
}

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
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending'>('paid');
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([
    { method: 'Cash', amount: 0 },
  ]);
  const [nextPaymentDate, setNextPaymentDate] = useState<string>('');
  const [nextPaymentAmount, setNextPaymentAmount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { staff } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchTreatments();
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setSelectedTreatment('');
    setSessions(4);
    setTotalAmount(0);
    setPaymentStatus('paid');
    setPaymentSplits([{ method: 'Cash', amount: 0 }]);
    setNextPaymentDate('');
    setNextPaymentAmount(0);
  };

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

  const totalPaid = paymentSplits.reduce((sum, s) => sum + (s.amount || 0), 0);
  const remaining = totalAmount - totalPaid;

  const addPaymentSplit = () => {
    setPaymentSplits([...paymentSplits, { method: 'Card', amount: 0 }]);
  };

  const removePaymentSplit = (index: number) => {
    if (paymentSplits.length <= 1) return;
    setPaymentSplits(paymentSplits.filter((_, i) => i !== index));
  };

  const updateSplit = (index: number, field: keyof PaymentSplit, value: string | number) => {
    const updated = [...paymentSplits];
    updated[index] = { ...updated[index], [field]: value };
    setPaymentSplits(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedTreatment) {
      toast({ title: 'Select Treatment', description: 'Please select a treatment.', variant: 'destructive' });
      return;
    }
    if (sessions < 1) {
      toast({ title: 'Invalid Sessions', description: 'Please enter at least 1 session.', variant: 'destructive' });
      return;
    }
    if (totalAmount <= 0) {
      toast({ title: 'Invalid Amount', description: 'Please enter the total amount.', variant: 'destructive' });
      return;
    }
    if (paymentStatus === 'paid' && totalPaid < totalAmount) {
      toast({ title: 'Payment Incomplete', description: 'Total paid does not match the bill amount. Mark as Partial/Pending if not fully paid.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    try {
      const effectiveStatus = totalPaid >= totalAmount ? 'paid' : 'pending';

      const { data: pkg, error } = await supabase
        .from('packages')
        .insert({
          patient_id: patientId,
          treatment_id: selectedTreatment,
          sessions_purchased: sessions,
          sessions_remaining: sessions,
          payment_status: effectiveStatus,
          status: 'active',
          created_by: staff?.id,
          total_amount: totalAmount,
          amount_paid: totalPaid,
          next_payment_date: paymentStatus === 'pending' && nextPaymentDate ? nextPaymentDate : null,
          next_payment_amount: paymentStatus === 'pending' && nextPaymentAmount > 0 ? nextPaymentAmount : null,
        })
        .select('id')
        .single();

      if (error) throw error;

      // Insert payment splits
      const validSplits = paymentSplits.filter(s => s.amount > 0);
      if (validSplits.length > 0) {
        const { error: payError } = await supabase
          .from('package_payments')
          .insert(
            validSplits.map(s => ({
              package_id: pkg.id,
              amount: s.amount,
              payment_method: s.method.toLowerCase(),
            }))
          );
        if (payError) throw payError;
      }

      onSuccess();
    } catch (error) {
      console.error('Error adding package:', error);
      toast({ title: 'Error', description: 'Failed to add package. Please try again.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const sessionPresets = [4, 8, 12];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageIcon className="h-5 w-5" />
            Add New Package
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 pt-4">
          {/* Treatment */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Treatment *</label>
            <Select value={selectedTreatment} onValueChange={setSelectedTreatment}>
              <SelectTrigger className="h-14 text-base">
                <SelectValue placeholder="Select a treatment" />
              </SelectTrigger>
              <SelectContent>
                {treatments.map((treatment) => (
                  <SelectItem key={treatment.id} value={treatment.id} className="py-3">
                    <div>
                      <div className="font-medium">{treatment.treatment_name}</div>
                      <div className="text-sm text-muted-foreground">{treatment.category}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sessions */}
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
              onChange={(e) => setSessions(e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
              placeholder="Custom number"
            />
          </div>

          {/* Total Amount */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Total Bill Amount (AED) *</label>
            <TabletInput
              type="number"
              min={0}
              step="0.01"
              value={totalAmount === 0 ? '' : totalAmount}
              onChange={(e) => setTotalAmount(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
              placeholder="e.g. 2500"
            />
          </div>

          {/* Payment Status */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Payment Status *</label>
            <div className="flex gap-2">
              <TabletButton
                type="button"
                variant={paymentStatus === 'paid' ? 'success' : 'outline'}
                fullWidth
                onClick={() => setPaymentStatus('paid')}
              >
                Fully Paid
              </TabletButton>
              <TabletButton
                type="button"
                variant={paymentStatus === 'pending' ? 'warning' : 'outline'}
                fullWidth
                onClick={() => setPaymentStatus('pending')}
              >
                Partial / Pending
              </TabletButton>
            </div>
          </div>

          {/* Payment Splits */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">Payment Breakdown</label>
            {paymentSplits.map((split, index) => (
              <div key={index} className="flex items-center gap-2">
                <Select
                  value={split.method}
                  onValueChange={(val) => updateSplit(index, 'method', val)}
                >
                  <SelectTrigger className="h-12 w-[130px] text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <TabletInput
                  type="number"
                  min={0}
                  step="0.01"
                  value={split.amount === 0 ? '' : split.amount}
                  onChange={(e) => updateSplit(index, 'amount', e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                  placeholder="Amount"
                  className="flex-1"
                />
                {paymentSplits.length > 1 && (
                  <TabletButton
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removePaymentSplit(index)}
                    className="px-2"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </TabletButton>
                )}
              </div>
            ))}
            <TabletButton
              type="button"
              variant="outline"
              size="sm"
              onClick={addPaymentSplit}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Split Payment
            </TabletButton>

            {/* Summary */}
            {totalAmount > 0 && (
              <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span>Total Bill:</span>
                  <span className="font-medium">AED {totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Paid Now:</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">AED {totalPaid.toFixed(2)}</span>
                </div>
                {remaining > 0 && (
                  <div className="flex justify-between text-orange-600">
                    <span>Remaining:</span>
                    <span className="font-medium">AED {remaining.toFixed(2)}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Next Payment (only for pending) */}
          {paymentStatus === 'pending' && (
            <div className="space-y-3 border-t pt-4">
              <label className="block text-sm font-medium">Next Payment Details</label>
              <div className="grid grid-cols-2 gap-3">
                <TabletInput
                  type="date"
                  label="Next Payment Date"
                  value={nextPaymentDate}
                  onChange={(e) => setNextPaymentDate(e.target.value)}
                />
                <TabletInput
                  type="number"
                  label="Amount (AED)"
                  min={0}
                  step="0.01"
                  value={nextPaymentAmount === 0 ? '' : nextPaymentAmount}
                  onChange={(e) => setNextPaymentAmount(e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                  placeholder="e.g. 500"
                />
              </div>
            </div>
          )}

          {/* Actions */}
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
