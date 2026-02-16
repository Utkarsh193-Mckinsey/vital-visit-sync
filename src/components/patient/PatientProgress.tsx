import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { TabletCard, TabletCardContent, TabletCardHeader, TabletCardTitle } from '@/components/ui/tablet-card';
import { TrendingDown, TrendingUp, Calendar, Activity } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface VisitData {
  visit_number: number;
  visit_date: string;
  weight_kg: number | null;
  blood_pressure_systolic: number | null;
  blood_pressure_diastolic: number | null;
  heart_rate: number | null;
  current_status: string;
}

interface TreatmentSummary {
  treatment_name: string;
  category: string;
  total_sessions: number;
  first_date: string;
  last_date: string;
  doses: string[];
}

interface PatientProgressProps {
  patientId: string;
}

export default function PatientProgress({ patientId }: PatientProgressProps) {
  const [visits, setVisits] = useState<VisitData[]>([]);
  const [treatmentSummaries, setTreatmentSummaries] = useState<TreatmentSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [patientId]);

  const fetchData = async () => {
    try {
      // Fetch completed visits with vitals
      const { data: visitsData } = await supabase
        .from('visits')
        .select('visit_number, visit_date, weight_kg, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, current_status')
        .eq('patient_id', patientId)
        .eq('current_status', 'completed')
        .order('visit_number', { ascending: true });

      if (visitsData) setVisits(visitsData);

      // Fetch treatment history
      const { data: treatmentsData } = await supabase
        .from('visit_treatments')
        .select(`
          dose_administered,
          dose_unit,
          timestamp,
          treatment:treatments (treatment_name, category)
        `)
        .eq('visit_id', patientId); // This won't work - need to join through visits

      // Better approach: get visit_treatments through visits
      const { data: vtData } = await supabase
        .from('visits')
        .select(`
          visit_date,
          visit_treatments (
            dose_administered,
            dose_unit,
            timestamp,
            treatment:treatments (treatment_name, category)
          )
        `)
        .eq('patient_id', patientId)
        .eq('current_status', 'completed')
        .order('visit_date', { ascending: true });

      if (vtData) {
        const summaryMap: Record<string, TreatmentSummary> = {};
        for (const visit of vtData) {
          const vts = (visit as any).visit_treatments || [];
          for (const vt of vts) {
            const name = vt.treatment?.treatment_name;
            if (!name) continue;
            if (!summaryMap[name]) {
              summaryMap[name] = {
                treatment_name: name,
                category: vt.treatment?.category || '',
                total_sessions: 0,
                first_date: visit.visit_date,
                last_date: visit.visit_date,
                doses: [],
              };
            }
            summaryMap[name].total_sessions++;
            summaryMap[name].last_date = visit.visit_date;
            const doseStr = `${vt.dose_administered} ${vt.dose_unit}`;
            if (!summaryMap[name].doses.includes(doseStr)) {
              summaryMap[name].doses.push(doseStr);
            }
          }
        }
        setTreatmentSummaries(Object.values(summaryMap));
      }
    } catch (error) {
      console.error('Error fetching patient progress:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-AE', { month: 'short', day: 'numeric' });

  if (isLoading) {
    return (
      <TabletCard>
        <TabletCardContent className="p-4">
          <div className="flex items-center justify-center py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </TabletCardContent>
      </TabletCard>
    );
  }

  const weightData = visits
    .filter(v => v.weight_kg !== null)
    .map(v => ({
      visit: `#${v.visit_number}`,
      date: formatDate(v.visit_date),
      weight: Number(v.weight_kg),
    }));

  const firstWeight = weightData.length > 0 ? weightData[0].weight : null;
  const lastWeight = weightData.length > 0 ? weightData[weightData.length - 1].weight : null;
  const weightChange = firstWeight && lastWeight ? lastWeight - firstWeight : null;

  if (visits.length === 0 && treatmentSummaries.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* Weight Trend */}
      {weightData.length >= 2 && (
        <TabletCard>
          <TabletCardHeader>
            <div className="flex items-center justify-between">
              <TabletCardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Weight Progress
              </TabletCardTitle>
              {weightChange !== null && (
                <span className={`flex items-center gap-1 text-sm font-medium ${
                  weightChange < 0 ? 'text-success' : weightChange > 0 ? 'text-destructive' : 'text-muted-foreground'
                }`}>
                  {weightChange < 0 ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
                  {weightChange > 0 ? '+' : ''}{weightChange.toFixed(1)} kg
                </span>
              )}
            </div>
          </TabletCardHeader>
          <TabletCardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weightData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="visit" className="text-xs" />
                <YAxis domain={['dataMin - 2', 'dataMax + 2']} className="text-xs" />
                <Tooltip
                  formatter={(value: number) => [`${value} kg`, 'Weight']}
                  labelFormatter={(label) => `Visit ${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="weight"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </TabletCardContent>
        </TabletCard>
      )}

      {/* Treatment Summaries */}
      {treatmentSummaries.length > 0 && (
        <TabletCard>
          <TabletCardHeader>
            <TabletCardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Treatment History
            </TabletCardTitle>
          </TabletCardHeader>
          <TabletCardContent>
            <div className="space-y-3">
              {treatmentSummaries.map((ts) => (
                <div key={ts.treatment_name} className="p-3 rounded-lg bg-secondary/30 border">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold">{ts.treatment_name}</h4>
                      <p className="text-xs text-muted-foreground">{ts.category}</p>
                    </div>
                    <span className="text-sm font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">
                      {ts.total_sessions} session{ts.total_sessions !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Started: {formatDate(ts.first_date)}</span>
                    <span>•</span>
                    <span>Last: {formatDate(ts.last_date)}</span>
                  </div>
                  {ts.doses.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {ts.doses.map((dose) => (
                        <span key={dose} className="text-xs bg-muted px-2 py-0.5 rounded-full">
                          {dose}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </TabletCardContent>
        </TabletCard>
      )}
    </div>
  );
}
