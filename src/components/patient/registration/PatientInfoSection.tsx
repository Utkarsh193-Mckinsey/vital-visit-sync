import { TabletInput } from '@/components/ui/tablet-input';
import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle } from '@/components/ui/tablet-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { NATIONALITIES, COUNTRIES, UAE_EMIRATES } from './constants';

interface PatientInfoSectionProps {
  formData: {
    full_name: string;
    date_of_birth: string;
    phone_number: string;
    nationality: string;
    gender: string;
    country_of_residence: string;
    emirate: string;
    emirates_id: string;
  };
  errors: Record<string, string>;
  onChange: (field: string, value: string) => void;
}

export default function PatientInfoSection({ formData, errors, onChange }: PatientInfoSectionProps) {
  return (
    <TabletCard className="mb-6">
      <TabletCardHeader>
        <TabletCardTitle>Patient Information</TabletCardTitle>
      </TabletCardHeader>
      <TabletCardContent className="space-y-4">
        <TabletInput
          label="Full Name *"
          placeholder="Enter patient's full name"
          value={formData.full_name}
          onChange={(e) => onChange('full_name', e.target.value)}
          error={errors.full_name}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <TabletInput
            label="Date of Birth *"
            type="date"
            value={formData.date_of_birth}
            onChange={(e) => onChange('date_of_birth', e.target.value)}
            error={errors.date_of_birth}
          />
          <TabletInput
            label="Mobile Number *"
            type="tel"
            placeholder="e.g., +971 50 123 4567"
            value={formData.phone_number}
            onChange={(e) => onChange('phone_number', e.target.value)}
            error={errors.phone_number}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="block text-sm font-medium text-foreground">Nationality *</Label>
            <Select value={formData.nationality} onValueChange={(v) => onChange('nationality', v)}>
              <SelectTrigger className="h-14 rounded-xl text-base">
                <SelectValue placeholder="Select nationality" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {NATIONALITIES.map((n) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.nationality && <p className="text-sm text-destructive">{errors.nationality}</p>}
          </div>

          <div className="space-y-2">
            <Label className="block text-sm font-medium text-foreground">Gender *</Label>
            <Select value={formData.gender} onValueChange={(v) => onChange('gender', v)}>
              <SelectTrigger className="h-14 rounded-xl text-base">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Male">Male</SelectItem>
                <SelectItem value="Female">Female</SelectItem>
              </SelectContent>
            </Select>
            {errors.gender && <p className="text-sm text-destructive">{errors.gender}</p>}
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label className="block text-sm font-medium text-foreground">Country of Residence</Label>
            <Select value={formData.country_of_residence} onValueChange={(v) => onChange('country_of_residence', v)}>
              <SelectTrigger className="h-14 rounded-xl text-base">
                <SelectValue placeholder="Select country" />
              </SelectTrigger>
              <SelectContent className="max-h-60">
                {COUNTRIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="block text-sm font-medium text-foreground">Emirate</Label>
            <Select value={formData.emirate} onValueChange={(v) => onChange('emirate', v)}>
              <SelectTrigger className="h-14 rounded-xl text-base">
                <SelectValue placeholder="Select emirate" />
              </SelectTrigger>
              <SelectContent>
                {UAE_EMIRATES.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <TabletInput
          label="Emirates ID"
          placeholder="784-XXXX-XXXXXXX-X"
          value={formData.emirates_id}
          onChange={(e) => onChange('emirates_id', e.target.value)}
        />
      </TabletCardContent>
    </TabletCard>
  );
}
