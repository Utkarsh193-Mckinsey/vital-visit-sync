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

function parseAppointmentMessage(msg: string): {
  name: string; phone: string; date: string; time: string; service: string; doctor?: string;
} | null {
  // Detect structured appointment messages like:
  // "Appointment Confirmation\nName : Mr Daniel\nPhone :0566648823\nDate : Wednesday 18th February 2026\nTime :5:00 PM\nService : Face Consultation\nDr Deepika"
  const lower = msg.toLowerCase();
  if (!lower.includes("appointment") && !lower.includes("booking")) return null;

  // Extract name
  const nameMatch = msg.match(/name\s*[:：]\s*(.+)/i);
  if (!nameMatch) return null;
  const name = nameMatch[1].trim();

  // Extract phone
  const phoneMatch = msg.match(/phone\s*[:：]\s*([\d\s+()-]+)/i);
  if (!phoneMatch) return null;
  const phone = phoneMatch[1].trim().replace(/\s+/g, "");

  // Extract date - handle various formats
  const dateMatch = msg.match(/date\s*[:：]\s*(.+)/i);
  if (!dateMatch) return null;
  const dateStr = dateMatch[1].trim();

  // Parse date: "Wednesday 18th February 2026" or "18/02/2026" or "2026-02-18"
  let parsedDate: string | null = null;

  // Try ISO format first
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    parsedDate = isoMatch[0];
  }

  // Try DD/MM/YYYY
  const slashMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (!parsedDate && slashMatch) {
    parsedDate = `${slashMatch[3]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[1].padStart(2, "0")}`;
  }

  // Try "18th February 2026" or "February 18, 2026" (with optional day name)
  if (!parsedDate) {
    const months: Record<string, string> = {
      january: "01", february: "02", march: "03", april: "04",
      may: "05", june: "06", july: "07", august: "08",
      september: "09", october: "10", november: "11", december: "12",
    };
    // "18th February 2026"
    const dmy = dateStr.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)\s+(\d{4})/i);
    if (dmy && months[dmy[2].toLowerCase()]) {
      parsedDate = `${dmy[3]}-${months[dmy[2].toLowerCase()]}-${dmy[1].padStart(2, "0")}`;
    }
    // "February 18, 2026"
    if (!parsedDate) {
      const mdy = dateStr.match(/(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i);
      if (mdy && months[mdy[1].toLowerCase()]) {
        parsedDate = `${mdy[3]}-${months[mdy[1].toLowerCase()]}-${mdy[2].padStart(2, "0")}`;
      }
    }
  }

  if (!parsedDate) return null;

  // Extract time
  const timeMatch = msg.match(/time\s*[:：]\s*(\d{1,2}[:\.]\d{2}\s*(?:AM|PM|am|pm)?)/i);
  if (!timeMatch) return null;
  let timeStr = timeMatch[1].trim().replace(".", ":");

  // Convert to 24h format
  const pmMatch = timeStr.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (pmMatch) {
    let h = parseInt(pmMatch[1]);
    const m = pmMatch[2];
    const ampm = pmMatch[3].toUpperCase();
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    timeStr = `${h.toString().padStart(2, "0")}:${m}`;
  }

  // Extract service
  const serviceMatch = msg.match(/service\s*[:：]\s*(.+)/i);
  const service = serviceMatch ? serviceMatch[1].trim() : "Consultation";

  // Extract doctor (look for "Dr" or "Doctor" line)
  const drMatch = msg.match(/(?:^|\n)\s*(Dr\.?\s+\w+[\w\s]*)/im);
  const doctor = drMatch ? drMatch[1].trim() : undefined;

  return { name, phone, date: parsedDate, time: timeStr, service, doctor };
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

    // Check if this is a structured appointment booking message from the team
    const appointmentData = parseAppointmentMessage(messageText);
    if (appointmentData) {
      // Log the message
      await supabase.from("whatsapp_messages").insert({
        phone: senderPhone,
        patient_name: senderName || "Team",
        direction: "inbound",
        message_text: messageText,
        ai_parsed_intent: "booking",
      });

      // Extract booked_by from message - look for "Booked by" or "Agent" line
      const bookedByMatch = messageText.match(/(?:booked\s*by|agent)\s*[:：]\s*(.+)/i);
      const bookedBy = bookedByMatch ? bookedByMatch[1].trim() : null;

      // Create the appointment
      const { data: newApt, error: aptError } = await supabase
        .from("appointments")
        .insert({
          patient_name: appointmentData.name,
          phone: appointmentData.phone,
          appointment_date: appointmentData.date,
          appointment_time: appointmentData.time,
          service: appointmentData.service,
          status: "upcoming",
          confirmation_status: "unconfirmed",
          booked_by: bookedBy || "WhatsApp",
          is_new_patient: false,
        })
        .select()
        .single();

      if (aptError) {
        console.error("Error creating appointment:", aptError);
        return new Response(
          JSON.stringify({ success: false, error: aptError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Auto-created appointment:", newApt?.id, appointmentData.name);

      // If no booked_by was provided, ask who booked it
      if (!bookedBy) {
        const askReply = `✅ Appointment created for ${appointmentData.name} on ${appointmentData.date} at ${appointmentData.time}.\n\n❓ Who booked this appointment? Please reply with the name.`;
        await sendWatiMessage(senderPhone, askReply);

        // Log outbound message
        await supabase.from("whatsapp_messages").insert({
          phone: senderPhone,
          patient_name: senderName || "Team",
          direction: "outbound",
          message_text: askReply,
        });
      }

      return new Response(
        JSON.stringify({ success: true, intent: "booking", appointment_id: newApt?.id, asked_booked_by: !bookedBy }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
