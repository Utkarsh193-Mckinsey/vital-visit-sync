import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get today's date range (UAE timezone UTC+4)
    const now = new Date();
    // Adjust to UAE time
    const uaeOffset = 4 * 60 * 60 * 1000;
    const uaeNow = new Date(now.getTime() + uaeOffset);
    const uaeToday = new Date(uaeNow);
    uaeToday.setUTCHours(0, 0, 0, 0);
    // Convert back to UTC for querying
    const startUTC = new Date(uaeToday.getTime() - uaeOffset);
    const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);

    const dateLabel = uaeToday.toISOString().split("T")[0];

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

    // Build HTML email
    const completedCount = visits.length;
    const consumablesCount = consumables.length;

    // Build treatments summary
    let treatmentsHtml = "";
    if (visits.length > 0) {
      treatmentsHtml = `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px;">
        <tr style="background:#f3f4f6;"><th>Patient</th><th>Treatment</th><th>Dose</th><th>Doctor</th><th>Nurse</th></tr>`;
      for (const visit of visits) {
        const patientName = (visit as any).patient?.full_name || "Unknown";
        const doctor = (visit as any).doctor_staff?.full_name || "-";
        const nurse = (visit as any).nurse_staff?.full_name || "-";
        const vts = (visit as any).visit_treatments || [];
        if (vts.length > 0) {
          for (const vt of vts) {
            treatmentsHtml += `<tr>
              <td>${patientName}</td>
              <td>${vt.treatment?.treatment_name || "-"}</td>
              <td>${vt.dose_administered} ${vt.dose_unit}</td>
              <td>${doctor}</td>
              <td>${nurse}</td>
            </tr>`;
          }
        } else {
          treatmentsHtml += `<tr>
            <td>${patientName}</td>
            <td colspan="4">No treatments recorded</td>
          </tr>`;
        }
      }
      treatmentsHtml += "</table>";
    } else {
      treatmentsHtml = "<p>No completed treatments today.</p>";
    }

    // Build consumables summary
    let consumablesHtml = "";
    if (consumables.length > 0) {
      consumablesHtml = `<table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:13px;">
        <tr style="background:#f3f4f6;"><th>Item</th><th>Brand</th><th>Qty Used</th><th>Unit</th><th>Patient</th></tr>`;
      for (const c of consumables) {
        const si = (c as any).stock_item;
        consumablesHtml += `<tr>
          <td>${si?.item_name || "-"}</td>
          <td>${si?.brand || "-"}</td>
          <td>${c.quantity_used}</td>
          <td>${si?.unit || "-"}</td>
          <td>${(c as any).visit?.patient?.full_name || "-"}</td>
        </tr>`;
      }
      consumablesHtml += "</table>";
    } else {
      consumablesHtml = "<p>No consumables used today.</p>";
    }

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:700px;margin:0 auto;">
        <h2 style="color:#1a1a1a;">Cosmique Clinic — Daily Report</h2>
        <p style="color:#666;">Date: ${dateLabel}</p>
        <hr/>
        <h3>📋 Summary</h3>
        <ul>
          <li><strong>${completedCount}</strong> visits completed</li>
          <li><strong>${consumablesCount}</strong> consumable records</li>
          <li><strong>${patients.length}</strong> total registered patients</li>
        </ul>
        <h3>💉 Treatments Completed</h3>
        ${treatmentsHtml}
        <br/>
        <h3>📦 Consumables Used</h3>
        ${consumablesHtml}
        <hr/>
        <p style="color:#999;font-size:12px;">This is an automated report from Cosmique Clinic Management System.</p>
      </div>
    `;

    // Send email via Resend
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "Cosmique Clinic <onboarding@resend.dev>",
        to: ["info@cosmiquedxb.com"],
        subject: `Daily Clinic Report — ${dateLabel}`,
        html: emailHtml,
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
      JSON.stringify({ success: true, emailId: resendData.id, date: dateLabel }),
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
