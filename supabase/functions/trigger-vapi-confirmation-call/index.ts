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
  const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
  const VAPI_PHONE_NUMBER_ID = Deno.env.get("VAPI_PHONE_NUMBER_ID");
  const VAPI_ASSISTANT_ID = Deno.env.get("VAPI_ASSISTANT_ID");

  if (!VAPI_API_KEY || !VAPI_PHONE_NUMBER_ID || !VAPI_ASSISTANT_ID) {
    return new Response(
      JSON.stringify({ error: "VAPI environment variables not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Find appointments where:
    // - 24hr reminder sent > 2 hours ago
    // - confirmation_status is still 'message_sent'
    // - No VAPI call logged yet
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { data: appointments, error: fetchErr } = await supabase
      .from("appointments")
      .select("*")
      .eq("reminder_24hr_sent", true)
      .lt("reminder_24hr_sent_at", twoHoursAgo)
      .eq("confirmation_status", "message_sent")
      .neq("status", "cancelled");

    if (fetchErr) throw fetchErr;

    const results: { id: string; success: boolean; callId?: string; error?: string }[] = [];

    for (const apt of appointments || []) {
      try {
        // Check if a VAPI call already exists for this appointment
        const { data: existingCalls } = await supabase
          .from("appointment_communications")
          .select("id")
          .eq("appointment_id", apt.id)
          .eq("channel", "vapi_call")
          .limit(1);

        if (existingCalls && existingCalls.length > 0) continue;

        // Determine if appointment is today or tomorrow
        const today = new Date().toISOString().split("T")[0];
        const dayLabel = apt.appointment_date === today ? "today" : "tomorrow";

        // Ensure phone has country code
        let phone = apt.phone.trim();
        if (!phone.startsWith("+")) phone = `+${phone}`;

        // Call VAPI
        const vapiRes = await fetch("https://api.vapi.ai/call/phone", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${VAPI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            assistantId: VAPI_ASSISTANT_ID,
            phoneNumberId: VAPI_PHONE_NUMBER_ID,
            customer: { number: phone },
            assistantOverrides: {
              firstMessage: `Hello ${apt.patient_name}, this is calling from Cosmique Aesthetic and Dermatology Clinic in Dubai. You have an appointment ${dayLabel} at ${apt.appointment_time} for ${apt.service}. We sent you a WhatsApp message but didn't hear back. Can you confirm if you will be coming?`,
              context: `Patient: ${apt.patient_name}, Appointment: ${apt.appointment_date} at ${apt.appointment_time}, Service: ${apt.service}. If they confirm, say great and end call. If they want to reschedule, ask for preferred date and time. If they cancel, acknowledge politely. If they speak Arabic or Hindi, switch to that language.`,
            },
          }),
        });

        const vapiData = await vapiRes.json();

        // Log communication
        await supabase.from("appointment_communications").insert({
          appointment_id: apt.id,
          channel: "vapi_call",
          direction: "outbound",
          message_sent: `Confirmation call initiated for ${apt.appointment_date} at ${apt.appointment_time}`,
          call_status: "initiated",
          raw_response: vapiData,
        });

        results.push({ id: apt.id, success: true, callId: vapiData.id });
      } catch (e) {
        results.push({ id: apt.id, success: false, error: String(e) });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in trigger-vapi-confirmation-call:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
