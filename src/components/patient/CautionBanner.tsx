import { AlertTriangle, ShieldAlert } from 'lucide-react';

interface CautionBannerProps {
  cautionNotes?: string | null;
  contraindicatedTreatmentNames?: string[];
}

export function CautionBanner({ cautionNotes, contraindicatedTreatmentNames }: CautionBannerProps) {
  if (!cautionNotes && (!contraindicatedTreatmentNames || contraindicatedTreatmentNames.length === 0)) {
    return null;
  }

  return (
    <div className="rounded-xl border-2 border-destructive bg-destructive/10 p-4 space-y-2 mb-6">
      {cautionNotes && (
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm text-destructive">⚠ Doctor's Caution</p>
            <p className="text-sm text-destructive/90 mt-0.5">{cautionNotes}</p>
          </div>
        </div>
      )}
      {contraindicatedTreatmentNames && contraindicatedTreatmentNames.length > 0 && (
        <div className="flex items-start gap-2">
          <ShieldAlert className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-sm text-destructive">🚫 Contraindicated Treatments</p>
            <p className="text-sm text-destructive/90 mt-0.5">
              {contraindicatedTreatmentNames.join(', ')}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
