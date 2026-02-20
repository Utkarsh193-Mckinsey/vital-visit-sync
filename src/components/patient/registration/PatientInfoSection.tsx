import { useState } from 'react';
import { TabletInput } from '@/components/ui/tablet-input';
import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle } from '@/components/ui/tablet-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
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
  const [nationalityOpen, setNationalityOpen] = useState(false);

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
            <Popover open={nationalityOpen} onOpenChange={setNationalityOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={nationalityOpen}
                  className="w-full h-14 rounded-xl text-base justify-between font-normal"
                >
                  {formData.nationality || <span className="text-muted-foreground">Select nationality</span>}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search nationality..." className="h-10" />
                  <CommandList className="max-h-60">
                    <CommandEmpty>No nationality found.</CommandEmpty>
                    <CommandGroup>
                      {NATIONALITIES.map((n) => (
                        <CommandItem
                          key={n}
                          value={n}
                          onSelect={(val) => {
                            onChange('nationality', val === formData.nationality ? '' : val);
                            setNationalityOpen(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", formData.nationality === n ? "opacity-100" : "opacity-0")} />
                          {n}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
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
