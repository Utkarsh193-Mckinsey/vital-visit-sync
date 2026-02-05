import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletInput } from '@/components/ui/tablet-input';
import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle } from '@/components/ui/tablet-card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Plus, Edit2, Trash2, Save, X, FileText, Eye } from 'lucide-react';
import type { ConsentTemplate, Treatment } from '@/types/database';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface TemplateFormData {
  form_name: string;
  consent_text: string;
  consent_text_ar: string;
  treatment_id: string | null;
}

const emptyForm: TemplateFormData = {
  form_name: '',
  consent_text: '',
  consent_text_ar: '',
  treatment_id: null,
};

export default function ConsentTemplatesManager() {
  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<TemplateFormData>(emptyForm);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<ConsentTemplate | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    
    const [templatesRes, treatmentsRes] = await Promise.all([
      supabase.from('consent_templates').select('*').order('form_name'),
      supabase.from('treatments').select('*').eq('status', 'active').order('treatment_name'),
    ]);

    if (templatesRes.error) {
      console.error('Error fetching templates:', templatesRes.error);
    } else {
      setTemplates(templatesRes.data as ConsentTemplate[]);
    }

    if (treatmentsRes.error) {
      console.error('Error fetching treatments:', treatmentsRes.error);
    } else {
      setTreatments(treatmentsRes.data as Treatment[]);
    }

    setIsLoading(false);
  };

  const handleAdd = () => {
    setIsAdding(true);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleEdit = (template: ConsentTemplate) => {
    setEditingId(template.id);
    setIsAdding(false);
    setFormData({
      form_name: template.form_name,
      consent_text: template.consent_text,
      consent_text_ar: template.consent_text_ar || '',
      treatment_id: template.treatment_id || null,
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    if (!formData.form_name.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Form name is required.',
        variant: 'destructive',
      });
      return;
    }

    if (!formData.consent_text.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Consent text is required.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);

    try {
      if (isAdding) {
        const { data: newTemplate, error } = await supabase
          .from('consent_templates')
          .insert({
            form_name: formData.form_name.trim(),
            consent_text: formData.consent_text.trim(),
            treatment_id: formData.treatment_id || null,
            is_current_version: true,
            version_number: 1,
            status: 'active',
          })
          .select()
          .single();

        if (error) throw error;

        // Link the treatment to this consent template
        if (formData.treatment_id && newTemplate) {
          const { error: updateError } = await supabase
            .from('treatments')
            .update({ consent_template_id: newTemplate.id })
            .eq('id', formData.treatment_id);
          
          if (updateError) {
            console.error('Error linking treatment:', updateError);
          }
        }

        toast({
          title: 'Template Added',
          description: `${formData.form_name} has been added.`,
        });
      } else if (editingId) {
        // Get previous template data to check if treatment changed
        const oldTemplate = templates.find(t => t.id === editingId);
        
        const { error } = await supabase
          .from('consent_templates')
          .update({
            form_name: formData.form_name.trim(),
            consent_text: formData.consent_text.trim(),
            treatment_id: formData.treatment_id || null,
            last_updated: new Date().toISOString(),
          })
          .eq('id', editingId);

        if (error) throw error;

        // Unlink old treatment if it changed
        if (oldTemplate?.treatment_id && oldTemplate.treatment_id !== formData.treatment_id) {
          await supabase
            .from('treatments')
            .update({ consent_template_id: null })
            .eq('id', oldTemplate.treatment_id);
        }

        // Link new treatment
        if (formData.treatment_id) {
          await supabase
            .from('treatments')
            .update({ consent_template_id: editingId })
            .eq('id', formData.treatment_id);
        }

        toast({
          title: 'Template Updated',
          description: `${formData.form_name} has been updated.`,
        });
      }

      handleCancel();
      fetchData();
    } catch (error) {
      console.error('Error saving template:', error);
      toast({
        title: 'Error',
        description: 'Failed to save template.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('consent_templates')
        .update({ status: 'inactive' })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Template Deactivated',
        description: 'Template has been deactivated.',
      });

      setDeleteConfirm(null);
      fetchData();
    } catch (error) {
      console.error('Error deactivating template:', error);
      toast({
        title: 'Error',
        description: 'Failed to deactivate template.',
        variant: 'destructive',
      });
    }
  };

  const getTreatmentName = (treatmentId: string | null) => {
    if (!treatmentId) return 'General (All Treatments)';
    const treatment = treatments.find(t => t.id === treatmentId);
    return treatment?.treatment_name || 'Unknown';
  };

  const activeTemplates = templates.filter(t => t.status === 'active');
  const inactiveTemplates = templates.filter(t => t.status === 'inactive');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-semibold">
          {activeTemplates.length} Active Template{activeTemplates.length !== 1 ? 's' : ''}
        </h2>
        {!isAdding && !editingId && (
          <TabletButton onClick={handleAdd} leftIcon={<Plus className="h-4 w-4" />}>
            Add Template
          </TabletButton>
        )}
      </div>

      {/* Add/Edit Form */}
      {(isAdding || editingId) && (
        <TabletCard className="border-primary">
          <TabletCardHeader>
            <TabletCardTitle>
              {isAdding ? 'Add New Consent Template' : 'Edit Template'}
            </TabletCardTitle>
          </TabletCardHeader>
          <TabletCardContent className="space-y-4">
            <TabletInput
              label="Form Name *"
              placeholder="e.g., IV Therapy Consent Form"
              value={formData.form_name}
              onChange={(e) => setFormData({ ...formData, form_name: e.target.value })}
            />

            <div className="space-y-2">
              <label className="block text-sm font-medium">Linked Treatment</label>
              <Select 
                value={formData.treatment_id || 'general'} 
                onValueChange={(value) => setFormData({ ...formData, treatment_id: value === 'general' ? null : value })}
              >
                <SelectTrigger className="h-14">
                  <SelectValue placeholder="Select treatment (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general" className="py-3">
                    General (All Treatments)
                  </SelectItem>
                  {treatments.map((treatment) => (
                    <SelectItem key={treatment.id} value={treatment.id} className="py-3">
                      {treatment.treatment_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Link to a specific treatment or leave as General for all.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Consent Text *</label>
              <Textarea
                placeholder="Enter the full consent form text here. This will be shown to patients before treatment..."
                value={formData.consent_text}
                onChange={(e) => setFormData({ ...formData, consent_text: e.target.value })}
                rows={10}
                className="min-h-[200px] text-base"
              />
              <p className="text-xs text-muted-foreground">
                Use clear, patient-friendly language. Include risks, benefits, and alternatives.
              </p>
            </div>

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
                {isAdding ? 'Add Template' : 'Save Changes'}
              </TabletButton>
            </div>
          </TabletCardContent>
        </TabletCard>
      )}

      {/* Active Templates List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading templates...</div>
      ) : activeTemplates.length === 0 && !isAdding ? (
        <TabletCard>
          <TabletCardContent className="py-8 text-center text-muted-foreground">
            <FileText className="h-12 w-12 mx-auto mb-4 opacity-30" />
            <p>No consent templates configured yet.</p>
            <p className="text-sm mt-1">Add templates for patient consent forms.</p>
          </TabletCardContent>
        </TabletCard>
      ) : (
        <div className="space-y-2">
          {activeTemplates.map((template) => (
            <TabletCard key={template.id} className={editingId === template.id ? 'hidden' : ''}>
              <TabletCardContent className="flex items-center justify-between py-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-lg">{template.form_name}</div>
                  <div className="text-sm text-muted-foreground">
                    {getTreatmentName(template.treatment_id)} • v{template.version_number}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 truncate">
                    {template.consent_text.substring(0, 80)}...
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <TabletButton
                    variant="ghost"
                    size="icon"
                    onClick={() => setPreviewTemplate(template)}
                  >
                    <Eye className="h-4 w-4" />
                  </TabletButton>
                  <TabletButton
                    variant="ghost"
                    size="icon"
                    onClick={() => handleEdit(template)}
                  >
                    <Edit2 className="h-4 w-4" />
                  </TabletButton>
                  <TabletButton
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteConfirm(template.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </TabletButton>
                </div>
              </TabletCardContent>
            </TabletCard>
          ))}
        </div>
      )}

      {/* Inactive Templates */}
      {inactiveTemplates.length > 0 && (
        <div className="pt-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">
            Inactive Templates ({inactiveTemplates.length})
          </h3>
          <div className="space-y-2 opacity-60">
            {inactiveTemplates.map((template) => (
              <TabletCard key={template.id}>
                <TabletCardContent className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium">{template.form_name}</div>
                    <div className="text-sm text-muted-foreground">v{template.version_number}</div>
                  </div>
                  <span className="text-xs bg-muted px-2 py-1 rounded">Inactive</span>
                </TabletCardContent>
              </TabletCard>
            ))}
          </div>
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{previewTemplate?.form_name}</DialogTitle>
          </DialogHeader>
          <div className="prose prose-sm max-w-none whitespace-pre-wrap">
            {previewTemplate?.consent_text}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide the template from new consents. Existing signed consents will not be affected.
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
