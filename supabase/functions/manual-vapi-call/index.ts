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
    const { appointment_id } = await req.json();

    if (!appointment_id) {
      return new Response(
        JSON.stringify({ error: "appointment_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch appointment
    const { data: apt, error: aptErr } = await supabase
      .from("appointments")
      .select("*")
      .eq("id", appointment_id)
      .single();

    if (aptErr || !apt) {
      return new Response(
        JSON.stringify({ error: "Appointment not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const today = new Date().toISOString().split("T")[0];
    const dayLabel = apt.appointment_date === today ? "today" : "tomorrow";

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
          firstMessage: `Hello ${apt.patient_name}, this is calling from Cosmique Aesthetic and Dermatology Clinic in Dubai. You have an appointment ${dayLabel} at ${apt.appointment_time} for ${apt.service}. Can you confirm if you will be coming?`,
          context: `Patient: ${apt.patient_name}, Appointment: ${apt.appointment_date} at ${apt.appointment_time}, Service: ${apt.service}. If they confirm, say great and end call. If they want to reschedule, ask for preferred date and time. If they cancel, acknowledge politely. If they speak Arabic or Hindi, switch to that language.`,
        },
      }),
    });

    const vapiData = await vapiRes.json();

    if (!vapiRes.ok) {
      return new Response(
        JSON.stringify({ error: "VAPI call failed", details: vapiData }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log communication
    await supabase.from("appointment_communications").insert({
      appointment_id: apt.id,
      channel: "vapi_call",
      direction: "outbound",
      message_sent: `Manual confirmation call initiated by staff`,
      call_status: "initiated",
      raw_response: vapiData,
    });

    return new Response(
      JSON.stringify({ success: true, call_id: vapiData.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in manual-vapi-call:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
