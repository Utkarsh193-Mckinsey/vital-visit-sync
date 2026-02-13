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
  const TEMPLATE_NAME = Deno.env.get("WATI_TEMPLATE_REMINDER_2HR");

  if (!WATI_API_URL || !WATI_API_KEY || !TEMPLATE_NAME) {
    return new Response(
      JSON.stringify({ error: "WATI environment variables not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // Get today's appointments that are unconfirmed and haven't received 2hr reminder
    const { data: appointments, error: fetchErr } = await supabase
      .from("appointments")
      .select("*")
      .eq("appointment_date", todayStr)
      .eq("reminder_2hr_sent", false)
      .in("confirmation_status", ["unconfirmed", "message_sent", "called_no_answer"])
      .neq("status", "cancelled");

    if (fetchErr) throw fetchErr;

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const apt of appointments || []) {
      try {
        // Parse appointment time and check if within 2-2.5 hour window
        const [hours, minutes] = apt.appointment_time.split(":").map(Number);
        const aptTime = new Date(now);
        aptTime.setHours(hours, minutes, 0, 0);

        const diffMs = aptTime.getTime() - now.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        // Only send if appointment is 1.5-2.5 hours away
        if (diffHours < 1.5 || diffHours > 2.5) continue;

        const phone = apt.phone.replace(/^\+/, "");

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
              broadcast_name: `reminder_2hr_${apt.id}`,
              parameters: [
                { name: "patient_name", value: apt.patient_name },
                { name: "appointment_time", value: apt.appointment_time },
                { name: "service", value: apt.service },
              ],
            }),
          }
        );

        const watiData = await watiRes.json();

        await supabase.from("appointment_communications").insert({
          appointment_id: apt.id,
          channel: "whatsapp",
          direction: "outbound",
          message_sent: `2hr reminder sent via template ${TEMPLATE_NAME} for ${apt.appointment_time}`,
          raw_response: watiData,
        });

        await supabase
          .from("appointments")
          .update({
            reminder_2hr_sent: true,
            reminder_2hr_sent_at: new Date().toISOString(),
          })
          .eq("id", apt.id);

        results.push({ id: apt.id, success: true });
      } catch (e) {
        results.push({ id: apt.id, success: false, error: String(e) });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-2hr-reminders:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
