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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { action, request_id, staff_name, ...params } = await req.json();

    if (!request_id || !action) {
      return new Response(JSON.stringify({ error: "request_id and action required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the pending request
    const { data: request, error: reqErr } = await supabase
      .from("pending_requests")
      .select("*")
      .eq("id", request_id)
      .single();

    if (reqErr || !request) {
      return new Response(JSON.stringify({ error: "Request not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsedDetails = request.ai_parsed_details as any || {};
    let result: any = { success: true };

    switch (action) {
      case "approve": {
        if (request.request_type === "reschedule") {
          // Get new date/time from AI parsed or params
          const newDate = params.new_date || parsedDetails.new_date;
          const newTime = params.new_time || parsedDetails.new_time;

          if (!newDate || !newTime) {
            return new Response(JSON.stringify({ error: "new_date and new_time required for reschedule" }), {
              status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
          }

          // Update old appointment
          if (request.appointment_id) {
            await supabase.from("appointments").update({ status: "rescheduled" }).eq("id", request.appointment_id);
          }

          // Create new appointment
          const { data: newApt } = await supabase.from("appointments").insert({
            patient_name: request.patient_name,
            phone: request.phone,
            appointment_date: newDate,
            appointment_time: newTime,
            service: params.service || "Consultation",
            booked_by: staff_name || null,
            rescheduled_from: request.appointment_id,
            status: "upcoming",
            confirmation_status: "confirmed_whatsapp",
            confirmed_at: new Date().toISOString(),
          }).select().single();

          // DISABLED: No messages to patients
          // await sendWatiMessage(request.phone, `Hi ${request.patient_name}, your appointment has been rescheduled...`);
          console.log("Reschedule approved (no message sent to patient):", request.patient_name);

          if (request.appointment_id) {
            await supabase.from("appointment_communications").insert({
              appointment_id: request.appointment_id,
              channel: "whatsapp", direction: "outbound",
              message_sent: `Reschedule approved. New appointment: ${newDate} at ${newTime}`,
            });
          }

          result.new_appointment_id = newApt?.id;
        } else if (request.request_type === "cancellation") {
          if (request.appointment_id) {
            await supabase.from("appointments").update({
              status: "cancelled",
              confirmation_status: "cancelled",
            }).eq("id", request.appointment_id);
          }

          // DISABLED: No messages to patients
          // await sendWatiMessage(request.phone, `Hi ${request.patient_name}, your appointment has been cancelled...`);
          console.log("Cancellation approved (no message sent to patient):", request.patient_name);

          if (request.appointment_id) {
            await supabase.from("appointment_communications").insert({
              appointment_id: request.appointment_id,
              channel: "whatsapp", direction: "outbound",
              message_sent: "Cancellation approved and confirmed to patient",
            });
          }
        }

        // Mark request as handled
        await supabase.from("pending_requests").update({
          status: "handled",
          handled_by: staff_name || "staff",
          handled_at: new Date().toISOString(),
          staff_reply: `Approved: ${request.request_type}`,
        }).eq("id", request_id);

        break;
      }

      case "suggest_alternative": {
        const { alt_date, alt_time } = params;
        if (!alt_date || !alt_time) {
          return new Response(JSON.stringify({ error: "alt_date and alt_time required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const msg = `Hi ${request.patient_name}, the time you requested is not available. How about ${alt_date} at ${alt_time}? Let us know if that works for you!`;
        // DISABLED: No messages to patients
        // await sendWatiMessage(request.phone, msg);
        console.log("Alternative suggested (no message sent to patient):", request.patient_name);

        if (request.appointment_id) {
          await supabase.from("appointment_communications").insert({
            appointment_id: request.appointment_id,
            channel: "whatsapp", direction: "outbound",
            message_sent: msg,
          });
        }

        await supabase.from("pending_requests").update({
          staff_reply: `Suggested alternative: ${alt_date} at ${alt_time}`,
        }).eq("id", request_id);

        break;
      }

      case "reply": {
        const { message } = params;
        if (!message) {
          return new Response(JSON.stringify({ error: "message required" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // DISABLED: No messages to patients
        // await sendWatiMessage(request.phone, message);
        console.log("Reply composed (no message sent to patient):", request.patient_name);

        if (request.appointment_id) {
          await supabase.from("appointment_communications").insert({
            appointment_id: request.appointment_id,
            channel: "whatsapp", direction: "outbound",
            message_sent: message,
          });
        }

        await supabase.from("pending_requests").update({
          staff_reply: message,
        }).eq("id", request_id);

        break;
      }

      case "decline": {
        const reason = params.reason || "We're unable to accommodate this request at this time.";
        const msg = `Hi ${request.patient_name}, ${reason} Please contact us if you need further assistance. — Cosmique Clinic`;
        // DISABLED: No messages to patients
        // await sendWatiMessage(request.phone, msg);
        console.log("Request declined (no message sent to patient):", request.patient_name);

        if (request.appointment_id) {
          await supabase.from("appointment_communications").insert({
            appointment_id: request.appointment_id,
            channel: "whatsapp", direction: "outbound",
            message_sent: msg,
          });
        }

        await supabase.from("pending_requests").update({
          status: "handled",
          handled_by: staff_name || "staff",
          handled_at: new Date().toISOString(),
          staff_reply: `Declined: ${reason}`,
        }).eq("id", request_id);

        break;
      }

      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in handle-pending-request:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
