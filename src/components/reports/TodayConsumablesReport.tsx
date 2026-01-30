import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TabletCard, TabletCardContent } from '@/components/ui/tablet-card';
import { Package, User, Syringe } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface VisitTreatment {
  id: string;
  dose_administered: string;
  dose_unit: string;
  timestamp: string;
  treatment: {
    id: string;
    treatment_name: string;
    category: string;
  };
  visit: {
    patient: {
      id: string;
      full_name: string;
    };
  };
}

interface ProductSummary {
  treatmentId: string;
  treatmentName: string;
  category: string;
  totalQuantity: number;
  unit: string;
  sessionCount: number;
}

interface PatientSummary {
  patientId: string;
  patientName: string;
  treatments: {
    treatmentName: string;
    dose: string;
    unit: string;
    time: string;
  }[];
}

export function TodayConsumablesReport() {
  const [productSummary, setProductSummary] = useState<ProductSummary[]>([]);
  const [patientSummary, setPatientSummary] = useState<PatientSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConsumables = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error } = await supabase
      .from('visit_treatments')
      .select(`
        id,
        dose_administered,
        dose_unit,
        timestamp,
        treatment:treatments (
          id,
          treatment_name,
          category
        ),
        visit:visits (
          patient:patients (
            id,
            full_name
          )
        )
      `)
      .gte('timestamp', today.toISOString())
      .lt('timestamp', tomorrow.toISOString())
      .order('timestamp', { ascending: false });

    if (error) {
      console.error('Error fetching consumables:', error);
      setIsLoading(false);
      return;
    }

    const treatments = data as unknown as VisitTreatment[];

    // Build product summary
    const productMap = new Map<string, ProductSummary>();
    treatments.forEach((t) => {
      const key = t.treatment.id;
      const existing = productMap.get(key);
      const doseNum = parseFloat(t.dose_administered) || 0;
      
      if (existing) {
        existing.totalQuantity += doseNum;
        existing.sessionCount += 1;
      } else {
        productMap.set(key, {
          treatmentId: t.treatment.id,
          treatmentName: t.treatment.treatment_name,
          category: t.treatment.category,
          totalQuantity: doseNum,
          unit: t.dose_unit,
          sessionCount: 1,
        });
      }
    });

    // Build patient summary
    const patientMap = new Map<string, PatientSummary>();
    treatments.forEach((t) => {
      const patientId = t.visit.patient.id;
      const existing = patientMap.get(patientId);
      const treatmentEntry = {
        treatmentName: t.treatment.treatment_name,
        dose: t.dose_administered,
        unit: t.dose_unit,
        time: new Date(t.timestamp).toLocaleTimeString('en-AE', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      };
      
      if (existing) {
        existing.treatments.push(treatmentEntry);
      } else {
        patientMap.set(patientId, {
          patientId,
          patientName: t.visit.patient.full_name,
          treatments: [treatmentEntry],
        });
      }
    });

    setProductSummary(Array.from(productMap.values()).sort((a, b) => 
      b.sessionCount - a.sessionCount
    ));
    setPatientSummary(Array.from(patientMap.values()).sort((a, b) => 
      b.treatments.length - a.treatments.length
    ));
    setIsLoading(false);
  };

  useEffect(() => {
    fetchConsumables();

    // Refresh every 30 seconds
    const interval = setInterval(fetchConsumables, 30000);

    // Subscribe to realtime updates
    const channel = supabase
      .channel('consumables-report')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visit_treatments' },
        fetchConsumables
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, []);

  if (isLoading) {
    return (
      <TabletCard>
        <TabletCardContent className="p-6">
          <div className="flex items-center justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </TabletCardContent>
      </TabletCard>
    );
  }

  const totalSessions = productSummary.reduce((sum, p) => sum + p.sessionCount, 0);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <TabletCard>
          <TabletCardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Syringe className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Total Treatments</span>
            </div>
            <p className="text-2xl font-bold text-primary">{totalSessions}</p>
          </TabletCardContent>
        </TabletCard>
        <TabletCard>
          <TabletCardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <Package className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Products Used</span>
            </div>
            <p className="text-2xl font-bold text-primary">{productSummary.length}</p>
          </TabletCardContent>
        </TabletCard>
        <TabletCard className="col-span-2 md:col-span-1">
          <TabletCardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Patients Treated</span>
            </div>
            <p className="text-2xl font-bold text-primary">{patientSummary.length}</p>
          </TabletCardContent>
        </TabletCard>
      </div>

      {/* Product-wise Breakdown */}
      <TabletCard>
        <TabletCardContent className="p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Product-wise Usage
          </h3>
          {productSummary.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No treatments administered today
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Treatment</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Sessions</TableHead>
                  <TableHead className="text-right">Total Quantity</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {productSummary.map((product) => (
                  <TableRow key={product.treatmentId}>
                    <TableCell className="font-medium">{product.treatmentName}</TableCell>
                    <TableCell>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                        {product.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">{product.sessionCount}</TableCell>
                    <TableCell className="text-right font-medium">
                      {product.totalQuantity > 0 
                        ? `${product.totalQuantity} ${product.unit}`
                        : '-'
                      }
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabletCardContent>
      </TabletCard>

      {/* Patient-wise Breakdown */}
      <TabletCard>
        <TabletCardContent className="p-4">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Patient-wise Usage
          </h3>
          {patientSummary.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No patients treated today
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Treatment</TableHead>
                  <TableHead className="text-right">Dose</TableHead>
                  <TableHead className="text-right">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {patientSummary.map((patient) => (
                  patient.treatments.map((treatment, idx) => (
                    <TableRow key={`${patient.patientId}-${idx}`}>
                      {idx === 0 ? (
                        <TableCell 
                          className="font-medium" 
                          rowSpan={patient.treatments.length}
                        >
                          {patient.patientName}
                        </TableCell>
                      ) : null}
                      <TableCell>{treatment.treatmentName}</TableCell>
                      <TableCell className="text-right">
                        {treatment.dose} {treatment.unit}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {treatment.time}
                      </TableCell>
                    </TableRow>
                  ))
                ))}
              </TableBody>
            </Table>
          )}
        </TabletCardContent>
      </TabletCard>
    </div>
  );
}
