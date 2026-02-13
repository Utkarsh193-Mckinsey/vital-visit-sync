import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function getUAEDateRange(reportType: string) {
  const uaeOffset = 4 * 60 * 60 * 1000;
  const now = new Date();
  const uaeNow = new Date(now.getTime() + uaeOffset);
  const uaeToday = new Date(uaeNow);
  uaeToday.setUTCHours(0, 0, 0, 0);

  let startUAE: Date;
  let endUAE: Date;
  let label: string;

  if (reportType === "weekly") {
    // Last 7 days (Sunday to Saturday)
    endUAE = new Date(uaeToday);
    endUAE.setUTCDate(endUAE.getUTCDate() + 1); // end of today
    startUAE = new Date(uaeToday);
    startUAE.setUTCDate(startUAE.getUTCDate() - 6); // 7 days back
    label = `${startUAE.toISOString().split("T")[0]}_to_${uaeToday.toISOString().split("T")[0]}`;
  } else if (reportType === "monthly") {
    // Full current month (1st to last day)
    startUAE = new Date(Date.UTC(uaeToday.getUTCFullYear(), uaeToday.getUTCMonth(), 1));
    endUAE = new Date(Date.UTC(uaeToday.getUTCFullYear(), uaeToday.getUTCMonth() + 1, 1));
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    label = `${monthNames[uaeToday.getUTCMonth()]}_${uaeToday.getUTCFullYear()}`;
  } else {
    // Daily (default)
    startUAE = new Date(uaeToday);
    endUAE = new Date(uaeToday);
    endUAE.setUTCDate(endUAE.getUTCDate() + 1);
    label = uaeToday.toISOString().split("T")[0];
  }

  // Convert UAE midnight boundaries back to UTC for DB queries
  const startUTC = new Date(startUAE.getTime() - uaeOffset);
  const endUTC = new Date(endUAE.getTime() - uaeOffset);

  return { startUTC, endUTC, label };
}

