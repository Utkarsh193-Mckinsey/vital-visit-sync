import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export async function exportDailyReport(fromDate?: Date, toDate?: Date) {
  const today = fromDate || new Date();
  if (!fromDate) today.setHours(0, 0, 0, 0);
  const tomorrow = toDate ? new Date(toDate.getTime() + 1) : new Date(today);
  if (!toDate) tomorrow.setDate(tomorrow.getDate() + 1);
  else tomorrow.setHours(0, 0, 0, 0);

  const todayStr = fromDate && toDate
    ? `${format(fromDate, 'yyyy-MM-dd')}_to_${format(toDate, 'yyyy-MM-dd')}`
    : format(today, 'yyyy-MM-dd');

  // Fetch all data in parallel
  const [patientsRes, visitsRes, consumablesRes] = await Promise.all([
    // All registered patients
    supabase
      .from('patients')
      .select('*')
      .order('registration_date', { ascending: false }),

    // Today's completed visits with treatments and patient info
    supabase
      .from('visits')
      .select(`
        *,
        patient:patients (full_name, phone_number, email, emirates_id, date_of_birth),
        nurse_staff:staff!visits_nurse_staff_id_fkey (full_name),
        doctor_staff:staff!visits_doctor_staff_id_fkey (full_name),
        visit_treatments (
          dose_administered,
          dose_unit,
          timestamp,
          treatment:treatments (treatment_name, category)
        )
      `)
      .eq('current_status', 'completed')
      .gte('completed_date', today.toISOString())
      .lt('completed_date', tomorrow.toISOString())
      .order('completed_date', { ascending: false }),

    // Today's consumables used
    supabase
      .from('visit_consumables')
      .select(`
        quantity_used,
        notes,
        created_date,
        stock_item:stock_items (item_name, brand, variant, unit, category),
        visit:visits!inner (
          id,
          completed_date,
          patient:patients (full_name)
        )
      `)
      .gte('created_date', today.toISOString())
      .lt('created_date', tomorrow.toISOString()),
  ]);

  if (patientsRes.error) throw patientsRes.error;
  if (visitsRes.error) throw visitsRes.error;
  if (consumablesRes.error) throw consumablesRes.error;

  // Sheet 1: Registered Patients
  const patientsData = (patientsRes.data || []).map((p: any) => ({
    'Full Name': p.full_name,
    'Phone Number': p.phone_number,
    'Email': p.email,
    'Date of Birth': p.date_of_birth ? format(new Date(p.date_of_birth), 'dd/MM/yyyy') : '',
    'Emirates ID': p.emirates_id || '',
    'Address': p.address || '',
    'Status': p.status,
    'Registration Date': p.registration_date ? format(new Date(p.registration_date), 'dd/MM/yyyy HH:mm') : '',
  }));

  // Sheet 2: Treatments Done Today
  const treatmentsData: any[] = [];
  (visitsRes.data || []).forEach((visit: any) => {
    const patientName = visit.patient?.full_name || 'Unknown';
    const doctorName = visit.doctor_staff?.full_name || '-';
    const nurseName = visit.nurse_staff?.full_name || '-';

    if (visit.visit_treatments && visit.visit_treatments.length > 0) {
      visit.visit_treatments.forEach((vt: any) => {
        treatmentsData.push({
          'Patient Name': patientName,
          'Treatment': vt.treatment?.treatment_name || '-',
          'Category': vt.treatment?.category || '-',
          'Dose': `${vt.dose_administered} ${vt.dose_unit}`,
          'Doctor': doctorName,
          'Nurse': nurseName,
          'Time': vt.timestamp ? format(new Date(vt.timestamp), 'HH:mm') : '-',
          'Doctor Notes': visit.doctor_notes || '',
          'Vitals - BP': visit.blood_pressure_systolic && visit.blood_pressure_diastolic
            ? `${visit.blood_pressure_systolic}/${visit.blood_pressure_diastolic}`
            : '-',
          'Vitals - HR': visit.heart_rate || '-',
          'Vitals - Weight (kg)': visit.weight_kg || '-',
        });
      });
    } else {
      treatmentsData.push({
        'Patient Name': patientName,
        'Treatment': 'No treatments recorded',
        'Category': '-',
        'Dose': '-',
        'Doctor': doctorName,
        'Nurse': nurseName,
        'Time': visit.completed_date ? format(new Date(visit.completed_date), 'HH:mm') : '-',
        'Doctor Notes': visit.doctor_notes || '',
        'Vitals - BP': '-',
        'Vitals - HR': '-',
        'Vitals - Weight (kg)': '-',
      });
    }
  });

  // Sheet 3: Consumables Used Today
  const consumablesData = (consumablesRes.data || []).map((c: any) => ({
    'Item Name': c.stock_item?.item_name || '-',
    'Brand': c.stock_item?.brand || '-',
    'Variant': c.stock_item?.variant || '-',
    'Category': c.stock_item?.category || '-',
    'Quantity Used': c.quantity_used,
    'Unit': c.stock_item?.unit || '-',
    'Patient': c.visit?.patient?.full_name || '-',
    'Notes': c.notes || '',
    'Time': c.created_date ? format(new Date(c.created_date), 'HH:mm') : '-',
  }));

  // Create workbook
  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.json_to_sheet(patientsData.length > 0 ? patientsData : [{ 'No Data': 'No patients registered' }]);
  XLSX.utils.book_append_sheet(wb, ws1, 'Registered Patients');

  const ws2 = XLSX.utils.json_to_sheet(treatmentsData.length > 0 ? treatmentsData : [{ 'No Data': 'No treatments completed today' }]);
  XLSX.utils.book_append_sheet(wb, ws2, 'Treatments Today');

  const ws3 = XLSX.utils.json_to_sheet(consumablesData.length > 0 ? consumablesData : [{ 'No Data': 'No consumables used today' }]);
  XLSX.utils.book_append_sheet(wb, ws3, 'Consumables Used');

  // Auto-width columns for each sheet
  [ws1, ws2, ws3].forEach(ws => {
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    const colWidths: number[] = [];
    for (let C = range.s.c; C <= range.e.c; C++) {
      let maxLen = 10;
      for (let R = range.s.r; R <= range.e.r; R++) {
        const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
        if (cell && cell.v) {
          const len = String(cell.v).length;
          if (len > maxLen) maxLen = len;
        }
      }
      colWidths.push(Math.min(maxLen + 2, 40));
    }
    ws['!cols'] = colWidths.map(w => ({ wch: w }));
  });

  // Download
  const fileName = `Clinic_Daily_Report_${todayStr}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
