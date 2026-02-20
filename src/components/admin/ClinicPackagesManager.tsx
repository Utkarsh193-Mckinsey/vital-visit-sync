import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletInput } from '@/components/ui/tablet-input';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Gift, Package, Edit2, X, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Treatment } from '@/types/database';

const VAT_RATE = 0.05;
const SESSION_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

interface TreatmentLine {
  treatmentId: string;
  sessions: number;
  isComplimentary: boolean;
}

interface ClinicPackage {
  id: string;
  name: string;
  description: string | null;
  base_price: number;
  status: string;
  created_date: string;
  lines?: TreatmentLine[];
}

interface PackageFormState {
  name: string;
  description: string;
  base_price: number;
  lines: TreatmentLine[];
}

const emptyForm = (): PackageFormState => ({
  name: '',
  description: '',
  base_price: 0,
  lines: [{ treatmentId: '', sessions: 1, isComplimentary: false }],
});

export default function ClinicPackagesManager() {
  const [packages, setPackages] = useState<ClinicPackage[]>([]);
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PackageFormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [pkgRes, txRes] = await Promise.all([
      supabase.from('clinic_packages').select('*').order('created_date'),
      supabase.from('clinic_package_treatments').select('*'),
    ]);
    const [tRes] = await Promise.all([
      supabase.from('treatments').select('*').eq('status', 'active').order('treatment_name'),
    ]);

    if (pkgRes.data && txRes.data && tRes.data) {
      const withLines = pkgRes.data.map((pkg) => ({
        ...pkg,
        lines: txRes.data
          .filter((l) => l.clinic_package_id === pkg.id)
          .map((l) => ({
            treatmentId: l.treatment_id,
            sessions: l.sessions,
            isComplimentary: l.is_complimentary,
          })),
      }));
      setPackages(withLines);
      setTreatments(tRes.data as Treatment[]);
    }
    setLoading(false);
  };

  const getTreatmentName = (id: string) =>
    treatments.find((t) => t.id === id)?.treatment_name || id;

  const vatAmount = (base: number) => base * VAT_RATE;
  const totalWithVat = (base: number) => base + vatAmount(base);

  const addLine = (isComplimentary = false) =>
    setForm((f) => ({ ...f, lines: [...f.lines, { treatmentId: '', sessions: 1, isComplimentary }] }));

  const removeLine = (i: number) =>
    setForm((f) => ({ ...f, lines: f.lines.filter((_, idx) => idx !== i) }));

  const updateLine = (i: number, field: keyof TreatmentLine, val: string | number | boolean) =>
    setForm((f) => ({ ...f, lines: f.lines.map((l, idx) => idx === i ? { ...l, [field]: val } : l) }));

  const startEdit = (pkg: ClinicPackage) => {
    setEditingId(pkg.id);
    setForm({
      name: pkg.name,
      description: pkg.description || '',
      base_price: pkg.base_price,
      lines: pkg.lines && pkg.lines.length > 0 ? pkg.lines : [{ treatmentId: '', sessions: 1, isComplimentary: false }],
    });
    setShowForm(true);
  };

  const cancelForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm());
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast({ title: 'Name required', description: 'Please enter a package name.', variant: 'destructive' });
      return;
    }
    const validLines = form.lines.filter((l) => l.treatmentId);
    if (validLines.length === 0) {
      toast({ title: 'Add treatments', description: 'Please add at least one treatment.', variant: 'destructive' });
      return;
    }

    setSaving(true);
    try {
      let packageId = editingId;

      if (editingId) {
        // Update existing
        const { error } = await supabase
          .from('clinic_packages')
          .update({ name: form.name, description: form.description || null, base_price: form.base_price })
          .eq('id', editingId);
        if (error) throw error;
        // Delete old lines then re-insert
        await supabase.from('clinic_package_treatments').delete().eq('clinic_package_id', editingId);
      } else {
        // Insert new
        const { data, error } = await supabase
          .from('clinic_packages')
          .insert({ name: form.name, description: form.description || null, base_price: form.base_price })
          .select('id')
          .single();
        if (error) throw error;
        packageId = data.id;
      }

      // Insert treatment lines
      if (packageId && validLines.length > 0) {
        const { error: lineError } = await supabase.from('clinic_package_treatments').insert(
          validLines.map((l) => ({
            clinic_package_id: packageId,
            treatment_id: l.treatmentId,
            sessions: l.sessions,
            is_complimentary: l.isComplimentary,
          }))
        );
        if (lineError) throw lineError;
      }

      toast({ title: 'Saved', description: `Package "${form.name}" saved successfully.` });
      cancelForm();
      fetchAll();
    } catch (err) {
      console.error(err);
      toast({ title: 'Error', description: 'Failed to save package.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (pkg: ClinicPackage) => {
    const newStatus = pkg.status === 'active' ? 'inactive' : 'active';
    await supabase.from('clinic_packages').update({ status: newStatus }).eq('id', pkg.id);
    fetchAll();
  };

  const renderSessionSelect = (value: number, onChange: (v: number) => void) => (
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

  const renderTreatmentSelect = (value: string, onChange: (v: string) => void) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-12 text-base">
        <SelectValue placeholder="Select treatment" />
      </SelectTrigger>
      <SelectContent>
        {treatments.map((t) => (
          <SelectItem key={t.id} value={t.id}>
            <span className="font-medium">{t.treatment_name}</span>
            <span className="text-xs text-muted-foreground ml-2">{t.category}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (loading) return <div className="text-center py-8 text-muted-foreground">Loading packages…</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      {!showForm && (
        <div className="flex justify-end">
          <TabletButton onClick={() => { setShowForm(true); setEditingId(null); setForm(emptyForm()); }} className="gap-2">
            <Plus className="h-4 w-4" /> New Package Template
          </TabletButton>
        </div>
      )}

      {/* Create / Edit Form */}
      {showForm && (
        <div className="border rounded-xl p-5 space-y-5 bg-muted/30">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base">{editingId ? 'Edit Package' : 'New Package Template'}</h3>
            <button onClick={cancelForm} className="text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Name + Description */}
          <div className="grid grid-cols-1 gap-3">
            <TabletInput label="Package Name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Mounjaro 1 Month Package" />
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional description" rows={2} />
            </div>
          </div>

          {/* Treatment Lines */}
          <div className="space-y-3">
            <label className="block text-sm font-medium">Treatments *</label>
            {form.lines.filter((l) => !l.isComplimentary).length === 0 && (
              <p className="text-xs text-muted-foreground">No paid treatments added</p>
            )}
            {form.lines.map((line, i) =>
              line.isComplimentary ? null : (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">{renderTreatmentSelect(line.treatmentId, (v) => updateLine(i, 'treatmentId', v))}</div>
                  {renderSessionSelect(line.sessions, (v) => updateLine(i, 'sessions', v))}
                  {form.lines.filter((l) => !l.isComplimentary).length > 1 && (
                    <button type="button" onClick={() => removeLine(i)} className="p-2 text-destructive hover:bg-destructive/10 rounded">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )
            )}
            <TabletButton type="button" variant="outline" size="sm" onClick={() => addLine(false)} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Add Treatment
            </TabletButton>
          </div>

          {/* Complimentary Lines */}
          <div className="space-y-3 border-t pt-4">
            <label className="block text-sm font-medium flex items-center gap-2">
              <Gift className="h-4 w-4 text-green-600" /> Complimentary Treatments
            </label>
            {form.lines.filter((l) => l.isComplimentary).length === 0 && (
              <p className="text-xs text-muted-foreground">No complimentary treatments</p>
            )}
            {form.lines.map((line, i) =>
              !line.isComplimentary ? null : (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">{renderTreatmentSelect(line.treatmentId, (v) => updateLine(i, 'treatmentId', v))}</div>
                  {renderSessionSelect(line.sessions, (v) => updateLine(i, 'sessions', v))}
                  <button type="button" onClick={() => removeLine(i)} className="p-2 text-destructive hover:bg-destructive/10 rounded">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )
            )}
            <TabletButton type="button" variant="outline" size="sm" onClick={() => addLine(true)} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Add Complimentary Treatment
            </TabletButton>
          </div>

          {/* Base Price + VAT preview */}
          <div className="space-y-2 border-t pt-4">
            <TabletInput
              label="Package Base Price (AED) *"
              type="number"
              min={0}
              step="0.01"
              value={form.base_price === 0 ? '' : form.base_price}
              onChange={(e) => setForm((f) => ({ ...f, base_price: parseFloat(e.target.value) || 0 }))}
              placeholder="e.g. 2299"
            />
            {form.base_price > 0 && (
              <div className="rounded-lg bg-muted p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Base Price:</span><span>AED {form.base_price.toFixed(2)}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>VAT (5%):</span><span>+ AED {vatAmount(form.base_price).toFixed(2)}</span></div>
                <div className="flex justify-between font-semibold border-t pt-1"><span>Total (VAT Incl.):</span><span>AED {totalWithVat(form.base_price).toFixed(2)}</span></div>
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <TabletButton variant="outline" fullWidth onClick={cancelForm}>Cancel</TabletButton>
            <TabletButton fullWidth onClick={handleSave} isLoading={saving}>
              <Check className="h-4 w-4 mr-1" /> {editingId ? 'Update Package' : 'Create Package'}
            </TabletButton>
          </div>
        </div>
      )}

      {/* Package List */}
      {packages.length === 0 && !showForm && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No package templates yet. Create one above.</p>
        </div>
      )}

      <div className="space-y-3">
        {packages.map((pkg) => (
          <div key={pkg.id} className={`border rounded-xl overflow-hidden ${pkg.status === 'inactive' ? 'opacity-60' : ''}`}>
            <div className="flex items-center justify-between p-4 bg-card">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <Package className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold truncate">{pkg.name}</span>
                    {pkg.status === 'inactive' && <Badge variant="secondary" className="text-xs">Inactive</Badge>}
                  </div>
                  {pkg.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{pkg.description}</p>}
                  <div className="text-xs text-muted-foreground mt-1">
                    Base: AED {pkg.base_price.toFixed(2)} → <span className="font-medium text-foreground">Total: AED {totalWithVat(pkg.base_price).toFixed(2)} (VAT incl.)</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => setExpandedId(expandedId === pkg.id ? null : pkg.id)}
                  className="p-2 text-muted-foreground hover:text-foreground rounded"
                >
                  {expandedId === pkg.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <button onClick={() => startEdit(pkg)} className="p-2 text-muted-foreground hover:text-primary rounded">
                  <Edit2 className="h-4 w-4" />
                </button>
                <TabletButton
                  variant={pkg.status === 'active' ? 'outline' : 'success'}
                  size="sm"
                  onClick={() => toggleStatus(pkg)}
                  className="text-xs"
                >
                  {pkg.status === 'active' ? 'Deactivate' : 'Activate'}
                </TabletButton>
              </div>
            </div>

            {expandedId === pkg.id && pkg.lines && pkg.lines.length > 0 && (
              <div className="border-t px-4 py-3 bg-muted/30 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Treatments</p>
                {pkg.lines.map((line, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    {line.isComplimentary && <Gift className="h-3.5 w-3.5 text-green-600 flex-shrink-0" />}
                    <span className="font-medium">{getTreatmentName(line.treatmentId)}</span>
                    <span className="text-muted-foreground">× {line.sessions} session{line.sessions > 1 ? 's' : ''}</span>
                    {line.isComplimentary && <Badge variant="secondary" className="text-xs ml-auto">Complimentary</Badge>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
