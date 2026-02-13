import { TabletInput } from '@/components/ui/tablet-input';
import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle } from '@/components/ui/tablet-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Phone } from 'lucide-react';
import { RELATIONSHIPS } from './constants';

interface EmergencyContactSectionProps {
  formData: {
    emergency_contact_name: string;
    emergency_contact_number: string;
    emergency_contact_relationship: string;
  };
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
}

export default function EmergencyContactSection({ formData, errors, onChange }: EmergencyContactSectionProps) {
  return (
    <TabletCard className="mb-6">
      <TabletCardHeader>
        <div className="flex items-center gap-2">
          <Phone className="h-5 w-5" />
          <TabletCardTitle>Emergency Contact Details</TabletCardTitle>
        </div>
      </TabletCardHeader>
      <TabletCardContent className="space-y-4">
        <TabletInput
          label="Contact Name *"
          placeholder="Full name of emergency contact"
          value={formData.emergency_contact_name}
          onChange={(e) => onChange('emergency_contact_name', e.target.value)}
          error={errors.emergency_contact_name}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <TabletInput
            label="Contact Number *"
            type="tel"
            placeholder="e.g., +971 50 123 4567"
            value={formData.emergency_contact_number}
            onChange={(e) => onChange('emergency_contact_number', e.target.value)}
            error={errors.emergency_contact_number}
          />

          <div className="space-y-2">
            <Label className="block text-sm font-medium text-foreground">Relationship *</Label>
            <Select value={formData.emergency_contact_relationship} onValueChange={(v) => onChange('emergency_contact_relationship', v)}>
              <SelectTrigger className="h-14 rounded-xl text-base">
                <SelectValue placeholder="Select relationship" />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIPS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.emergency_contact_relationship && (
              <p className="text-sm text-destructive">{errors.emergency_contact_relationship}</p>
            )}
          </div>
        </div>
      </TabletCardContent>
    </TabletCard>
  );
}
