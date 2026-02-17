import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { PageContainer, PageHeader } from '@/components/layout/PageContainer';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TabletCard } from '@/components/ui/tablet-card';
import { TabletInput } from '@/components/ui/tablet-input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, startOfMonth, endOfMonth } from 'date-fns';

interface SdrRow {
  name: string;
  appointmentsBooked: number;
  patientsRegistered: number;
  totalSales: number;
  amountCollected: number;
}

interface DoctorRow {
  name: string;
  staffId: string;
  consultations: number;
  converted: number;
  conversionRate: number;
  totalPackageValue: number;
  treatmentsAdministered: number;
}

export default function StaffReports() {
  const [tab, setTab] = useState('sdr');
  const now = new Date();
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(endOfMonth(now), 'yyyy-MM-dd'));
  const [sdrData, setSdrData] = useState<SdrRow[]>([]);
  const [doctorData, setDoctorData] = useState<DoctorRow[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchSdrReport = async () => {
    setLoading(true);
    try {
      const fromISO = new Date(dateFrom).toISOString();
      const toISO = new Date(dateTo + 'T23:59:59').toISOString();

      // Get appointments in range
      const { data: appointments } = await supabase
        .from('appointments')
        .select('booked_by')
        .gte('created_at', fromISO)
        .lte('created_at', toISO);

      // Get patients registered in range
      const { data: patients } = await supabase
        .from('patients')
        .select('registered_by')
        .gte('registration_date', fromISO)
        .lte('registration_date', toISO);

      // Get packages in range
      const { data: packages } = await supabase
        .from('packages')
        .select('created_by, total_amount, amount_paid, staff:staff!packages_created_by_fkey(full_name)')
        .gte('purchase_date', fromISO)
        .lte('purchase_date', toISO);

      // Aggregate by staff name
      const map: Record<string, SdrRow> = {};
      const ensure = (name: string) => {
        if (!name) return;
        if (!map[name]) map[name] = { name, appointmentsBooked: 0, patientsRegistered: 0, totalSales: 0, amountCollected: 0 };
      };

      (appointments || []).forEach((a: any) => {
        if (a.booked_by) { ensure(a.booked_by); map[a.booked_by].appointmentsBooked++; }
      });

      (patients || []).forEach((p: any) => {
        if (p.registered_by) { ensure(p.registered_by); map[p.registered_by].patientsRegistered++; }
      });

      (packages || []).forEach((pkg: any) => {
        const staffName = pkg.staff?.full_name;
        if (staffName) {
          ensure(staffName);
          map[staffName].totalSales += Number(pkg.total_amount || 0);
          map[staffName].amountCollected += Number(pkg.amount_paid || 0);
        }
      });

      setSdrData(Object.values(map).sort((a, b) => b.appointmentsBooked - a.appointmentsBooked));
    } catch (e) {
      console.error('SDR report error:', e);
    }
    setLoading(false);
  };

  const fetchDoctorReport = async () => {
    setLoading(true);
    try {
      const fromISO = new Date(dateFrom).toISOString();
      const toISO = new Date(dateTo + 'T23:59:59').toISOString();

      // Get doctors
      const { data: doctors } = await supabase
        .from('staff')
        .select('id, full_name')
        .eq('status', 'active')
        .eq('role', 'doctor');

      if (!doctors?.length) { setDoctorData([]); setLoading(false); return; }

      const rows: DoctorRow[] = [];
      for (const doc of doctors) {
        // Consultations done
        const { count: consultations } = await supabase
          .from('patients')
          .select('id', { count: 'exact', head: true })
          .eq('consultation_done_by', doc.id)
          .gte('consultation_date', fromISO)
          .lte('consultation_date', toISO);

        // Patients consulted by this doctor who have packages
        const { data: consultedPatients } = await supabase
          .from('patients')
          .select('id')
          .eq('consultation_done_by', doc.id)
          .gte('consultation_date', fromISO)
          .lte('consultation_date', toISO);

        let converted = 0;
        let totalPackageValue = 0;
        if (consultedPatients?.length) {
          const patientIds = consultedPatients.map(p => p.id);
          const { data: pkgs } = await supabase
            .from('packages')
            .select('patient_id, total_amount')
            .in('patient_id', patientIds);

          const convertedSet = new Set((pkgs || []).map(p => p.patient_id));
          converted = convertedSet.size;
          totalPackageValue = (pkgs || []).reduce((sum, p) => sum + Number(p.total_amount || 0), 0);
        }

        // Treatments administered
        const { count: treatmentsAdministered } = await supabase
          .from('visit_treatments')
          .select('id', { count: 'exact', head: true })
          .eq('doctor_staff_id', doc.id)
          .gte('timestamp', fromISO)
          .lte('timestamp', toISO);

        rows.push({
          name: doc.full_name,
          staffId: doc.id,
          consultations: consultations || 0,
          converted,
          conversionRate: (consultations || 0) > 0 ? Math.round((converted / (consultations || 1)) * 100) : 0,
          totalPackageValue,
          treatmentsAdministered: treatmentsAdministered || 0,
        });
      }

      setDoctorData(rows.sort((a, b) => b.consultations - a.consultations));
    } catch (e) {
      console.error('Doctor report error:', e);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (tab === 'sdr') fetchSdrReport();
    else fetchDoctorReport();
  }, [tab, dateFrom, dateTo]);

  return (
    <PageContainer maxWidth="full">
      <PageHeader title="Staff Performance Reports" subtitle="Track SDR and Doctor performance" />

      <div className="space-y-4">
        <div className="flex items-end gap-4 flex-wrap">
          <div>
            <Label className="text-xs">From</Label>
            <TabletInput type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <TabletInput type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-40" />
          </div>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="sdr">SDR / Reception</TabsTrigger>
            <TabsTrigger value="doctor">Doctor</TabsTrigger>
          </TabsList>

          <TabsContent value="sdr">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : sdrData.length === 0 ? (
              <TabletCard className="p-8 text-center text-muted-foreground">No data for selected period</TabletCard>
            ) : (
              <TabletCard>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff Name</TableHead>
                      <TableHead className="text-right">Appointments Booked</TableHead>
                      <TableHead className="text-right">Patients Registered</TableHead>
                      <TableHead className="text-right">Total Sales (AED)</TableHead>
                      <TableHead className="text-right">Collected (AED)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sdrData.map(row => (
                      <TableRow key={row.name}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right">{row.appointmentsBooked}</TableCell>
                        <TableCell className="text-right">{row.patientsRegistered}</TableCell>
                        <TableCell className="text-right">{row.totalSales.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.amountCollected.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabletCard>
            )}
          </TabsContent>

          <TabsContent value="doctor">
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              </div>
            ) : doctorData.length === 0 ? (
              <TabletCard className="p-8 text-center text-muted-foreground">No data for selected period</TabletCard>
            ) : (
              <TabletCard>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Doctor</TableHead>
                      <TableHead className="text-right">Consultations</TableHead>
                      <TableHead className="text-right">Converted</TableHead>
                      <TableHead className="text-right">Conversion %</TableHead>
                      <TableHead className="text-right">Package Value (AED)</TableHead>
                      <TableHead className="text-right">Treatments Done</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {doctorData.map(row => (
                      <TableRow key={row.staffId}>
                        <TableCell className="font-medium">{row.name}</TableCell>
                        <TableCell className="text-right">{row.consultations}</TableCell>
                        <TableCell className="text-right">{row.converted}</TableCell>
                        <TableCell className="text-right">{row.conversionRate}%</TableCell>
                        <TableCell className="text-right">{row.totalPackageValue.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{row.treatmentsAdministered}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabletCard>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </PageContainer>
  );
}
