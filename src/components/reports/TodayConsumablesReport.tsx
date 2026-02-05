import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TabletCard, TabletCardContent } from '@/components/ui/tablet-card';
 import { Package, User, Syringe, Box } from 'lucide-react';
 import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
   consumables: {
     itemName: string;
     quantity: number;
     unit: string;
   }[];
}

 interface VisitConsumable {
   id: string;
   quantity_used: number;
   created_date: string;
   stock_item: {
     id: string;
     item_name: string;
     category: string;
     unit: string;
   };
   visit: {
     patient: {
       id: string;
       full_name: string;
     };
   };
 }
 
 interface StockSummary {
   itemId: string;
   itemName: string;
   category: string;
   totalQuantity: number;
   unit: string;
 }
 
export function TodayConsumablesReport() {
  const [productSummary, setProductSummary] = useState<ProductSummary[]>([]);
  const [patientSummary, setPatientSummary] = useState<PatientSummary[]>([]);
   const [stockSummary, setStockSummary] = useState<StockSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchConsumables = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

     // Fetch treatments
     const { data: treatmentsData, error: treatmentsError } = await supabase
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

     // Fetch stock consumables
     const { data: consumablesData, error: consumablesError } = await supabase
       .from('visit_consumables')
       .select(`
         id,
         quantity_used,
         created_date,
         stock_item:stock_items (
           id,
           item_name,
           category,
           unit
         ),
         visit:visits (
           patient:patients (
             id,
             full_name
           )
         )
       `)
       .gte('created_date', today.toISOString())
       .lt('created_date', tomorrow.toISOString());
 
     if (treatmentsError || consumablesError) {
       console.error('Error fetching data:', treatmentsError || consumablesError);
      setIsLoading(false);
      return;
    }

     const treatments = treatmentsData as unknown as VisitTreatment[];
     const consumables = consumablesData as unknown as VisitConsumable[];

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

     // Build stock summary
     const stockMap = new Map<string, StockSummary>();
     consumables.forEach((c) => {
       const key = c.stock_item.id;
       const existing = stockMap.get(key);
       
       if (existing) {
         existing.totalQuantity += c.quantity_used;
       } else {
         stockMap.set(key, {
           itemId: c.stock_item.id,
           itemName: c.stock_item.item_name,
           category: c.stock_item.category,
           totalQuantity: c.quantity_used,
           unit: c.stock_item.unit,
         });
       }
     });
 
    // Build patient summary
    const patientMap = new Map<string, PatientSummary>();
    treatments.forEach((t) => {
      const patientId = t.visit.patient.id;
       let existing = patientMap.get(patientId);
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
         existing = {
          patientId,
          patientName: t.visit.patient.full_name,
          treatments: [treatmentEntry],
           consumables: [],
         };
         patientMap.set(patientId, existing);
      }
    });
 
     // Add consumables to patient summary
     consumables.forEach((c) => {
       const patientId = c.visit.patient.id;
       let existing = patientMap.get(patientId);
       const consumableEntry = {
         itemName: c.stock_item.item_name,
         quantity: c.quantity_used,
         unit: c.stock_item.unit,
       };
       
       if (existing) {
         existing.consumables.push(consumableEntry);
       } else {
         patientMap.set(patientId, {
           patientId,
           patientName: c.visit.patient.full_name,
           treatments: [],
           consumables: [consumableEntry],
         });
       }
     });

    setProductSummary(Array.from(productMap.values()).sort((a, b) => 
      b.sessionCount - a.sessionCount
    ));
     setStockSummary(Array.from(stockMap.values()).sort((a, b) => 
       b.totalQuantity - a.totalQuantity
     ));
    setPatientSummary(Array.from(patientMap.values()).sort((a, b) => 
       (b.treatments.length + b.consumables.length) - (a.treatments.length + a.consumables.length)
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
       .on(
         'postgres_changes',
         { event: '*', schema: 'public', table: 'visit_consumables' },
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
   const totalStockItems = stockSummary.reduce((sum, s) => sum + s.totalQuantity, 0);

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
       <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
         <TabletCard>
           <TabletCardContent className="p-4 text-center">
             <div className="flex items-center justify-center gap-2 mb-1">
               <Box className="h-4 w-4 text-primary" />
               <span className="text-sm text-muted-foreground">Stock Items</span>
             </div>
             <p className="text-2xl font-bold text-primary">{totalStockItems}</p>
           </TabletCardContent>
         </TabletCard>
         <TabletCard>
          <TabletCardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-1">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm text-muted-foreground">Patients Treated</span>
            </div>
            <p className="text-2xl font-bold text-primary">{patientSummary.length}</p>
          </TabletCardContent>
        </TabletCard>
      </div>

       {/* Tabbed Views */}
       <Tabs defaultValue="products" className="w-full">
         <TabsList className="grid w-full grid-cols-3">
           <TabsTrigger value="products">Products</TabsTrigger>
           <TabsTrigger value="stock">Stock Items</TabsTrigger>
           <TabsTrigger value="patients">By Patient</TabsTrigger>
         </TabsList>
 
         <TabsContent value="products" className="mt-4">
           <TabletCard>
             <TabletCardContent className="p-4">
               <h3 className="font-semibold mb-4 flex items-center gap-2">
                 <Package className="h-4 w-4 text-primary" />
                 Treatment Products Used
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
         </TabsContent>
 
         <TabsContent value="stock" className="mt-4">
           <TabletCard>
             <TabletCardContent className="p-4">
               <h3 className="font-semibold mb-4 flex items-center gap-2">
                 <Box className="h-4 w-4 text-primary" />
                 Stock Consumables Used
               </h3>
               {stockSummary.length === 0 ? (
                 <p className="text-sm text-muted-foreground text-center py-4">
                   No stock items used today
                 </p>
               ) : (
                 <Table>
                   <TableHeader>
                     <TableRow>
                       <TableHead>Item</TableHead>
                       <TableHead>Category</TableHead>
                       <TableHead className="text-right">Quantity Used</TableHead>
                     </TableRow>
                   </TableHeader>
                   <TableBody>
                     {stockSummary.map((item) => (
                       <TableRow key={item.itemId}>
                         <TableCell className="font-medium">{item.itemName}</TableCell>
                         <TableCell>
                           <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
                             {item.category}
                           </span>
                         </TableCell>
                         <TableCell className="text-right font-medium">
                           {item.totalQuantity} {item.unit}
                         </TableCell>
                       </TableRow>
                     ))}
                   </TableBody>
                 </Table>
               )}
             </TabletCardContent>
           </TabletCard>
         </TabsContent>
 
         <TabsContent value="patients" className="mt-4">
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
                 <div className="space-y-4">
                   {patientSummary.map((patient) => (
                     <div key={patient.patientId} className="border rounded-lg p-3">
                       <h4 className="font-medium mb-2">{patient.patientName}</h4>
                       {patient.treatments.length > 0 && (
                         <div className="mb-2">
                           <p className="text-xs text-muted-foreground mb-1">Treatments:</p>
                           <ul className="text-sm space-y-1">
                             {patient.treatments.map((t, idx) => (
                               <li key={idx} className="flex justify-between">
                                 <span>{t.treatmentName}</span>
                                 <span className="text-muted-foreground">{t.dose} {t.unit} @ {t.time}</span>
                               </li>
                             ))}
                           </ul>
                         </div>
                       )}
                       {patient.consumables.length > 0 && (
                         <div>
                           <p className="text-xs text-muted-foreground mb-1">Consumables:</p>
                           <ul className="text-sm space-y-1">
                             {patient.consumables.map((c, idx) => (
                               <li key={idx} className="flex justify-between">
                                 <span>{c.itemName}</span>
                                 <span className="text-muted-foreground">{c.quantity} {c.unit}</span>
                               </li>
                             ))}
                           </ul>
                         </div>
                       )}
                     </div>
                   ))}
                 </div>
               )}
             </TabletCardContent>
           </TabletCard>
         </TabsContent>
       </Tabs>
    </div>
  );
}
