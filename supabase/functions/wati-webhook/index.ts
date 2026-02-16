import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const AI_SYSTEM_PROMPT = `You are Cosmique Clinic's message parser. Read the patient's WhatsApp reply and determine their intent regarding their appointment. Return ONLY valid JSON:
{
  "intent": "confirm" | "reschedule" | "cancel" | "inquiry" | "unclear",
  "new_date": "YYYY-MM-DD or null",
  "new_time": "HH:MM or null",
  "confidence": "high" | "medium" | "low",
  "suggested_reply": "appropriate reply message in English",
  "needs_human": true/false,
  "summary": "brief summary of what patient wants"
}

Examples:
- 'Yes' / 'Confirm' / 'I will come' / '👍' / 'ok' → intent: confirm, confidence: high
- 'Can I come Friday at 3pm instead?' → intent: reschedule, new_date/time extracted, confidence: high
- 'I need to cancel' / 'Can't make it' → intent: cancel, confidence: high
- 'How much does it cost?' → intent: inquiry, needs_human: true
- Random text → intent: unclear, needs_human: true`;

async function parseMessageWithAI(message: string, appointmentContext: string): Promise<any> {
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  
  const res = await fetch(`${SUPABASE_URL}/functions/v1/ai-proxy`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash-lite",
      messages: [
        { role: "system", content: AI_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Patient message: "${message}"\n\nAppointment context: ${appointmentContext}`,
        },
      ],
    }),
  });

  // Fallback: try direct Lovable AI endpoint
  if (!res.ok) {
    // Use simple rule-based parsing as fallback
    return parseMessageSimple(message);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "";

  try {
    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) return JSON.parse(jsonMatch[0]);
  } catch {
    // fall through
  }

  return parseMessageSimple(message);
}

function parseMessageSimple(message: string): any {
  const lower = message.toLowerCase().trim();
  const confirmWords = ["yes", "confirm", "ok", "okay", "sure", "yep", "yeah", "i will come", "coming", "see you", "👍", "✅"];
  const cancelWords = ["cancel", "can't make it", "cannot come", "not coming", "no"];
  const rescheduleWords = ["reschedule", "change", "postpone", "move", "different time", "another day"];

  if (confirmWords.some((w) => lower.includes(w) || lower === w)) {
    return {
      intent: "confirm",
      new_date: null,
      new_time: null,
      confidence: "high",
      suggested_reply: "Great! Your appointment is confirmed. See you at Cosmique Clinic!",
      needs_human: false,
      summary: "Patient confirmed appointment",
    };
  }
  if (cancelWords.some((w) => lower.includes(w))) {
    return {
      intent: "cancel",
      new_date: null,
      new_time: null,
      confidence: "medium",
      suggested_reply: "We're sorry to hear that. Our team will process your cancellation.",
      needs_human: false,
      summary: "Patient wants to cancel",
    };
  }
  if (rescheduleWords.some((w) => lower.includes(w))) {
    return {
      intent: "reschedule",
      new_date: null,
      new_time: null,
      confidence: "medium",
      suggested_reply: "Thank you! Our team will confirm your new appointment shortly.",
      needs_human: true,
      summary: "Patient wants to reschedule",
    };
  }

  return {
    intent: "unclear",
    new_date: null,
    new_time: null,
    confidence: "low",
    suggested_reply: null,
    needs_human: true,
    summary: "Could not determine patient intent",
  };
}

async function sendWatiMessage(phone: string, message: string) {
  const WATI_API_URL = Deno.env.get("WATI_API_URL");
  const WATI_API_KEY = Deno.env.get("WATI_API_KEY");

  if (!WATI_API_URL || !WATI_API_KEY) return null;

  const cleanPhone = phone.replace(/^\+/, "");
  const res = await fetch(
    `${WATI_API_URL}/sendSessionMessage/${cleanPhone}?messageText=${encodeURIComponent(message)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${WATI_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();

    // WATI webhook payload - extract message details
    const senderPhone = body.waId || body.senderPhone || body.from || "";
    const messageText = body.text || body.message || body.body || "";
    const senderName = body.senderName || body.pushName || "";
    const timestamp = body.timestamp || new Date().toISOString();

    if (!senderPhone || !messageText) {
      return new Response(
        JSON.stringify({ error: "Missing phone or message" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize phone for matching (try with and without country code)
    const phoneVariants = [
      senderPhone,
      `+${senderPhone}`,
      senderPhone.replace(/^\+/, ""),
    ];

    // Find upcoming appointment for this phone
    const today = new Date().toISOString().split("T")[0];
    const { data: appointments } = await supabase
      .from("appointments")
      .select("*")
      .in("phone", phoneVariants)
      .gte("appointment_date", today)
      .neq("status", "cancelled")
      .order("appointment_date")
      .order("appointment_time")
      .limit(1);

    const appointment = appointments?.[0];

    // Parse message with AI
    const context = appointment
      ? `Appointment on ${appointment.appointment_date} at ${appointment.appointment_time} for ${appointment.service}. Current status: ${appointment.confirmation_status}`
      : "No upcoming appointment found";

    const parsed = await parseMessageWithAI(messageText, context);

    // Log to whatsapp_messages table
    await supabase.from("whatsapp_messages").insert({
      phone: senderPhone,
      patient_name: appointment?.patient_name || senderName || "Unknown",
      direction: "inbound",
      message_text: messageText,
      ai_parsed_intent: parsed.intent,
      ai_confidence: parsed.confidence,
      appointment_id: appointment?.id || null,
    });

    // Also log to appointment_communications if we have an appointment
    if (appointment) {
      await supabase.from("appointment_communications").insert({
        appointment_id: appointment.id,
        channel: "whatsapp",
        direction: "inbound",
        patient_reply: messageText,
        ai_parsed_intent: parsed.intent,
        ai_confidence: parsed.confidence,
        needs_human_review: parsed.needs_human || false,
        raw_response: parsed,
      });
    }

    // Stop any active follow-up sequence when patient responds
    if (senderPhone) {
      await supabase
        .from("appointments")
        .update({ followup_status: "stopped" })
        .eq("status", "no_show")
        .eq("followup_status", "active")
        .in("phone", [senderPhone, `+${senderPhone.replace(/^\+/, "")}`, senderPhone.replace(/^\+/, "")]);
    }

    // Process based on intent
    if (appointment) {
      if (parsed.intent === "confirm" && parsed.confidence === "high") {
        // Auto-confirm
        await supabase
          .from("appointments")
          .update({
            confirmation_status: "confirmed_whatsapp",
            confirmed_at: new Date().toISOString(),
            last_reply: messageText,
          })
          .eq("id", appointment.id);

        const reply = `Great! Your appointment is confirmed for ${appointment.appointment_date} at ${appointment.appointment_time}. See you at Cosmique Clinic!`;
        await sendWatiMessage(senderPhone, reply);

        // Log outbound reply to both tables
        await supabase.from("whatsapp_messages").insert({
          phone: senderPhone,
          patient_name: appointment.patient_name,
          direction: "outbound",
          message_text: reply,
          appointment_id: appointment.id,
        });
        await supabase.from("appointment_communications").insert({
          appointment_id: appointment.id,
          channel: "whatsapp",
          direction: "outbound",
          message_sent: reply,
        });
      } else if (parsed.intent === "reschedule") {
        // Create pending request
        await supabase.from("pending_requests").insert({
          appointment_id: appointment.id,
          patient_name: appointment.patient_name,
          phone: senderPhone,
          request_type: "reschedule",
          original_message: messageText,
          ai_parsed_details: parsed,
          ai_confidence: parsed.confidence,
          ai_suggested_reply: parsed.suggested_reply,
          status: "pending",
        });

        const reply = "Thank you! Our team will confirm your new appointment shortly.";
        await sendWatiMessage(senderPhone, reply);

        await supabase.from("whatsapp_messages").insert({
          phone: senderPhone, patient_name: appointment.patient_name,
          direction: "outbound", message_text: reply, appointment_id: appointment.id,
        });
        await supabase.from("appointment_communications").insert({
          appointment_id: appointment.id, channel: "whatsapp", direction: "outbound", message_sent: reply,
        });

        await supabase
          .from("appointments")
          .update({ last_reply: messageText })
          .eq("id", appointment.id);
      } else if (parsed.intent === "cancel") {
        await supabase.from("pending_requests").insert({
          appointment_id: appointment.id,
          patient_name: appointment.patient_name,
          phone: senderPhone,
          request_type: "cancellation",
          original_message: messageText,
          ai_parsed_details: parsed,
          ai_confidence: parsed.confidence,
          ai_suggested_reply: parsed.suggested_reply,
          status: "pending",
        });

        const reply = "We're sorry to hear that. Our team will process your cancellation.";
        await sendWatiMessage(senderPhone, reply);

        await supabase.from("whatsapp_messages").insert({
          phone: senderPhone, patient_name: appointment.patient_name,
          direction: "outbound", message_text: reply, appointment_id: appointment.id,
        });
        await supabase.from("appointment_communications").insert({
          appointment_id: appointment.id, channel: "whatsapp", direction: "outbound",
          message_sent: reply,
        });

        await supabase
          .from("appointments")
          .update({ last_reply: messageText })
          .eq("id", appointment.id);
      } else {
        // inquiry / unclear / low confidence → pending for staff
        await supabase.from("pending_requests").insert({
          appointment_id: appointment.id,
          patient_name: appointment.patient_name,
          phone: senderPhone,
          request_type: parsed.intent === "inquiry" ? "inquiry" : "unclear",
          original_message: messageText,
          ai_parsed_details: parsed,
          ai_confidence: parsed.confidence,
          ai_suggested_reply: parsed.suggested_reply,
          needs_human_review: true,
          status: "pending",
        });

        await supabase
          .from("appointments")
          .update({ last_reply: messageText })
          .eq("id", appointment.id);
        // Do NOT auto-reply for unclear/inquiry
      }
    } else {
      // No appointment found - create pending request for staff
      await supabase.from("pending_requests").insert({
        patient_name: "Unknown",
        phone: senderPhone,
        request_type: "inquiry",
        original_message: messageText,
        ai_parsed_details: parsed,
        ai_confidence: parsed.confidence,
        needs_human_review: true,
        status: "pending",
      });
    }

    return new Response(
      JSON.stringify({ success: true, intent: parsed.intent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in wati-webhook:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
