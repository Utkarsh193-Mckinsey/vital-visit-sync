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

    for (const apt of appointments || []) {
      const noShowDate = new Date(apt.appointment_date);
      const daysSince = Math.floor((now.getTime() - noShowDate.getTime()) / (1000 * 60 * 60 * 24));
      const currentStep = apt.followup_step || 0;

      if (apt.is_new_patient) {
        // NEW PATIENT: aggressive 4-step sequence
        if (daysSince >= 1 && currentStep < 1) {
          const msg = `Hi ${apt.patient_name}, would you like to reschedule your ${apt.service} appointment? We have availability this week at Cosmique Clinic. Reply with your preferred date and time!`;
          await sendWatiMessage(apt.phone, msg);
          await supabase.from("appointment_communications").insert({
            appointment_id: apt.id, channel: "whatsapp", direction: "outbound",
            message_sent: `Follow-up Day 1: ${msg}`,
          });
          await supabase.from("appointments").update({ followup_step: 1 }).eq("id", apt.id);
          results.push({ id: apt.id, step: 1, action: "whatsapp_day1" });

        } else if (daysSince >= 3 && currentStep < 2) {
          const msg = `Hi ${apt.patient_name}, just checking in! Many of our patients love their ${apt.service} results at Cosmique Clinic. We'd love to help you too. Would you like to book a new appointment?`;
          await sendWatiMessage(apt.phone, msg);
          await supabase.from("appointment_communications").insert({
            appointment_id: apt.id, channel: "whatsapp", direction: "outbound",
            message_sent: `Follow-up Day 3: ${msg}`,
          });
          await supabase.from("appointments").update({ followup_step: 2 }).eq("id", apt.id);
          results.push({ id: apt.id, step: 2, action: "whatsapp_day3" });

        } else if (daysSince >= 7 && currentStep < 3) {
          const msg = `Hi ${apt.patient_name}, we have a special opening this week for ${apt.service}. Would you like us to reserve a spot for you? Reply YES and we will arrange it for you.`;
          await sendWatiMessage(apt.phone, msg);
          await supabase.from("appointment_communications").insert({
            appointment_id: apt.id, channel: "whatsapp", direction: "outbound",
            message_sent: `Follow-up Day 7: ${msg}`,
          });
          // Also trigger VAPI call
          await triggerVapiCall(supabase, apt);
          await supabase.from("appointments").update({ followup_step: 3 }).eq("id", apt.id);
          results.push({ id: apt.id, step: 3, action: "whatsapp_day7_plus_call" });

        } else if (daysSince >= 14 && currentStep < 4) {
          await supabase.from("appointments").update({
            followup_step: 4,
            followup_status: "completed",
          }).eq("id", apt.id);
          results.push({ id: apt.id, step: 4, action: "sequence_completed" });
        }
      } else {
        // EXISTING PATIENT: lighter 2-step sequence
        if (daysSince >= 1 && currentStep < 1) {
          const msg = `Hi ${apt.patient_name}, we missed you at your appointment. Would you like to reschedule? Let us know your preferred time.`;
          await sendWatiMessage(apt.phone, msg);
          await supabase.from("appointment_communications").insert({
            appointment_id: apt.id, channel: "whatsapp", direction: "outbound",
            message_sent: `Follow-up Day 1: ${msg}`,
          });
          await supabase.from("appointments").update({ followup_step: 1 }).eq("id", apt.id);
          results.push({ id: apt.id, step: 1, action: "whatsapp_day1" });

        } else if (daysSince >= 3 && currentStep < 2) {
          const msg = `Hi ${apt.patient_name}, just a gentle reminder — would you like to book a new appointment for ${apt.service}?`;
          await sendWatiMessage(apt.phone, msg);
          await supabase.from("appointment_communications").insert({
            appointment_id: apt.id, channel: "whatsapp", direction: "outbound",
            message_sent: `Follow-up Day 3: ${msg}`,
          });
          await supabase.from("appointments").update({
            followup_step: 2,
            followup_status: "completed",
          }).eq("id", apt.id);
          results.push({ id: apt.id, step: 2, action: "whatsapp_day3_completed" });
        }
      }
    }

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
