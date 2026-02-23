import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TabletButton } from '@/components/ui/tablet-button';
import { Checkbox } from '@/components/ui/checkbox';
import { Syringe } from 'lucide-react';
import type { Package, Treatment } from '@/types/database';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface PackageWithTreatment extends Package {
  treatment: Treatment;
}

interface TreatmentSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  onConfirm: (selectedPackageIds: string[]) => void;
}

export default function TreatmentSelectionModal({
  open,
  onOpenChange,
  patientId,
  onConfirm,
}: TreatmentSelectionModalProps) {
  const [packages, setPackages] = useState<PackageWithTreatment[]>([]);
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchPackages();
    }
  }, [open, patientId]);

  const fetchPackages = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('packages')
        .select(`
          *,
          treatment:treatments (*)
        `)
        .eq('patient_id', patientId)
        .eq('status', 'active')
        .gt('sessions_remaining', 0)
        .order('purchase_date', { ascending: true });

      if (error) throw error;
      setPackages(data as unknown as PackageWithTreatment[]);
      // Start with nothing selected
      setSelectedPackages(new Set());
    } catch (error) {
      console.error('Error fetching packages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePackage = (packageId: string) => {
    setSelectedPackages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(packageId)) {
        newSet.delete(packageId);
      } else {
        newSet.add(packageId);
      }
      return newSet;
    });
  };

  const handleConfirm = () => {
    onConfirm(Array.from(selectedPackages));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Syringe className="h-5 w-5" />
            Select Treatments for Today
          </DialogTitle>
          <DialogDescription>
            Choose which treatments the patient will receive during this visit.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : packages.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-muted-foreground">No active packages with remaining sessions.</p>
          </div>
        ) : (
          <div className="space-y-3 py-4 max-h-[400px] overflow-y-auto">
            {packages.map((pkg) => (
              <label
                key={pkg.id}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedPackages.has(pkg.id)
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <Checkbox
                  checked={selectedPackages.has(pkg.id)}
                  onCheckedChange={() => togglePackage(pkg.id)}
                  className="h-6 w-6"
                />
                <div className="flex-1">
                  <h4 className="font-semibold">{pkg.treatment.treatment_name}</h4>
                  <p className="text-sm text-muted-foreground">{pkg.treatment.category}</p>
                </div>
                <div className="text-right">
                  <span className="text-lg font-bold text-primary">
                    {pkg.sessions_remaining}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    /{pkg.sessions_purchased}
                  </span>
                  <p className="text-xs text-muted-foreground">sessions left</p>
                </div>
              </label>
            ))}
          </div>
        )}

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
            fullWidth
            onClick={handleConfirm}
            disabled={selectedPackages.size === 0 || isLoading}
          >
            Continue ({selectedPackages.size} selected)
          </TabletButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}
