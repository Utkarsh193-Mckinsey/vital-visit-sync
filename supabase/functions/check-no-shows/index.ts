import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const WATI_API_URL = Deno.env.get("WATI_API_URL");
  const WATI_API_KEY = Deno.env.get("WATI_API_KEY");
  const WATI_TEMPLATE_NOSHOW = Deno.env.get("WATI_TEMPLATE_NOSHOW");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const cutoffTime = `${String(twoHoursAgo.getHours()).padStart(2, "0")}:${String(twoHoursAgo.getMinutes()).padStart(2, "0")}`;

    // Find today's appointments that are still 'upcoming' and time has passed by 2+ hours
    const { data: appointments, error: fetchErr } = await supabase
      .from("appointments")
      .select("*")
      .eq("appointment_date", todayStr)
      .eq("status", "upcoming")
      .lt("appointment_time", cutoffTime);

    if (fetchErr) throw fetchErr;

    const results: { id: string; success: boolean; error?: string }[] = [];

    for (const apt of appointments || []) {
      try {
        // Update appointment to no_show
        await supabase
          .from("appointments")
          .update({
            status: "no_show",
            followup_status: "active",
            followup_step: 0,
          })
          .eq("id", apt.id);

        // Increment no_show_count
        await supabase
          .from("appointments")
          .update({ no_show_count: (apt.no_show_count || 0) + 1 })
          .eq("id", apt.id);

        // Send WATI no-show message
        if (WATI_API_URL && WATI_API_KEY) {
          const phone = apt.phone.replace(/^\+/, "");

          if (WATI_TEMPLATE_NOSHOW) {
            await fetch(`${WATI_API_URL}/sendTemplateMessage?whatsappNumber=${phone}`, {
              method: "POST",
              headers: { Authorization: `Bearer ${WATI_API_KEY}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                template_name: WATI_TEMPLATE_NOSHOW,
                broadcast_name: `noshow_${apt.id}`,
                parameters: [
                  { name: "patient_name", value: apt.patient_name },
                  { name: "appointment_time", value: apt.appointment_time },
                  { name: "service", value: apt.service },
                ],
              }),
            });
          } else {
            const msg = `Hi ${apt.patient_name}, we noticed you missed your appointment today at ${apt.appointment_time} for ${apt.service} at Cosmique Clinic. We hope everything is okay! Would you like to reschedule? Reply YES to book a new appointment, or let us know how we can help.`;
            await fetch(`${WATI_API_URL}/sendSessionMessage/${phone}?messageText=${encodeURIComponent(msg)}`, {
              method: "POST",
              headers: { Authorization: `Bearer ${WATI_API_KEY}`, "Content-Type": "application/json" },
            });
          }

          await supabase.from("appointment_communications").insert({
            appointment_id: apt.id,
            channel: "whatsapp",
            direction: "outbound",
            message_sent: `No-show message sent for missed appointment at ${apt.appointment_time}`,
          });
        }

        results.push({ id: apt.id, success: true });
      } catch (e) {
        results.push({ id: apt.id, success: false, error: String(e) });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in check-no-shows:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
