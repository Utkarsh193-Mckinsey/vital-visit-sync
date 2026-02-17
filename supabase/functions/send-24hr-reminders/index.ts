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

  if (!WATI_API_URL || !WATI_API_KEY) {
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

    for (const appt of (appointments || [])) {
      try {
        let watiPhone = appt.phone.replace(/[\s\-\(\)\+]/g, "");
        if (watiPhone.startsWith("0")) watiPhone = "971" + watiPhone.slice(1);
        if (!watiPhone.startsWith("971") && watiPhone.length <= 10) watiPhone = "971" + watiPhone;

        const message = `Hi ${appt.patient_name}, just a reminder for tomorrow's appointment at Cosmique Aesthetics for ${appt.service}.\n\nPlease confirm the appointment by saying *Yes* or if any questions let us know.\n\nOur location is:\nCosmique Aesthetics, Beach Park Plaza, Shop Number 20\nhttps://share.google/7o9aW3sPGhbk3lG6j\n\nFor any query please contact\n+971504296888\n\nFree parking available`;

        const watiRes = await fetch(
          `${WATI_API_URL}/api/v1/sendSessionMessage/${watiPhone}?messageText=${encodeURIComponent(message)}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${WATI_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );

        const watiText = await watiRes.text();
        console.log(`24hr reminder to ${watiPhone}:`, watiRes.status, watiText);

        // Log outbound message
        await supabase.from("whatsapp_messages").insert({
          phone: watiPhone,
          patient_name: appt.patient_name,
          direction: "outbound",
          message_text: message,
          appointment_id: appt.id,
        });

        // Mark as sent
        await supabase
          .from("appointments")
          .update({ reminder_24hr_sent: true, reminder_24hr_sent_at: new Date().toISOString() })
          .eq("id", appt.id);

        results.push({ id: appt.id, success: true });
      } catch (err: any) {
        console.error(`Failed 24hr reminder for ${appt.id}:`, err);
        results.push({ id: appt.id, success: false, error: err.message });
      }
    }

    console.log(`Processed ${results.length} 24hr reminders`);

    return new Response(
      JSON.stringify({ processed: results.length, results }),
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
