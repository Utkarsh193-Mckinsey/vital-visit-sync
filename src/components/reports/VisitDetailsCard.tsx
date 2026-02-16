import { useState } from 'react';
import { TabletCard, TabletCardContent } from '@/components/ui/tablet-card';
import { CheckCircle, ChevronDown, ChevronUp, User, Stethoscope, Syringe, Package, FileText, Activity } from 'lucide-react';
import type { Visit, Patient, ConsentForm, Treatment, Staff } from '@/types/database';

interface VisitTreatmentDetail {
  id: string;
  dose_administered: string;
  dose_unit: string;
  timestamp: string;
  treatment: Treatment;
  doctor_staff?: Staff | null;
  nurse_staff?: Staff | null;
}

interface VisitConsumableDetail {
  id: string;
  quantity_used: number;
  stock_item: {
    item_name: string;
    unit: string;
  };
}

interface CompletedVisit extends Visit {
  patient: Patient;
  consent_forms: (ConsentForm & { treatment: Treatment })[];
  nurse_staff?: Staff | null;
  doctor_staff?: Staff | null;
  visit_treatments?: VisitTreatmentDetail[];
  visit_consumables?: VisitConsumableDetail[];
}

interface VisitDetailsCardProps {
  visit: CompletedVisit;
}

export function VisitDetailsCard({ visit }: VisitDetailsCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <TabletCard 
      className="overflow-hidden border-l-4 border-l-success cursor-pointer transition-all hover:shadow-md"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <TabletCardContent className="p-4">
        {/* Header - always visible */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-semibold">{visit.patient.full_name}</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">
              Visit #{visit.visit_number}
            </span>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-1.5 mb-3">
          {visit.consent_forms.map((cf) => (
            <span 
              key={cf.id}
              className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success"
            >
              {cf.treatment?.treatment_name}
            </span>
          ))}
        </div>
        
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5 text-success" />
            Completed
          </span>
          {visit.completed_date && (
            <span>
              {new Date(visit.completed_date).toLocaleTimeString('en-AE', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>

        {/* Expanded details */}
        {isExpanded && (
          <div className="mt-4 pt-4 border-t space-y-4" onClick={(e) => e.stopPropagation()}>
            {/* Vitals */}
            {visit.vitals_completed && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Vitals
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {visit.blood_pressure_systolic && visit.blood_pressure_diastolic && (
                    <div className="bg-muted/50 rounded-md p-2">
                      <span className="text-muted-foreground text-xs">Blood Pressure</span>
                      <p className="font-medium">{visit.blood_pressure_systolic}/{visit.blood_pressure_diastolic} mmHg</p>
                    </div>
                  )}
                  {visit.heart_rate && (
                    <div className="bg-muted/50 rounded-md p-2">
                      <span className="text-muted-foreground text-xs">Heart Rate</span>
                      <p className="font-medium">{visit.heart_rate} bpm</p>
                    </div>
                  )}
                  {visit.weight_kg && (
                    <div className="bg-muted/50 rounded-md p-2">
                      <span className="text-muted-foreground text-xs">Weight</span>
                      <p className="font-medium">{visit.weight_kg} kg</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Treatments Administered */}
            {visit.visit_treatments && visit.visit_treatments.length > 0 && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Syringe className="h-4 w-4 text-primary" />
                  Treatments Administered
                </h4>
                <ul className="space-y-1.5">
                  {visit.visit_treatments.map((vt) => (
                    <li key={vt.id} className="text-sm bg-muted/50 rounded-md p-2">
                      <div className="flex justify-between">
                        <span>{vt.treatment.treatment_name}</span>
                        <span className="text-muted-foreground font-medium">
                          {vt.dose_administered} {vt.dose_unit}
                        </span>
                      </div>
                      {(vt.doctor_staff || vt.nurse_staff) && (
                        <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                          {vt.doctor_staff && <span>Dr: {vt.doctor_staff.full_name}</span>}
                          {vt.nurse_staff && <span>Nurse: {vt.nurse_staff.full_name}</span>}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Consumables Used */}
            {visit.visit_consumables && visit.visit_consumables.length > 0 && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <Package className="h-4 w-4 text-primary" />
                  Consumables Used
                </h4>
                <ul className="space-y-1.5">
                  {visit.visit_consumables.map((vc) => (
                    <li key={vc.id} className="text-sm flex justify-between bg-muted/50 rounded-md p-2">
                      <span>{vc.stock_item.item_name}</span>
                      <span className="text-muted-foreground font-medium">
                        {vc.quantity_used} {vc.stock_item.unit}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Doctor Notes */}
            {visit.doctor_notes && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <FileText className="h-4 w-4 text-primary" />
                  Doctor Notes
                </h4>
                <p className="text-sm bg-muted/50 rounded-md p-2 whitespace-pre-wrap">
                  {visit.doctor_notes}
                </p>
              </div>
            )}

            {/* Staff */}
            {(visit.nurse_staff || visit.doctor_staff) && (
              <div>
                <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-primary" />
                  Staff
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {visit.nurse_staff && (
                    <div className="bg-muted/50 rounded-md p-2">
                      <span className="text-muted-foreground text-xs">Nurse</span>
                      <p className="font-medium">{visit.nurse_staff.full_name}</p>
                    </div>
                  )}
                  {visit.doctor_staff && (
                    <div className="bg-muted/50 rounded-md p-2">
                      <span className="text-muted-foreground text-xs">Doctor</span>
                      <p className="font-medium">{visit.doctor_staff.full_name}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Patient Info */}
            <div>
              <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
                <Stethoscope className="h-4 w-4 text-primary" />
                Patient Info
              </h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="bg-muted/50 rounded-md p-2">
                  <span className="text-muted-foreground text-xs">Phone</span>
                  <p className="font-medium">{visit.patient.phone_number}</p>
                </div>
                <div className="bg-muted/50 rounded-md p-2">
                  <span className="text-muted-foreground text-xs">Email</span>
                  <p className="font-medium truncate">{visit.patient.email}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </TabletCardContent>
    </TabletCard>
  );
}
