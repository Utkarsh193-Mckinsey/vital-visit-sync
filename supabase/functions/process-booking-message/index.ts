import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function parseBookingMessage(text: string) {
  // Parse structured booking format:
  // Appointment Confirmation
  // Name : [name]
  // Phone : [phone]
  // Date : [date]
  // Time : [time]
  // Service : [service]
  // Booked by [staff]

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  const extract = (key: string): string => {
    const line = lines.find((l) => l.toLowerCase().startsWith(key.toLowerCase()));
    if (!line) return "";
    return line.replace(/^[^:]+:\s*/, "").trim();
  };

  const bookedByLine = lines.find((l) => l.toLowerCase().startsWith("booked by"));
  const booked_by = bookedByLine
    ? bookedByLine.replace(/^booked by\s*/i, "").trim()
    : "";

  const name = extract("name");
  const phone = extract("phone");
  const dateStr = extract("date");
  const timeStr = extract("time");
  const service = extract("service");

  return { name, phone, date: dateStr, time: timeStr, service, booked_by };
}

function normalizeDate(dateStr: string): string {
  // Try common formats and return YYYY-MM-DD
  // Handle: "15 Feb 2026", "2026-02-15", "15/02/2026", "Feb 15, 2026"
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split("T")[0];
  }

  // Try DD/MM/YYYY
  const parts = dateStr.split(/[\/\-\.]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (Number(c) > 100) {
      // DD/MM/YYYY
      const date = new Date(`${c}-${b.padStart(2, "0")}-${a.padStart(2, "0")}`);
      if (!isNaN(date.getTime())) return date.toISOString().split("T")[0];
    }
  }

  return dateStr; // Return as-is if can't parse
}

function normalizeTime(timeStr: string): string {
  // Convert "3pm", "3:00 PM", "15:00" → "HH:MM"
  const clean = timeStr.trim().toLowerCase();

  // Already HH:MM format
  if (/^\d{1,2}:\d{2}$/.test(clean)) return clean.padStart(5, "0");

  // Handle AM/PM
  const match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (match) {
    let hours = parseInt(match[1]);
    const minutes = match[2] || "00";
    const period = match[3];

    if (period === "pm" && hours < 12) hours += 12;
    if (period === "am" && hours === 12) hours = 0;

    return `${String(hours).padStart(2, "0")}:${minutes}`;
  }

  return timeStr;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const WATI_API_URL = Deno.env.get("WATI_API_URL");
  const WATI_API_KEY = Deno.env.get("WATI_API_KEY");
  const CONFIRMED_TEMPLATE = Deno.env.get("WATI_TEMPLATE_CONFIRMED_REPLY");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const body = await req.json();
    const messageText = body.message || body.text || "";

    if (!messageText) {
      return new Response(
        JSON.stringify({ error: "No message provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse booking message
    const parsed = parseBookingMessage(messageText);

    if (!parsed.name || !parsed.phone) {
      return new Response(
        JSON.stringify({ error: "Could not parse name and phone from message", parsed }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appointmentDate = normalizeDate(parsed.date);
    const appointmentTime = normalizeTime(parsed.time);

    // Check if patient exists
    const phoneVariants = [
      parsed.phone,
      `+${parsed.phone.replace(/^\+/, "")}`,
      parsed.phone.replace(/^\+/, ""),
    ];

    const { data: existingPatients } = await supabase
      .from("patients")
      .select("id")
      .in("phone_number", phoneVariants)
      .limit(1);

    const isNewPatient = !existingPatients || existingPatients.length === 0;

    // Create appointment
    const { data: appointment, error: insertErr } = await supabase
      .from("appointments")
      .insert({
        patient_name: parsed.name,
        phone: parsed.phone,
        appointment_date: appointmentDate,
        appointment_time: appointmentTime,
        service: parsed.service || "Consultation",
        booked_by: parsed.booked_by || null,
        is_new_patient: isNewPatient,
        status: "upcoming",
        confirmation_status: "unconfirmed",
      })
      .select()
      .single();

    if (insertErr) throw insertErr;

    // Send WATI confirmation to patient
    if (WATI_API_URL && WATI_API_KEY) {
      const cleanPhone = parsed.phone.replace(/^\+/, "");

      if (CONFIRMED_TEMPLATE) {
        // Use template
        await fetch(
          `${WATI_API_URL}/sendTemplateMessage?whatsappNumber=${cleanPhone}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${WATI_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              template_name: CONFIRMED_TEMPLATE,
              broadcast_name: `booking_confirm_${appointment.id}`,
              parameters: [
                { name: "patient_name", value: parsed.name },
                { name: "appointment_date", value: appointmentDate },
                { name: "appointment_time", value: appointmentTime },
                { name: "service", value: parsed.service || "Consultation" },
              ],
            }),
          }
        );
      } else {
        // Send session message
        const confirmMsg = `Hi ${parsed.name}, your appointment at Cosmique Clinic has been booked! ${appointmentDate} at ${appointmentTime} for ${parsed.service || "Consultation"}. We'll send you a reminder 24 hours before.`;
        await fetch(
          `${WATI_API_URL}/sendSessionMessage/${cleanPhone}?messageText=${encodeURIComponent(confirmMsg)}`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${WATI_API_KEY}`,
              "Content-Type": "application/json",
            },
          }
        );
      }

      // Log communication
      await supabase.from("appointment_communications").insert({
        appointment_id: appointment.id,
        channel: "whatsapp",
        direction: "outbound",
        message_sent: `Booking confirmation sent for ${appointmentDate} at ${appointmentTime}`,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        appointment_id: appointment.id,
        is_new_patient: isNewPatient,
        parsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in process-booking-message:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
