import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TabletCard, TabletCardContent } from '@/components/ui/tablet-card';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { ClipboardCheck, Package } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { TodayConsumablesReport } from '@/components/reports/TodayConsumablesReport';
import { VisitDetailsCard } from '@/components/reports/VisitDetailsCard';
import type { Visit, Patient, ConsentForm, Treatment, Staff } from '@/types/database';

interface VisitTreatmentDetail {
  id: string;
  dose_administered: string;
  dose_unit: string;
  timestamp: string;
  treatment: Treatment;
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

export default function CompletedToday() {
  const [visits, setVisits] = useState<CompletedVisit[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchVisits = async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data, error } = await supabase
      .from('visits')
      .select(`
        *,
        patient:patients (*),
        consent_forms (
          *,
          treatment:treatments (*)
        ),
        nurse_staff:staff!visits_nurse_staff_id_fkey (*),
        doctor_staff:staff!visits_doctor_staff_id_fkey (*),
        visit_treatments (
          id,
          dose_administered,
          dose_unit,
          timestamp,
          treatment:treatments (*)
        ),
        visit_consumables (
          id,
          quantity_used,
          stock_item:stock_items (
            item_name,
            unit
          )
        )
      `)
      .eq('current_status', 'completed')
      .gte('completed_date', today.toISOString())
      .lt('completed_date', tomorrow.toISOString())
      .order('completed_date', { ascending: false });

    if (error) {
      console.error('Error fetching completed visits:', error);
    } else {
      setVisits(data as unknown as CompletedVisit[]);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchVisits();

    const interval = setInterval(fetchVisits, 10000);

    const channel = supabase
      .channel('completed-visits')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'visits' },
        fetchVisits
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, []);

  return (
    <PageContainer maxWidth="xl">
      <PageHeader 
        title="Completed Today"
        subtitle={`${visits.length} visit${visits.length !== 1 ? 's' : ''} completed`}
      />

      <Tabs defaultValue="visits" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="visits" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Visits
          </TabsTrigger>
          <TabsTrigger value="consumables" className="gap-2">
            <Package className="h-4 w-4" />
            Consumables
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visits">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <div className="text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-muted-foreground">Loading...</p>
              </div>
            </div>
          ) : visits.length === 0 ? (
            <TabletCard>
              <TabletCardContent className="p-8 text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                  <ClipboardCheck className="h-7 w-7 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No completed treatments today</p>
              </TabletCardContent>
            </TabletCard>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {visits.map((visit) => (
                <VisitDetailsCard key={visit.id} visit={visit} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="consumables">
          <TodayConsumablesReport />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
}