function getReportTitle(reportType: string): string {
  if (reportType === "weekly") return "Weekly Report";
  if (reportType === "monthly") return "Monthly Report";
  return "Daily Report";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

    // Parse report type from request body
    let reportType = "daily";
    try {
      const body = await req.json();
      if (body?.report_type) reportType = body.report_type;
    } catch {
      // default to daily
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { startUTC, endUTC, label } = getUAEDateRange(reportType);
    const title = getReportTitle(reportType);

    // Fetch data in parallel
    const [patientsRes, visitsRes, consumablesRes] = await Promise.all([
      supabase
        .from("patients")
        .select("full_name, phone_number, email, date_of_birth, emirates_id, address, status, registration_date")
        .order("registration_date", { ascending: false }),

      supabase
        .from("visits")
        .select(`
          *,
          patient:patients (full_name, phone_number, email),
          nurse_staff:staff!visits_nurse_staff_id_fkey (full_name),
          doctor_staff:staff!visits_doctor_staff_id_fkey (full_name),
          visit_treatments (
            dose_administered,
            dose_unit,
            timestamp,
            treatment:treatments (treatment_name, category)
          )
        `)
        .eq("current_status", "completed")
        .gte("completed_date", startUTC.toISOString())
        .lt("completed_date", endUTC.toISOString())
        .order("completed_date", { ascending: false }),

      supabase
        .from("visit_consumables")
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
        .gte("created_date", startUTC.toISOString())
        .lt("created_date", endUTC.toISOString()),
    ]);

    if (patientsRes.error) throw patientsRes.error;
    if (visitsRes.error) throw visitsRes.error;
    if (consumablesRes.error) throw consumablesRes.error;

    const patients = patientsRes.data || [];
    const visits = visitsRes.data || [];
    const consumables = consumablesRes.data || [];

    // --- Build Excel workbook ---
    const wb = XLSX.utils.book_new();

    // Sheet 1: Registered Patients
    const patientsData = patients.map((p: any) => ({
      "Full Name": p.full_name,
      "Phone Number": p.phone_number,
      "Email": p.email,
      "Date of Birth": p.date_of_birth || "",
      "Emirates ID": p.emirates_id || "",
      "Address": p.address || "",
      "Status": p.status,
      "Registration Date": p.registration_date || "",
    }));
    const ws1 = XLSX.utils.json_to_sheet(patientsData.length > 0 ? patientsData : [{ "No Data": "No patients registered" }]);
    XLSX.utils.book_append_sheet(wb, ws1, "Registered Patients");

    // Sheet 2: Treatments Completed
    const treatmentsData: any[] = [];
    for (const visit of visits) {
      const patientName = (visit as any).patient?.full_name || "Unknown";
      const doctor = (visit as any).doctor_staff?.full_name || "-";
      const nurse = (visit as any).nurse_staff?.full_name || "-";
      const vts = (visit as any).visit_treatments || [];
      if (vts.length > 0) {
        for (const vt of vts) {
          treatmentsData.push({
            "Patient Name": patientName,
            "Treatment": vt.treatment?.treatment_name || "-",
            "Category": vt.treatment?.category || "-",
            "Dose": `${vt.dose_administered} ${vt.dose_unit}`,
            "Doctor": doctor,
            "Nurse": nurse,
            "Time": vt.timestamp || "-",
            "Doctor Notes": (visit as any).doctor_notes || "",
            "Vitals - BP": (visit as any).blood_pressure_systolic && (visit as any).blood_pressure_diastolic
              ? `${(visit as any).blood_pressure_systolic}/${(visit as any).blood_pressure_diastolic}` : "-",
            "Vitals - HR": (visit as any).heart_rate || "-",
            "Vitals - Weight (kg)": (visit as any).weight_kg || "-",
          });
        }
      } else {
        treatmentsData.push({
          "Patient Name": patientName,
          "Treatment": "No treatments recorded",
          "Category": "-", "Dose": "-",
          "Doctor": doctor, "Nurse": nurse, "Time": "-",
          "Doctor Notes": (visit as any).doctor_notes || "",
          "Vitals - BP": "-", "Vitals - HR": "-", "Vitals - Weight (kg)": "-",
        });
      }
    }
    const ws2 = XLSX.utils.json_to_sheet(treatmentsData.length > 0 ? treatmentsData : [{ "No Data": "No treatments in this period" }]);
    XLSX.utils.book_append_sheet(wb, ws2, "Treatments");

    // Sheet 3: Consumables Used
    const consumablesData = consumables.map((c: any) => ({
      "Item Name": c.stock_item?.item_name || "-",
      "Brand": c.stock_item?.brand || "-",
      "Variant": c.stock_item?.variant || "-",
      "Category": c.stock_item?.category || "-",
      "Quantity Used": c.quantity_used,
      "Unit": c.stock_item?.unit || "-",
      "Patient": c.visit?.patient?.full_name || "-",
      "Notes": c.notes || "",
      "Time": c.created_date || "-",
    }));
    const ws3 = XLSX.utils.json_to_sheet(consumablesData.length > 0 ? consumablesData : [{ "No Data": "No consumables used in this period" }]);
    XLSX.utils.book_append_sheet(wb, ws3, "Consumables Used");

    // Auto-width columns
    [ws1, ws2, ws3].forEach((ws) => {
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
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
      ws["!cols"] = colWidths.map((w) => ({ wch: w }));
    });

    // Write workbook to base64
    const xlsxBuffer = XLSX.write(wb, { type: "base64", bookType: "xlsx" });

    const completedCount = visits.length;
    const consumablesCount = consumables.length;

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
        <h2 style="color:#1a1a1a;">Cosmique Clinic — ${title}</h2>
        <p style="color:#666;">Period: ${label.replace(/_/g, " ")}</p>
        <hr/>
        <h3>📋 Summary</h3>
        <ul>
          <li><strong>${completedCount}</strong> visits completed</li>
          <li><strong>${consumablesCount}</strong> consumable records</li>
          <li><strong>${patients.length}</strong> total registered patients</li>
        </ul>
        <p>📎 The full Excel report is attached to this email.</p>
        <hr/>
        <p style="color:#999;font-size:12px;">This is an automated ${reportType} report from Cosmique Clinic Management System.</p>
      </div>
    `;

    const fileName = `Clinic_${title.replace(" ", "_")}_${label}.xlsx`;

    // Send email with Excel attachment via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Cosmique Clinic <onboarding@resend.dev>",
        to: ["info@cosmiquedxb.com"],
        subject: `Cosmique Clinic ${title} — ${label.replace(/_/g, " ")}`,
        html: emailHtml,
        attachments: [
          {
            content: xlsxBuffer,
            filename: fileName,
          },
        ],
      }),
    });

    const resendData = await resendRes.json();

    if (!resendRes.ok) {
      console.error("Resend error:", resendData);
      return new Response(JSON.stringify({ error: resendData }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id, reportType, period: label }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
