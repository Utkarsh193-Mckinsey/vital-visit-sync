import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletInput } from '@/components/ui/tablet-input';
import { useToast } from '@/hooks/use-toast';
import { Package as PackageIcon, Plus, Trash2, Gift, AlertTriangle } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
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
const SESSION_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

interface TreatmentLine {
  treatmentId: string;
  sessions: number;
}

interface ComplementaryLine {
  treatmentId: string;
  sessions: number;
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
    { treatmentId: '', sessions: 4 },
  ]);
  const [compLines, setCompLines] = useState<ComplementaryLine[]>([]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'pending'>('paid');
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([
    { method: 'Cash', amount: 0 },
  ]);
  const [nextPaymentDate, setNextPaymentDate] = useState<string>('');
  const [nextPaymentAmount, setNextPaymentAmount] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mismatchReason, setMismatchReason] = useState('');
  const [showMismatchWarning, setShowMismatchWarning] = useState(false);
  const { staff } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      fetchTreatments();
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setTreatmentLines([{ treatmentId: '', sessions: 4 }]);
    setCompLines([]);
    setTotalAmount(0);
    setPaymentStatus('paid');
    setPaymentSplits([{ method: 'Cash', amount: 0 }]);
    setNextPaymentDate('');
    setNextPaymentAmount(0);
    setMismatchReason('');
    setShowMismatchWarning(false);
  };

  const MISMATCH_TOLERANCE = 10; // AED

  const fetchTreatments = async () => {
    const { data, error } = await supabase
      .from('treatments')
      .select('*')
      .eq('status', 'active')
      .order('treatment_name');
    if (error) { console.error('Error fetching treatments:', error); return; }
    setTreatments(data as Treatment[]);
  };

  // Treatment lines helpers
  const addTreatmentLine = () => setTreatmentLines(prev => [...prev, { treatmentId: '', sessions: 4 }]);
  const removeTreatmentLine = (i: number) => { if (treatmentLines.length > 1) setTreatmentLines(prev => prev.filter((_, idx) => idx !== i)); };
  const updateLine = (i: number, field: keyof TreatmentLine, val: string | number) => {
    setTreatmentLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  };

  // Complimentary lines helpers
  const addCompLine = () => setCompLines(prev => [...prev, { treatmentId: '', sessions: 1 }]);
  const removeCompLine = (i: number) => setCompLines(prev => prev.filter((_, idx) => idx !== i));
  const updateCompLine = (i: number, field: keyof ComplementaryLine, val: string | number) => {
    setCompLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  };

  // Payment splits
  const totalPaid = paymentSplits.reduce((sum, s) => sum + (s.amount || 0), 0);
  const remaining = totalAmount - totalPaid;
  const addPaymentSplit = () => setPaymentSplits(prev => [...prev, { method: 'Card', amount: 0 }]);
  const removePaymentSplit = (i: number) => { if (paymentSplits.length > 1) setPaymentSplits(prev => prev.filter((_, idx) => idx !== i)); };
  const updateSplit = (i: number, field: keyof PaymentSplit, val: string | number) => {
    setPaymentSplits(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s));
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

    // Check for payment mismatch: paid is less than total by more than tolerance, but status is 'paid'
    const shortfall = totalAmount - totalPaid;
    if (shortfall > MISMATCH_TOLERANCE && paymentStatus === 'paid') {
      setShowMismatchWarning(true);
      return;
    }

    await doSubmit();
  };

  const doSubmit = async () => {
    setIsSubmitting(true);
    try {
      const effectiveStatus = totalPaid >= totalAmount ? 'paid' : 'pending';
      const allPackageIds: string[] = [];

      // Create paid treatment packages
      for (const line of treatmentLines.filter(l => l.treatmentId && l.sessions > 0)) {
        const { data: pkg, error } = await supabase
          .from('packages')
          .insert({
            patient_id: patientId,
            treatment_id: line.treatmentId,
            sessions_purchased: line.sessions,
            sessions_remaining: line.sessions,
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
        allPackageIds.push(pkg.id);
      }

      // Create complimentary treatment packages
      const validCompLines = compLines.filter(l => l.treatmentId && l.sessions > 0);
      for (const line of validCompLines) {
        const { data: pkg, error } = await supabase
          .from('packages')
          .insert({
            patient_id: patientId,
            treatment_id: line.treatmentId,
            sessions_purchased: line.sessions,
            sessions_remaining: line.sessions,
            payment_status: 'paid',
            status: 'active',
            created_by: staff?.id,
            total_amount: 0,
            amount_paid: 0,
          })
          .select('id')
          .single();
        if (error) throw error;
        allPackageIds.push(pkg.id);
      }

      // Attach payment splits to the first package
      if (allPackageIds.length > 0) {
        const validSplits = paymentSplits.filter(s => s.amount > 0);
        if (validSplits.length > 0) {
          const { error: payError } = await supabase
            .from('package_payments')
            .insert(validSplits.map(s => ({
              package_id: allPackageIds[0],
              amount: s.amount,
              payment_method: s.method.toLowerCase(),
              notes: mismatchReason || null,
            })));
          if (payError) throw payError;
        }
      }

      // Mark patient as converted if they were in consultation flow
      await supabase.from('patients').update({
        consultation_status: 'converted',
      } as any).eq('id', patientId).in('consultation_status', ['consulted', 'awaiting_consultation']);

      onSuccess();
    } catch (error) {
      console.error('Error adding package:', error);
      toast({ title: 'Error', description: 'Failed to add package. Please try again.', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTreatmentSelect = (value: string, onChange: (val: string) => void) => (
    <Select value={value} onValueChange={onChange}>
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
  );

  const renderSessionSelect = (value: number, onChange: (val: number) => void) => (
    <Select value={String(value)} onValueChange={(v) => onChange(parseInt(v))}>
      <SelectTrigger className="h-12 w-24 text-base">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SESSION_OPTIONS.map((n) => (
          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

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
          {/* Paid Treatment Lines */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">Treatments *</label>
            {treatmentLines.map((line, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex-1">
                  {renderTreatmentSelect(line.treatmentId, (val) => updateLine(index, 'treatmentId', val))}
                </div>
                {renderSessionSelect(line.sessions, (val) => updateLine(index, 'sessions', val))}
                {treatmentLines.length > 1 && (
                  <button type="button" onClick={() => removeTreatmentLine(index)} className="p-2 text-destructive hover:bg-destructive/10 rounded">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
            <TabletButton type="button" variant="outline" size="sm" onClick={addTreatmentLine} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Add Treatment
            </TabletButton>
          </div>

          {/* Complimentary Treatment Lines */}
          <div className="space-y-3 border-t pt-4">
            <label className="block text-sm font-medium flex items-center gap-2">
              <Gift className="h-4 w-4 text-success" /> Complimentary Treatments
            </label>
            {compLines.length === 0 && (
              <p className="text-xs text-muted-foreground">No complimentary treatments added</p>
            )}
            {compLines.map((line, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="flex-1">
                  {renderTreatmentSelect(line.treatmentId, (val) => updateCompLine(index, 'treatmentId', val))}
                </div>
                {renderSessionSelect(line.sessions, (val) => updateCompLine(index, 'sessions', val))}
                <button type="button" onClick={() => removeCompLine(index)} className="p-2 text-destructive hover:bg-destructive/10 rounded">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <TabletButton type="button" variant="outline" size="sm" onClick={addCompLine} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Add Complimentary Treatment
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
                <div className="flex justify-between"><span>Paid Now:</span><span className="font-medium text-success">AED {totalPaid.toFixed(2)}</span></div>
                {remaining > 0 && (
                  <div className="flex justify-between text-warning"><span>Remaining:</span><span className="font-medium">AED {remaining.toFixed(2)}</span></div>
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

          {/* Payment Mismatch Warning */}
          {showMismatchWarning && (
            <div className="space-y-3 border border-destructive/40 rounded-lg p-4 bg-destructive/5">
              <div className="flex items-start gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium text-sm">Payment amount mismatch</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Paid <strong>AED {totalPaid.toFixed(2)}</strong> but total is <strong>AED {totalAmount.toFixed(2)}</strong> (difference: AED {(totalAmount - totalPaid).toFixed(2)}).
                    Please correct the amounts, switch to <em>Partial / Pending</em>, or provide a reason below.
                  </p>
                </div>
              </div>
              <Textarea
                placeholder="Reason for difference (e.g. discount given, change rounded, deferred balance…)"
                value={mismatchReason}
                onChange={(e) => setMismatchReason(e.target.value)}
                rows={2}
                className="text-sm"
              />
              <div className="flex gap-2">
                <TabletButton type="button" variant="outline" size="sm" fullWidth onClick={() => setShowMismatchWarning(false)}>
                  Go Back &amp; Correct
                </TabletButton>
                <TabletButton
                  type="button"
                  variant="warning"
                  size="sm"
                  fullWidth
                  disabled={!mismatchReason.trim()}
                  onClick={() => doSubmit()}
                  isLoading={isSubmitting}
                >
                  Confirm with Reason
                </TabletButton>
              </div>
            </div>
          )}

          {/* Actions */}
          {!showMismatchWarning && (
            <div className="flex gap-3 pt-2">
              <TabletButton type="button" variant="outline" fullWidth onClick={() => onOpenChange(false)}>Cancel</TabletButton>
              <TabletButton type="submit" fullWidth isLoading={isSubmitting}>Add Package</TabletButton>
            </div>
          )}
        </form>
      </DialogContent>
    </Dialog>
  );
}
