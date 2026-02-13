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

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const WATI_API_URL = Deno.env.get("WATI_API_URL");
  const WATI_API_KEY = Deno.env.get("WATI_API_KEY");
  const TEMPLATE_NAME = Deno.env.get("WATI_TEMPLATE_CONFIRMATION_24HR");

  if (!WATI_API_URL || !WATI_API_KEY || !TEMPLATE_NAME) {
    return new Response(
      JSON.stringify({ error: "WATI environment variables not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Get tomorrow's date in YYYY-MM-DD
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    // Find appointments for tomorrow that haven't received 24hr reminder
    const { data: appointments, error: fetchErr } = await supabase
      .from("appointments")
      .select("*")
      .eq("appointment_date", tomorrowStr)
      .eq("reminder_24hr_sent", false)
      .neq("status", "cancelled");

    if (fetchErr) throw fetchErr;

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const apt of appointments || []) {
      try {
        // Format phone - remove leading + if present for WATI
        const phone = apt.phone.replace(/^\+/, "");

        // Send WATI template message
        const watiRes = await fetch(
          `${WATI_API_URL}/sendTemplateMessage?whatsappNumber=${phone}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${WATI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              template_name: TEMPLATE_NAME,
              broadcast_name: `reminder_24hr_${apt.id}`,
              parameters: [
                { name: "patient_name", value: apt.patient_name },
                { name: "appointment_date", value: apt.appointment_date },
                { name: "appointment_time", value: apt.appointment_time },
                { name: "service", value: apt.service },
              ],
            }),
          }
        );

        const watiData = await watiRes.json();

        // Log communication
        await supabase.from("appointment_communications").insert({
          appointment_id: apt.id,
          channel: "whatsapp",
          direction: "outbound",
          message_sent: `24hr reminder sent via template ${TEMPLATE_NAME} for ${apt.appointment_date} at ${apt.appointment_time}`,
          raw_response: watiData,
        });

        // Update appointment
        await supabase
          .from("appointments")
          .update({
            reminder_24hr_sent: true,
            reminder_24hr_sent_at: new Date().toISOString(),
            confirmation_status:
              apt.confirmation_status === "unconfirmed"
                ? "message_sent"
                : apt.confirmation_status,
          })
          .eq("id", apt.id);

        results.push({ id: apt.id, success: true });
      } catch (e) {
        results.push({ id: apt.id, success: false, error: String(e) });
      }
    }

    return new Response(
      JSON.stringify({
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-24hr-reminders:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
