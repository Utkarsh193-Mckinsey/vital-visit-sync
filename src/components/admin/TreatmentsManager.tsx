import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletInput } from '@/components/ui/tablet-input';
import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle } from '@/components/ui/tablet-card';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit2, Trash2, Save, X, Pill, ChevronDown, ChevronUp } from 'lucide-react';
import type { Treatment, DosageUnit } from '@/types/database';
import { TreatmentConsumablesEditor } from './TreatmentConsumablesEditor';
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

const DOSAGE_UNITS: DosageUnit[] = ['mg', 'ml', 'Units', 'mcg', 'Session'];
const CATEGORIES = ['IV Therapy', 'Injections', 'Skin Treatments', 'Wellness', 'Other'];

interface TreatmentFormData {
  treatment_name: string;
  category: string;
  dosage_unit: DosageUnit;
  administration_method: string;
  common_doses: string[];
  default_dose: string;
}

const emptyForm: TreatmentFormData = {
  treatment_name: '',
  category: '',
  dosage_unit: 'Session',
  administration_method: '',
  common_doses: [],
  default_dose: '',
};

// Units that support common doses (medical measurable units)
const UNITS_WITH_DOSES: DosageUnit[] = ['mg', 'ml', 'Units', 'mcg'];

export default function TreatmentsManager() {
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TreatmentFormData>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newDose, setNewDose] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchTreatments();
  }, []);

  const fetchTreatments = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('treatments')
      .select('*')
      .order('treatment_name');

    if (error) {
      console.error('Error fetching treatments:', error);
      toast({
        title: 'Error',
        description: 'Failed to load treatments.',
        variant: 'destructive',
      });
    } else {
      setTreatments(data as Treatment[]);
    }
    setIsLoading(false);
  };

  const handleAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleEdit = (treatment: Treatment) => {
    setEditingId(treatment.id);
    setIsAdding(false);
    setFormData({
      treatment_name: treatment.treatment_name,
      category: treatment.category,
      dosage_unit: treatment.dosage_unit,
      administration_method: treatment.administration_method || '',
      common_doses: treatment.common_doses || [],
      default_dose: (treatment as any).default_dose || '',
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData(emptyForm);
    setNewDose('');
  };

  const handleSave = async () => {
    if (!formData.treatment_name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Treatment name is required.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.category) {
      toast({
        title: 'Validation Error',
        description: 'Category is required.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      if (isAdding) {
        const { error } = await supabase
          .from('treatments')
          .insert({
            treatment_name: formData.treatment_name.trim(),
            category: formData.category,
            dosage_unit: formData.dosage_unit,
            administration_method: formData.administration_method.trim() || null,
            common_doses: formData.common_doses.length > 0 ? formData.common_doses : null,
            default_dose: formData.default_dose.trim() || null,
            status: 'active',
          });

        if (error) throw error;

        toast({
          title: 'Treatment Added',
          description: `${formData.treatment_name} has been added.`,
        });
      } else if (editingId) {
        const { error } = await supabase
          .from('treatments')
          .update({
            treatment_name: formData.treatment_name.trim(),
            category: formData.category,
            dosage_unit: formData.dosage_unit,
            administration_method: formData.administration_method.trim() || null,
            common_doses: formData.common_doses.length > 0 ? formData.common_doses : null,
            default_dose: formData.default_dose.trim() || null,
          })
          .eq('id', editingId);

        if (error) throw error;

        toast({
          title: 'Treatment Updated',
          description: `${formData.treatment_name} has been updated.`,
        });
      }

      handleCancel();
      fetchTreatments();
    } catch (error) {
      console.error('Error saving treatment:', error);
      toast({
        title: 'Error',
        description: 'Failed to save treatment.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('treatments')
        .update({ status: 'inactive' })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Treatment Deactivated',
        description: 'Treatment has been deactivated.',
      });

      setDeleteConfirm(null);
      fetchTreatments();
    } catch (error) {
      console.error('Error deactivating treatment:', error);
      toast({
        title: 'Error',
        description: 'Failed to deactivate treatment.',
        variant: 'destructive',
      });
    }
  };

  const activeTreatments = treatments.filter(t => t.status === 'active');
  const inactiveTreatments = treatments.filter(t => t.status === 'inactive');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">
          {activeTreatments.length} Active Treatment{activeTreatments.length !== 1 ? 's' : ''}
        </h2>
        {!isAdding && !editingId && (
          <TabletButton onClick={handleAdd} leftIcon={<Plus className="h-4 w-4" />}>
            Add Treatment
          </TabletButton>
        )}
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <TabletCard className="border-primary">
          <TabletCardHeader>
            <TabletCardTitle>
              {isAdding ? 'Add New Treatment' : 'Edit Treatment'}
            </TabletCardTitle>
          </TabletCardHeader>
          <TabletCardContent className="space-y-4">
            <TabletInput
              label="Treatment Name *"
              placeholder="e.g., Vitamin C IV"
              value={formData.treatment_name}
              onChange={(e) => setFormData({ ...formData, treatment_name: e.target.value })}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="block text-sm font-medium">Category *</label>
                <Select 
                  value={formData.category} 
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger className="h-14">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat} className="py-3">
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium">Dosage Unit *</label>
                <Select 
                  value={formData.dosage_unit} 
                  onValueChange={(value) => setFormData({ ...formData, dosage_unit: value as DosageUnit })}
                >
                  <SelectTrigger className="h-14">
                    <SelectValue placeholder="Select unit" />
                  </SelectTrigger>
                  <SelectContent>
                    {DOSAGE_UNITS.map((unit) => (
                      <SelectItem key={unit} value={unit} className="py-3">
                        {unit}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <TabletInput
              label="Administration Method"
              placeholder="e.g., Intravenous, Intramuscular"
              value={formData.administration_method}
              onChange={(e) => setFormData({ ...formData, administration_method: e.target.value })}
            />

            {/* Common Doses Section - only show for measurable units */}
            {UNITS_WITH_DOSES.includes(formData.dosage_unit) && (
              <div className="space-y-2">
                <label className="block text-sm font-medium">
                  Common Doses ({formData.dosage_unit})
                  <span className="text-muted-foreground font-normal ml-1">- doctors will pick from these</span>
                </label>
                
                {/* Current doses as tags */}
                {formData.common_doses.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {formData.common_doses.map((dose, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium"
                      >
                        {dose} {formData.dosage_unit}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              common_doses: formData.common_doses.filter((_, i) => i !== index),
                            });
                          }}
                          className="ml-1 hover:bg-primary/20 rounded-full p-0.5"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                
                {/* Add new dose input */}
                <div className="flex gap-2">
                  <TabletInput
                    type="text"
                    placeholder={`e.g., 2.5, 5, 7.5`}
                    value={newDose}
                    onChange={(e) => setNewDose(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (newDose.trim() && !formData.common_doses.includes(newDose.trim())) {
                          setFormData({
                            ...formData,
                            common_doses: [...formData.common_doses, newDose.trim()],
                          });
                          setNewDose('');
                        }
                      }
                    }}
                    className="flex-1"
                  />
                  <TabletButton
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (newDose.trim() && !formData.common_doses.includes(newDose.trim())) {
                        setFormData({
                          ...formData,
                          common_doses: [...formData.common_doses, newDose.trim()],
                        });
                        setNewDose('');
                      }
                    }}
                    leftIcon={<Plus className="h-4 w-4" />}
                  >
                    Add
                  </TabletButton>
                </div>
                <p className="text-xs text-muted-foreground">
                  Press Enter or click Add to add a dose. These will appear as dropdown options for doctors.
                </p>

                {/* Default Dose Selector */}
                {formData.common_doses.length > 0 && (
                  <div className="mt-4 pt-4 border-t">
                    <label className="block text-sm font-medium mb-2">
                      Default Dose
                      <span className="text-muted-foreground font-normal ml-1">- pre-selected for doctors</span>
                    </label>
                    <Select
                      value={formData.default_dose}
                      onValueChange={(value) => setFormData({ ...formData, default_dose: value })}
                    >
                      <SelectTrigger className="h-14">
                        <SelectValue placeholder="Select default dose (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="" className="py-3">
                          No default
                        </SelectItem>
                        {formData.common_doses.map((dose) => (
                          <SelectItem key={dose} value={dose} className="py-3">
                            {dose} {formData.dosage_unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <TabletButton
                variant="outline"
                fullWidth
                onClick={handleCancel}
                leftIcon={<X className="h-4 w-4" />}
              >
                Cancel
              </TabletButton>
              <TabletButton
                fullWidth
                onClick={handleSave}
                isLoading={isSaving}
                leftIcon={<Save className="h-4 w-4" />}
              >
                {isAdding ? 'Add Treatment' : 'Save Changes'}
              </TabletButton>
            </div>
          </TabletCardContent>
        </TabletCard>
      )}

      {/* Active Treatments List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading treatments...</div>
      ) : activeTreatments.length === 0 && !isAdding ? (
        <TabletCard>
          <TabletCardContent className="py-8 text-center text-muted-foreground">
            <Pill className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No treatments configured yet.</p>
            <p className="text-sm mt-1">Add treatments to use in packages.</p>
          </TabletCardContent>
        </TabletCard>
      ) : (
        <div className="space-y-2">
          {activeTreatments.map((treatment) => (
            <TabletCard key={treatment.id} className={editingId === treatment.id ? 'hidden' : ''}>
              <TabletCardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-lg">{treatment.treatment_name}</div>
                    <div className="text-sm text-muted-foreground">
                      {treatment.category} • {treatment.dosage_unit}
                      {treatment.administration_method && ` • ${treatment.administration_method}`}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <TabletButton
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedId(expandedId === treatment.id ? null : treatment.id)}
                      leftIcon={expandedId === treatment.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    >
                      Consumables
                    </TabletButton>
                    <TabletButton
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(treatment)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </TabletButton>
                    <TabletButton
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteConfirm(treatment.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </TabletButton>
                  </div>
                </div>
                
                {/* Expandable consumables section */}
                {expandedId === treatment.id && (
                  <div className="mt-4 pt-4 border-t">
                    <TreatmentConsumablesEditor 
                      treatmentId={treatment.id} 
                      treatmentName={treatment.treatment_name}
                    />
                  </div>
                )}
              </TabletCardContent>
            </TabletCard>
          ))}
        </div>
      )}

      {/* Inactive Treatments */}
      {inactiveTreatments.length > 0 && (
        <div className="pt-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Inactive Treatments ({inactiveTreatments.length})
          </h3>
          <div className="space-y-2 opacity-60">
            {inactiveTreatments.map((treatment) => (
              <TabletCard key={treatment.id}>
                <TabletCardContent className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{treatment.treatment_name}</div>
                    <div className="text-sm text-muted-foreground">{treatment.category}</div>
                  </div>
                  <span className="text-xs bg-muted px-2 py-1 rounded">Inactive</span>
                </TabletCardContent>
              </TabletCard>
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Treatment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide the treatment from new packages. Existing packages will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
