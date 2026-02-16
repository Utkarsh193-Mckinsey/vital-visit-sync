import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletInput } from '@/components/ui/tablet-input';
import { useToast } from '@/hooks/use-toast';
import { Package as PackageIcon, Plus, Trash2, Gift } from 'lucide-react';
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

interface TreatmentLine {
  treatmentId: string;
  sessions: number;
  complimentary: number;
}

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
  const [treatmentLines, setTreatmentLines] = useState<TreatmentLine[]>([
    { treatmentId: '', sessions: 4, complimentary: 0 },
  ]);
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
    setTreatmentLines([{ treatmentId: '', sessions: 4, complimentary: 0 }]);
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
    if (error) { console.error('Error fetching treatments:', error); return; }
    setTreatments(data as Treatment[]);
  };

  // Treatment lines
  const addTreatmentLine = () => {
    setTreatmentLines([...treatmentLines, { treatmentId: '', sessions: 4, complimentary: 0 }]);
  };
  const removeTreatmentLine = (index: number) => {
    if (treatmentLines.length <= 1) return;
    setTreatmentLines(treatmentLines.filter((_, i) => i !== index));
  };
  const updateLine = (index: number, field: keyof TreatmentLine, value: string | number) => {
    const updated = [...treatmentLines];
    updated[index] = { ...updated[index], [field]: value };
    setTreatmentLines(updated);
  };

  // Payment splits
  const totalPaid = paymentSplits.reduce((sum, s) => sum + (s.amount || 0), 0);
  const remaining = totalAmount - totalPaid;
  const addPaymentSplit = () => setPaymentSplits([...paymentSplits, { method: 'Card', amount: 0 }]);
  const removePaymentSplit = (index: number) => {
    if (paymentSplits.length <= 1) return;
    setPaymentSplits(paymentSplits.filter((_, i) => i !== index));
  };
  const updateSplit = (index: number, field: keyof PaymentSplit, value: string | number) => {
    const updated = [...paymentSplits];
    updated[index] = { ...updated[index], [field]: value };
    setPaymentSplits(updated);
  };

  const getTreatmentName = (id: string) => treatments.find(t => t.id === id)?.treatment_name || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = treatmentLines.filter(l => l.treatmentId && l.sessions > 0);
    if (validLines.length === 0) {
      toast({ title: 'Add Treatments', description: 'Please add at least one treatment with sessions.', variant: 'destructive' });
      return;
    }
    if (totalAmount <= 0) {
      toast({ title: 'Invalid Amount', description: 'Please enter the total amount.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const effectiveStatus = totalPaid >= totalAmount ? 'paid' : 'pending';

      // Create one package per treatment line
      for (const line of validLines) {
        const totalSessions = line.sessions + line.complimentary;
        const { data: pkg, error } = await supabase
          .from('packages')
          .insert({
            patient_id: patientId,
            treatment_id: line.treatmentId,
            sessions_purchased: totalSessions,
            sessions_remaining: totalSessions,
            payment_status: effectiveStatus,
            status: 'active',
            created_by: staff?.id,
            total_amount: validLines.length === 1 ? totalAmount : null,
            amount_paid: validLines.length === 1 ? totalPaid : null,
            next_payment_date: paymentStatus === 'pending' && nextPaymentDate ? nextPaymentDate : null,
            next_payment_amount: paymentStatus === 'pending' && nextPaymentAmount > 0 ? nextPaymentAmount : null,
          })
          .select('id')
          .single();
        if (error) throw error;

        // Attach payment splits to first package only (they cover the whole bundle)
        if (line === validLines[0]) {
          const validSplits = paymentSplits.filter(s => s.amount > 0);
          if (validSplits.length > 0) {
            const { error: payError } = await supabase
              .from('package_payments')
              .insert(validSplits.map(s => ({
                package_id: pkg.id,
                amount: s.amount,
                payment_method: s.method.toLowerCase(),
              })));
            if (payError) throw payError;
          }
        }
      }

      onSuccess();
    } catch (error) {
      console.error('Error adding package:', error);
      toast({ title: 'Error', description: 'Failed to add package. Please try again.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const sessionPresets = [2, 4, 8, 12];

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
          {/* Treatment Lines */}
          <div className="space-y-4">
            <label className="block text-sm font-medium">Treatments *</label>
            {treatmentLines.map((line, index) => (
              <div key={index} className="rounded-lg border p-3 space-y-3 relative">
                {treatmentLines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeTreatmentLine(index)}
                    className="absolute top-2 right-2 p-1 text-destructive hover:bg-destructive/10 rounded"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                <Select value={line.treatmentId} onValueChange={(val) => updateLine(index, 'treatmentId', val)}>
                  <SelectTrigger className="h-12 text-base">
                    <SelectValue placeholder="Select treatment" />
                  </SelectTrigger>
                  <SelectContent>
                    {treatments.map((t) => (
                      <SelectItem key={t.id} value={t.id} className="py-2">
                        <span className="font-medium">{t.treatment_name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{t.category}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">Sessions</label>
                    <div className="flex gap-1 flex-wrap">
                      {sessionPresets.map((p) => (
                        <TabletButton
                          key={p}
                          type="button"
                          variant={line.sessions === p ? 'default' : 'outline'}
                          size="sm"
                          className="h-8 w-10 text-xs p-0"
                          onClick={() => updateLine(index, 'sessions', p)}
                        >
                          {p}
                        </TabletButton>
                      ))}
                    </div>
                    <TabletInput
                      type="number"
                      min={1}
                      value={line.sessions === 0 ? '' : line.sessions}
                      onChange={(e) => updateLine(index, 'sessions', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                      placeholder="Custom"
                      className="h-10 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground flex items-center gap-1">
                      <Gift className="h-3 w-3" /> Complimentary
                    </label>
                    <TabletInput
                      type="number"
                      min={0}
                      value={line.complimentary === 0 ? '' : line.complimentary}
                      onChange={(e) => updateLine(index, 'complimentary', e.target.value === '' ? 0 : parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="h-10 text-sm mt-[38px]"
                    />
                  </div>
                </div>

                {line.treatmentId && line.sessions > 0 && (
                  <div className="text-xs text-muted-foreground">
                    {getTreatmentName(line.treatmentId)}: {line.sessions} paid{line.complimentary > 0 ? ` + ${line.complimentary} free` : ''} = {line.sessions + line.complimentary} total sessions
                  </div>
                )}
              </div>
            ))}

            <TabletButton type="button" variant="outline" size="sm" onClick={addTreatmentLine} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Add Another Treatment
            </TabletButton>
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
              <TabletButton type="button" variant={paymentStatus === 'paid' ? 'success' : 'outline'} fullWidth onClick={() => setPaymentStatus('paid')}>
                Fully Paid
              </TabletButton>
              <TabletButton type="button" variant={paymentStatus === 'pending' ? 'warning' : 'outline'} fullWidth onClick={() => setPaymentStatus('pending')}>
                Partial / Pending
              </TabletButton>
            </div>
          </div>

          {/* Payment Splits */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">Payment Breakdown</label>
            {paymentSplits.map((split, index) => (
              <div key={index} className="flex items-center gap-2">
                <Select value={split.method} onValueChange={(val) => updateSplit(index, 'method', val)}>
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
                  <TabletButton type="button" variant="ghost" size="sm" onClick={() => removePaymentSplit(index)} className="px-2">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </TabletButton>
                )}
              </div>
            ))}
            <TabletButton type="button" variant="outline" size="sm" onClick={addPaymentSplit} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Add Split Payment
            </TabletButton>

            {totalAmount > 0 && (
              <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Total Bill:</span><span className="font-medium">AED {totalAmount.toFixed(2)}</span></div>
                <div className="flex justify-between"><span>Paid Now:</span><span className="font-medium text-emerald-600 dark:text-emerald-400">AED {totalPaid.toFixed(2)}</span></div>
                {remaining > 0 && (
                  <div className="flex justify-between text-orange-600 dark:text-orange-400"><span>Remaining:</span><span className="font-medium">AED {remaining.toFixed(2)}</span></div>
                )}
              </div>
            )}
          </div>

          {/* Next Payment */}
          {paymentStatus === 'pending' && (
            <div className="space-y-3 border-t pt-4">
              <label className="block text-sm font-medium">Next Payment Details</label>
              <div className="grid grid-cols-2 gap-3">
                <TabletInput type="date" label="Next Payment Date" value={nextPaymentDate} onChange={(e) => setNextPaymentDate(e.target.value)} />
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
            <TabletButton type="button" variant="outline" fullWidth onClick={() => onOpenChange(false)}>Cancel</TabletButton>
            <TabletButton type="submit" fullWidth isLoading={isSubmitting}>Add Package</TabletButton>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
