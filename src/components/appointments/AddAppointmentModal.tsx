import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TabletButton } from '@/components/ui/tablet-button';
import { TabletInput } from '@/components/ui/tablet-input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import type { Appointment } from '@/pages/Appointments';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  defaultDate: string;
  onSaved: () => void;
}

export function AddAppointmentModal({ open, onOpenChange, appointment, defaultDate, onSaved }: Props) {
  const [saving, setSaving] = useState(false);
  const [treatments, setTreatments] = useState<{ id: string; treatment_name: string }[]>([]);
  const [form, setForm] = useState({
    patient_name: '',
    phone: '',
    appointment_date: defaultDate,
    appointment_time: '10:00',
    service: '',
    booked_by: '',
    is_new_patient: false,
  });

  useEffect(() => {
    if (open) {
      if (appointment) {
        setForm({
          patient_name: appointment.patient_name,
          phone: appointment.phone,
          appointment_date: appointment.appointment_date,
          appointment_time: appointment.appointment_time,
          service: appointment.service,
          booked_by: appointment.booked_by || '',
          is_new_patient: appointment.is_new_patient,
        });
      } else {
        setForm({
          patient_name: '',
          phone: '',
          appointment_date: defaultDate,
          appointment_time: '10:00',
          service: '',
          booked_by: '',
          is_new_patient: false,
        });
      }

      // Fetch treatments for service dropdown
      supabase.from('treatments').select('id, treatment_name').eq('status', 'active').then(({ data }) => {
        if (data) setTreatments(data);
      });
    }
  }, [open, appointment, defaultDate]);

  const handleSave = async () => {
    if (!form.patient_name || !form.phone || !form.service) {
      toast.error('Please fill in patient name, phone, and service');
      return;
    }

    setSaving(true);
    try {
      if (appointment) {
        const { error } = await supabase
          .from('appointments')
          .update(form)
          .eq('id', appointment.id);
        if (error) throw error;
        toast.success('Appointment updated');
      } else {
        const { error } = await supabase
          .from('appointments')
          .insert(form);
        if (error) throw error;
        toast.success('Appointment created');
      }
      onSaved();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{appointment ? 'Edit Appointment' : 'New Appointment'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <Label>Patient Name *</Label>
            <TabletInput value={form.patient_name} onChange={e => setForm(f => ({ ...f, patient_name: e.target.value }))} placeholder="Full name" />
          </div>

          <div>
            <Label>Phone *</Label>
            <TabletInput value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+971..." />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date *</Label>
              <TabletInput type="date" value={form.appointment_date} onChange={e => setForm(f => ({ ...f, appointment_date: e.target.value }))} />
            </div>
            <div>
              <Label>Time *</Label>
              <TabletInput type="time" value={form.appointment_time} onChange={e => setForm(f => ({ ...f, appointment_time: e.target.value }))} />
            </div>
          </div>

          <div>
            <Label>Service / Treatment *</Label>
            <Select value={form.service} onValueChange={v => setForm(f => ({ ...f, service: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select service" />
              </SelectTrigger>
              <SelectContent>
                {treatments.map(t => (
                  <SelectItem key={t.id} value={t.treatment_name}>{t.treatment_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Booked By</Label>
            <TabletInput value={form.booked_by} onChange={e => setForm(f => ({ ...f, booked_by: e.target.value }))} placeholder="e.g. WhatsApp, Call, Walk-in" />
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={form.is_new_patient} onCheckedChange={v => setForm(f => ({ ...f, is_new_patient: v }))} />
            <Label>New Patient</Label>
          </div>

          <div className="flex gap-3 pt-2">
            <TabletButton variant="outline" fullWidth onClick={() => onOpenChange(false)}>Cancel</TabletButton>
            <TabletButton fullWidth onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : appointment ? 'Update' : 'Create'}
            </TabletButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
