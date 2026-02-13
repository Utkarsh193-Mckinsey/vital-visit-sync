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
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();

    // VAPI end-of-call-report structure
    const message = body.message || body;
    const callData = message.call || body.call || body;
    const callId = callData.id || body.id || "";
    const callStatus = callData.status || message.status || body.status || "unknown";
    const duration = callData.duration || message.duration || body.duration || null;
    const transcript = message.transcript || body.transcript || callData.transcript || "";
    const summary = message.summary || body.summary || callData.summary || "";
    const customerNumber = callData.customer?.number || body.customer?.number || "";
    const endedReason = message.endedReason || body.endedReason || "";

    // Find the appointment by matching phone number to recent vapi_call communication
    let appointmentId: string | null = null;
    let appointment: any = null;

    // Try to find by customer phone number
    if (customerNumber) {
      const phoneVariants = [
        customerNumber,
        customerNumber.replace(/^\+/, ""),
        `+${customerNumber.replace(/^\+/, "")}`,
      ];

      const { data: apts } = await supabase
        .from("appointments")
        .select("*")
        .in("phone", phoneVariants)
        .gte("appointment_date", new Date().toISOString().split("T")[0])
        .neq("status", "cancelled")
        .order("appointment_date")
        .limit(1);

      if (apts && apts.length > 0) {
        appointment = apts[0];
        appointmentId = appointment.id;
      }
    }

    // Parse transcript with AI if available
    let parsed: any = {
      intent: "unclear",
      new_date: null,
      new_time: null,
      confidence: "low",
      patient_notes: "",
      summary: summary || "Call completed",
    };

    const isAnswered = callStatus === "ended" && endedReason !== "no-answer" && endedReason !== "voicemail";

    if (isAnswered && transcript && LOVABLE_API_KEY) {
      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-lite",
            messages: [
              {
                role: "system",
                content: `Parse this phone call transcript between a clinic and a patient. Return ONLY valid JSON:
{
  "intent": "confirm" | "reschedule" | "cancel" | "unclear",
  "new_date": "YYYY-MM-DD or null",
  "new_time": "HH:MM or null",
  "confidence": "high" | "medium" | "low",
  "patient_notes": "any special notes the patient mentioned",
  "summary": "one line summary of call outcome"
}`,
              },
              { role: "user", content: `Call transcript:\n${transcript}` },
            ],
          }),
        });

        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const content = aiData.choices?.[0]?.message?.content || "";
          const jsonMatch = content.match(/\{[\s\S]*\}/);
          if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("AI parsing failed, using defaults:", e);
      }
    }

    // Determine call status label
    let callStatusLabel = "answered";
    if (endedReason === "no-answer" || callStatus === "no-answer") {
      callStatusLabel = "no_answer";
    } else if (endedReason === "voicemail" || callStatus === "voicemail") {
      callStatusLabel = "voicemail";
    }

    // Update or insert communication log
    if (appointmentId) {
      // Try to update existing initiated call record
      const { data: existingComm } = await supabase
        .from("appointment_communications")
        .select("id")
        .eq("appointment_id", appointmentId)
        .eq("channel", "vapi_call")
        .eq("call_status", "initiated")
        .order("created_at", { ascending: false })
        .limit(1);

      const commUpdate = {
        call_duration_seconds: duration ? Math.round(duration) : null,
        call_status: callStatusLabel,
        call_summary: parsed.summary || summary,
        ai_parsed_intent: parsed.intent,
        ai_confidence: parsed.confidence,
        raw_response: body,
        needs_human_review: parsed.intent === "unclear" || parsed.confidence === "low",
      };

      if (existingComm && existingComm.length > 0) {
        await supabase
          .from("appointment_communications")
          .update(commUpdate)
          .eq("id", existingComm[0].id);
      } else {
        await supabase.from("appointment_communications").insert({
          appointment_id: appointmentId,
          channel: "vapi_call",
          direction: "outbound",
          ...commUpdate,
        });
      }

      // Stop any active follow-up sequence when call is answered
      if (callStatusLabel === "answered" && customerNumber) {
        await supabase
          .from("appointments")
          .update({ followup_status: "stopped" })
          .eq("status", "no_show")
          .eq("followup_status", "active")
          .in("phone", [customerNumber, `+${customerNumber.replace(/^\+/, "")}`, customerNumber.replace(/^\+/, "")]);
      }

      // Process based on result
      if (callStatusLabel === "answered" || (callStatusLabel !== "no_answer" && callStatusLabel !== "voicemail")) {
        if (parsed.intent === "confirm" && (parsed.confidence === "high" || parsed.confidence === "medium")) {
          // Check if already confirmed via WhatsApp
          const newStatus =
            appointment?.confirmation_status === "confirmed_whatsapp"
              ? "double_confirmed"
              : "confirmed_call";

          await supabase
            .from("appointments")
            .update({
              confirmation_status: newStatus,
              confirmed_at: new Date().toISOString(),
            })
            .eq("id", appointmentId);

          // Send WhatsApp confirmation
          if (WATI_API_URL && WATI_API_KEY && appointment) {
            const phone = appointment.phone.replace(/^\+/, "");
            const msg = `Hi ${appointment.patient_name}, as confirmed on our call, we'll see you ${appointment.appointment_date} at ${appointment.appointment_time}. Looking forward to it!`;
            await fetch(
              `${WATI_API_URL}/sendSessionMessage/${phone}?messageText=${encodeURIComponent(msg)}`,
              {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${WATI_API_KEY}`,
                  "Content-Type": "application/json",
                },
              }
            );

            await supabase.from("appointment_communications").insert({
              appointment_id: appointmentId,
              channel: "whatsapp",
              direction: "outbound",
              message_sent: msg,
            });
          }
        } else if (parsed.intent === "reschedule") {
          await supabase.from("pending_requests").insert({
            appointment_id: appointmentId,
            patient_name: appointment?.patient_name || "Unknown",
            phone: customerNumber,
            request_type: "reschedule",
            original_message: `[Phone call] ${transcript}`,
            ai_parsed_details: parsed,
            ai_confidence: parsed.confidence,
            status: "pending",
          });

          await supabase
            .from("appointments")
            .update({ confirmation_status: "called_reschedule" })
            .eq("id", appointmentId);
        } else if (parsed.intent === "cancel") {
          await supabase.from("pending_requests").insert({
            appointment_id: appointmentId,
            patient_name: appointment?.patient_name || "Unknown",
            phone: customerNumber,
            request_type: "cancellation",
            original_message: `[Phone call] ${transcript}`,
            ai_parsed_details: parsed,
            ai_confidence: parsed.confidence,
            status: "pending",
          });

          await supabase
            .from("appointments")
            .update({ confirmation_status: "cancelled" })
            .eq("id", appointmentId);
        }
      } else {
        // No answer / voicemail
        await supabase
          .from("appointments")
          .update({ confirmation_status: "called_no_answer" })
          .eq("id", appointmentId);
      }
    }

    return new Response(
      JSON.stringify({ success: true, appointmentId, intent: parsed.intent, callStatus: callStatusLabel }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in vapi-webhook:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
