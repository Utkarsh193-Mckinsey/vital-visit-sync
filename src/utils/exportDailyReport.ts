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
  const [patientsRes, visitsRes, consumablesRes, packagesRes, paymentsRes, consultationsRes] = await Promise.all([
    // New registered patients in date range
    supabase
      .from('patients')
      .select('*')
      .gte('registration_date', today.toISOString())
      .lt('registration_date', tomorrow.toISOString())
      .order('registration_date', { ascending: false }),

    // Completed visits with treatments and patient info
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
          treatment:treatments (treatment_name, category),
          doctor_staff:staff!visit_treatments_doctor_staff_id_fkey (full_name),
          nurse_staff:staff!visit_treatments_nurse_staff_id_fkey (full_name)
        )
      `)
      .eq('current_status', 'completed')
      .gte('completed_date', today.toISOString())
      .lt('completed_date', tomorrow.toISOString())
      .order('completed_date', { ascending: false }),

    // Consumables used
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

    // Packages purchased in date range
    supabase
      .from('packages')
      .select(`
        *,
        patient:patients (full_name, phone_number),
        treatment:treatments (treatment_name, category)
      `)
      .gte('purchase_date', today.toISOString())
      .lt('purchase_date', tomorrow.toISOString())
      .order('purchase_date', { ascending: false }),

    // All package payments in date range
    supabase
      .from('package_payments')
      .select(`
        *,
        package:packages (
          id,
          patient:patients (full_name),
          treatment:treatments (treatment_name)
        )
      `)
      .gte('payment_date', today.toISOString())
      .lt('payment_date', tomorrow.toISOString()),

    // Consultations in date range
    supabase
      .from('patients')
      .select(`
        id, full_name, phone_number, consultation_status, consultation_date, treatment_interests,
        consultation_doctor:staff!patients_consultation_done_by_fkey (full_name)
      `)
      .not('consultation_status', 'is', null)
      .gte('consultation_date', today.toISOString())
      .lt('consultation_date', tomorrow.toISOString())
      .order('consultation_date', { ascending: false }),
  ]);

  if (patientsRes.error) throw patientsRes.error;
  if (visitsRes.error) throw visitsRes.error;
  if (consumablesRes.error) throw consumablesRes.error;
  if (packagesRes.error) throw packagesRes.error;
  if (paymentsRes.error) throw paymentsRes.error;
  if (consultationsRes.error) throw consultationsRes.error;

  // ===== Sheet 1: New Registered Patients =====
  const patientsData = (patientsRes.data || []).map((p: any) => ({
    'Date': p.registration_date ? format(new Date(p.registration_date), 'dd/MM/yyyy') : '',
    'Full Name': p.full_name,
    'Phone Number': p.phone_number,
    'Email': p.email || '',
    'Date of Birth': p.date_of_birth ? format(new Date(p.date_of_birth), 'dd/MM/yyyy') : '',
    'Emirates ID': p.emirates_id || '',
    'Gender': p.gender || '',
    'Nationality': p.nationality || '',
    'Address': p.address || '',
    'Emergency Contact': p.emergency_contact_name || '',
    'Emergency Phone': p.emergency_contact_number || '',
  }));

  // ===== Sheet 2: Treatment-wise Summary =====
  // Group by treatment name, list patients under each, then total
  const treatmentMap: Record<string, { patients: { date: string; name: string; dose: string; unit: string; doctor: string; nurse: string }[]; totalDoses: Record<string, number> }> = {};

  (visitsRes.data || []).forEach((visit: any) => {
    const patientName = visit.patient?.full_name || 'Unknown';
    const visitDate = visit.completed_date ? format(new Date(visit.completed_date), 'dd/MM/yyyy') : '';
    (visit.visit_treatments || []).forEach((vt: any) => {
      const treatmentName = vt.treatment?.treatment_name || 'Unknown';
      if (!treatmentMap[treatmentName]) {
        treatmentMap[treatmentName] = { patients: [], totalDoses: {} };
      }
      treatmentMap[treatmentName].patients.push({
        date: visitDate,
        name: patientName,
        dose: vt.dose_administered,
        unit: vt.dose_unit,
        doctor: vt.doctor_staff?.full_name || visit.doctor_staff?.full_name || '-',
        nurse: vt.nurse_staff?.full_name || visit.nurse_staff?.full_name || '-',
      });
      // Accumulate totals by unit
      const unit = vt.dose_unit || 'units';
      const doseNum = parseFloat(vt.dose_administered) || 0;
      treatmentMap[treatmentName].totalDoses[unit] = (treatmentMap[treatmentName].totalDoses[unit] || 0) + (doseNum > 0 ? doseNum : 1);
    });
  });

  const treatmentWiseData: any[] = [];
  Object.entries(treatmentMap).forEach(([treatmentName, info]) => {
    treatmentWiseData.push({
      'Date': '',
      'Treatment': `▶ ${treatmentName}`,
      'Patient': '',
      'Dose': '',
      'Unit': '',
      'Doctor': '',
      'Nurse': '',
    });
    info.patients.forEach(p => {
      treatmentWiseData.push({
        'Date': p.date,
        'Treatment': '',
        'Patient': p.name,
        'Dose': p.dose,
        'Unit': p.unit,
        'Doctor': p.doctor,
        'Nurse': p.nurse,
      });
    });
    const totalStr = Object.entries(info.totalDoses).map(([unit, total]) => `${total} ${unit}`).join(', ');
    treatmentWiseData.push({
      'Date': '',
      'Treatment': '',
      'Patient': `TOTAL ${treatmentName}`,
      'Dose': totalStr,
      'Unit': '',
      'Doctor': '',
      'Nurse': '',
    });
    treatmentWiseData.push({ 'Date': '', 'Treatment': '', 'Patient': '', 'Dose': '', 'Unit': '', 'Doctor': '', 'Nurse': '' });
  });

  // ===== Sheet 3: Patient-wise Summary =====
  const patientVisitMap: Record<string, any[]> = {};
  (visitsRes.data || []).forEach((visit: any) => {
    const patientName = visit.patient?.full_name || 'Unknown';
    if (!patientVisitMap[patientName]) patientVisitMap[patientName] = [];
    patientVisitMap[patientName].push(visit);
  });

  const patientWiseData: any[] = [];
  Object.entries(patientVisitMap).forEach(([patientName, visits]) => {
    patientWiseData.push({
      'Date': '',
      'Patient': `▶ ${patientName}`,
      'Visit #': '',
      'Treatment': '',
      'Dose': '',
      'Doctor': '',
      'Nurse': '',
      'BP': '',
      'HR': '',
      'Weight (kg)': '',
      'Doctor Notes': '',
    });

    visits.forEach((visit: any) => {
      const bp = visit.blood_pressure_systolic && visit.blood_pressure_diastolic
        ? `${visit.blood_pressure_systolic}/${visit.blood_pressure_diastolic}` : '-';
      const visitDate = visit.completed_date ? format(new Date(visit.completed_date), 'dd/MM/yyyy') : '';
      
      if (visit.visit_treatments && visit.visit_treatments.length > 0) {
        visit.visit_treatments.forEach((vt: any, idx: number) => {
          patientWiseData.push({
            'Date': idx === 0 ? visitDate : '',
            'Patient': '',
            'Visit #': idx === 0 ? visit.visit_number : '',
            'Treatment': vt.treatment?.treatment_name || '-',
            'Dose': `${vt.dose_administered} ${vt.dose_unit}`,
            'Doctor': vt.doctor_staff?.full_name || visit.doctor_staff?.full_name || '-',
            'Nurse': vt.nurse_staff?.full_name || visit.nurse_staff?.full_name || '-',
            'BP': idx === 0 ? bp : '',
            'HR': idx === 0 ? (visit.heart_rate || '-') : '',
            'Weight (kg)': idx === 0 ? (visit.weight_kg || '-') : '',
            'Doctor Notes': idx === 0 ? (visit.doctor_notes || '') : '',
          });
        });
      } else {
        patientWiseData.push({
          'Date': visitDate,
          'Patient': '',
          'Visit #': visit.visit_number,
          'Treatment': 'No treatments recorded',
          'Dose': '-',
          'Doctor': visit.doctor_staff?.full_name || '-',
          'Nurse': visit.nurse_staff?.full_name || '-',
          'BP': bp,
          'HR': visit.heart_rate || '-',
          'Weight (kg)': visit.weight_kg || '-',
          'Doctor Notes': visit.doctor_notes || '',
        });
      }
    });

    patientWiseData.push({ 'Date': '', 'Patient': '', 'Visit #': '', 'Treatment': '', 'Dose': '', 'Doctor': '', 'Nurse': '', 'BP': '', 'HR': '', 'Weight (kg)': '', 'Doctor Notes': '' });
  });

  // ===== Sheet 4: Daily Sales =====
  // Group packages by patient, show what they bought, payment details
  const packagesByPatient: Record<string, any[]> = {};
  (packagesRes.data || []).forEach((pkg: any) => {
    const name = pkg.patient?.full_name || 'Unknown';
    if (!packagesByPatient[name]) packagesByPatient[name] = [];
    packagesByPatient[name].push(pkg);
  });

  // Build payment lookup: package_id -> payments[]
  const paymentsByPackage: Record<string, any[]> = {};
  (paymentsRes.data || []).forEach((pay: any) => {
    if (!paymentsByPackage[pay.package_id]) paymentsByPackage[pay.package_id] = [];
    paymentsByPackage[pay.package_id].push(pay);
  });

  const salesData: any[] = [];
  let grandTotal = 0;

  Object.entries(packagesByPatient).forEach(([patientName, packages]) => {
    salesData.push({
      'Date': '',
      'Patient': `▶ ${patientName}`,
      'Treatment': '',
      'Sessions': '',
      'Total Amount': '',
      'Amount Paid': '',
      'Payment Method': '',
      'Payment Status': '',
      'Balance': '',
    });

    let patientTotal = 0;
    packages.forEach((pkg: any) => {
      const payments = paymentsByPackage[pkg.id] || [];
      const paymentMethods = payments.length > 0
        ? payments.map((p: any) => `${p.payment_method}: ${p.amount}`).join(', ')
        : (pkg.amount_paid > 0 ? 'Recorded' : '-');
      
      const totalAmt = pkg.total_amount || 0;
      const paidAmt = pkg.amount_paid || 0;
      const balance = totalAmt - paidAmt;
      patientTotal += paidAmt;
      const pkgDate = pkg.purchase_date ? format(new Date(pkg.purchase_date), 'dd/MM/yyyy') : '';

      salesData.push({
        'Date': pkgDate,
        'Patient': '',
        'Treatment': pkg.treatment?.treatment_name || '-',
        'Sessions': pkg.sessions_purchased,
        'Total Amount': totalAmt,
        'Amount Paid': paidAmt,
        'Payment Method': paymentMethods,
        'Payment Status': pkg.payment_status,
        'Balance': balance > 0 ? balance : 0,
      });
    });

    grandTotal += patientTotal;
  });

  // Grand total row
  if (salesData.length > 0) {
    salesData.push({ 'Date': '', 'Patient': '', 'Treatment': '', 'Sessions': '', 'Total Amount': '', 'Amount Paid': '', 'Payment Method': '', 'Payment Status': '', 'Balance': '' });
    salesData.push({
      'Date': '',
      'Patient': 'TOTAL SALES',
      'Treatment': '',
      'Sessions': '',
      'Total Amount': (packagesRes.data || []).reduce((sum: number, p: any) => sum + (p.total_amount || 0), 0),
      'Amount Paid': grandTotal,
      'Payment Method': '',
      'Payment Status': '',
      'Balance': '',
    });
  }

  // ===== Sheet 5: Consultations =====
  // For each consulted patient, check if they have any packages (converted)
  const consultedPatientIds = (consultationsRes.data || []).map((c: any) => c.id);
  let packagesByPatientId: Record<string, any[]> = {};
  if (consultedPatientIds.length > 0) {
    const { data: pkgsForConsulted } = await supabase
      .from('packages')
      .select('patient_id, total_amount, treatment:treatments(treatment_name)')
      .in('patient_id', consultedPatientIds);
    (pkgsForConsulted || []).forEach((pkg: any) => {
      if (!packagesByPatientId[pkg.patient_id]) packagesByPatientId[pkg.patient_id] = [];
      packagesByPatientId[pkg.patient_id].push(pkg);
    });
  }

  const consultationsData = (consultationsRes.data || []).map((c: any) => {
    const pkgs = packagesByPatientId[c.id] || [];
    const isConverted = pkgs.length > 0;
    const totalAmount = pkgs.reduce((sum: number, p: any) => sum + (p.total_amount || 0), 0);
    const treatments = pkgs.map((p: any) => p.treatment?.treatment_name).filter(Boolean).join(', ');

    return {
      'Date': c.consultation_date ? format(new Date(c.consultation_date), 'dd/MM/yyyy') : '',
      'Patient': c.full_name,
      'Phone': c.phone_number,
      'Consultation By': (c as any).consultation_doctor?.full_name || '-',
      'Treatment Interest': (c.treatment_interests || []).join(', '),
      'Status': isConverted ? 'Converted' : 'Consultation Only',
      'Package Taken': isConverted ? treatments : '-',
      'Amount': isConverted ? totalAmount : '-',
    };
  });

  // Create workbook
  const wb = XLSX.utils.book_new();

  const ws1 = XLSX.utils.json_to_sheet(patientsData.length > 0 ? patientsData : [{ 'Info': 'No new patients registered' }]);
  XLSX.utils.book_append_sheet(wb, ws1, 'New Patients');

  const ws2 = XLSX.utils.json_to_sheet(treatmentWiseData.length > 0 ? treatmentWiseData : [{ 'Info': 'No treatments performed' }]);
  XLSX.utils.book_append_sheet(wb, ws2, 'Treatment-wise');

  const ws3 = XLSX.utils.json_to_sheet(patientWiseData.length > 0 ? patientWiseData : [{ 'Info': 'No completed visits' }]);
  XLSX.utils.book_append_sheet(wb, ws3, 'Patient-wise');

  const ws4 = XLSX.utils.json_to_sheet(salesData.length > 0 ? salesData : [{ 'Info': 'No packages sold' }]);
  XLSX.utils.book_append_sheet(wb, ws4, 'Daily Sales');

  const ws5 = XLSX.utils.json_to_sheet(consultationsData.length > 0 ? consultationsData : [{ 'Info': 'No consultations recorded' }]);
  XLSX.utils.book_append_sheet(wb, ws5, 'Consultations');

  // Auto-width columns for each sheet
  [ws1, ws2, ws3, ws4, ws5].forEach(ws => {
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
