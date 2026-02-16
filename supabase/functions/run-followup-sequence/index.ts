import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sendWatiMessage(phone: string, message: string) {
  const WATI_API_URL = Deno.env.get("WATI_API_URL");
  const WATI_API_KEY = Deno.env.get("WATI_API_KEY");
  if (!WATI_API_URL || !WATI_API_KEY) return;
  const cleanPhone = phone.replace(/^\+/, "");
  await fetch(`${WATI_API_URL}/sendSessionMessage/${cleanPhone}?messageText=${encodeURIComponent(message)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${WATI_API_KEY}`, "Content-Type": "application/json" },
  });
}

async function triggerVapiCall(supabase: any, apt: any) {
  const VAPI_API_KEY = Deno.env.get("VAPI_API_KEY");
  const VAPI_PHONE_NUMBER_ID = Deno.env.get("VAPI_PHONE_NUMBER_ID");
  const VAPI_ASSISTANT_ID = Deno.env.get("VAPI_ASSISTANT_ID");
  if (!VAPI_API_KEY || !VAPI_PHONE_NUMBER_ID || !VAPI_ASSISTANT_ID) return;

  let phone = apt.phone.trim();
  if (!phone.startsWith("+")) phone = `+${phone}`;

  const vapiRes = await fetch("https://api.vapi.ai/call/phone", {
    method: "POST",
    headers: { Authorization: `Bearer ${VAPI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      assistantId: VAPI_ASSISTANT_ID,
      phoneNumberId: VAPI_PHONE_NUMBER_ID,
      customer: { number: phone },
      assistantOverrides: {
        firstMessage: `Hello ${apt.patient_name}, this is calling from Cosmique Aesthetic and Dermatology Clinic. We noticed you missed your recent appointment for ${apt.service}. We'd love to help you reschedule. Would you like to book a new appointment?`,
        context: `Patient: ${apt.patient_name}, missed appointment for ${apt.service}. This is a follow-up call. If they want to reschedule, ask for preferred date and time. If not interested, acknowledge politely.`,
      },
    }),
  });

  const vapiData = await vapiRes.json();
  await supabase.from("appointment_communications").insert({
    appointment_id: apt.id,
    channel: "vapi_call",
    direction: "outbound",
    message_sent: "Follow-up call (Day 7) for no-show",
    call_status: "initiated",
    raw_response: vapiData,
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Get all no-show appointments with active follow-up
    const { data: appointments, error } = await supabase
      .from("appointments")
      .select("*")
      .eq("status", "no_show")
      .eq("followup_status", "active")
      .order("appointment_date");

    if (error) throw error;

    const now = new Date();
    const results: { id: string; step: number; action: string }[] = [];

    // DISABLED: Patient messaging is currently turned off
    // All follow-up sequences are paused - no messages sent to patients
    console.log(`Found ${(appointments || []).length} active follow-ups, but patient messaging is DISABLED`);
    const results: { id: string; step: number; action: string }[] = [];

    return new Response(JSON.stringify({ processed: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in run-followup-sequence:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
