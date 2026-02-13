import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle } from '@/components/ui/tablet-card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { HeartPulse } from 'lucide-react';

interface MedicalCondition {
  key: string;
  label: string;
  value: boolean;
  details: string;
}

interface MedicalHistorySectionProps {
  conditions: MedicalCondition[];
  onChange: (key: string, hasCondition: boolean) => void;
  onDetailsChange: (key: string, details: string) => void;
}

export default function MedicalHistorySection({ conditions, onChange, onDetailsChange }: MedicalHistorySectionProps) {
  return (
    <TabletCard className="mb-6">
      <TabletCardHeader>
        <div className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5" />
          <TabletCardTitle>Medical History Declaration</TabletCardTitle>
        </div>
      </TabletCardHeader>
      <TabletCardContent className="space-y-5">
        {conditions.map((condition) => (
          <div key={condition.key} className="space-y-3">
            <div className="flex items-center justify-between gap-4">
              <Label className="text-sm font-medium text-foreground flex-1">{condition.label}</Label>
              <Select
                value={condition.value ? 'yes' : 'no'}
                onValueChange={(v) => onChange(condition.key, v === 'yes')}
              >
                <SelectTrigger className="w-28 h-14 rounded-xl text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="no">No</SelectItem>
                  <SelectItem value="yes">Yes</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {condition.value && (
              <Textarea
                placeholder="Please provide details..."
                value={condition.details}
                onChange={(e) => onDetailsChange(condition.key, e.target.value)}
                className="rounded-xl min-h-[80px] text-base"
              />
            )}
          </div>
        ))}
      </TabletCardContent>
    </TabletCard>
  );
}
