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

  if (!WATI_API_URL || !WATI_API_KEY) {
    console.error("WATI credentials not configured");
    return null;
  }

  const cleanPhone = phone.replace(/^\+/, "");
  try {
    const res = await fetch(
      `${WATI_API_URL}/api/v1/sendSessionMessage/${cleanPhone}?messageText=${encodeURIComponent(message)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${WATI_API_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    const text = await res.text();
    console.log("WATI response:", res.status, text);
    try { return JSON.parse(text); } catch { return { status: res.status, body: text }; }
  } catch (err) {
    console.error("WATI send error:", err);
    return null;
  }
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

function parseTimeString(timeStr: string): string | null {
  // Parse various time formats: "3:00 PM", "15:00", "3pm", etc.
  const cleaned = timeStr.trim().replace(".", ":");
  
  // Try "3:00 PM" or "15:00"
  const match = cleaned.match(/(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?/i);
  if (match) {
    let h = parseInt(match[1]);
    const m = match[2];
    const ampm = match[3]?.toUpperCase();
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${h.toString().padStart(2, "0")}:${m}`;
  }
  
  // Try "3pm" or "3 pm"
  const simpleMatch = cleaned.match(/(\d{1,2})\s*(AM|PM|am|pm)/i);
  if (simpleMatch) {
    let h = parseInt(simpleMatch[1]);
    const ampm = simpleMatch[2].toUpperCase();
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return `${h.toString().padStart(2, "0")}:00`;
  }
  
  return null;
}

function isValidClinicTime(time24: string): boolean {
  // Clinic hours: 10:00 AM (10:00) to 10:00 PM (22:00)
  // DB may store as HH:MM:SS so handle both formats
  const match = time24.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return false;
  const h = parseInt(match[1]);
  return h >= 10 && h <= 22;
}

function isPastDate(dateStr: string): boolean {
  // Check if date is before today (UAE timezone UTC+4)
  const now = new Date();
  const uaeOffset = 4 * 60; // UAE is UTC+4
  const uaeNow = new Date(now.getTime() + (uaeOffset + now.getTimezoneOffset()) * 60000);
  const todayStr = uaeNow.toISOString().split("T")[0];
  return dateStr < todayStr;
}

function parseDateString(dateStr: string): string | null {
  // Parse various date formats
  const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return isoMatch[0];

  const slashMatch = dateStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (slashMatch) return `${slashMatch[3]}-${slashMatch[2].padStart(2, "0")}-${slashMatch[1].padStart(2, "0")}`;

  const months: Record<string, string> = {
    january: "01", february: "02", march: "03", april: "04",
    may: "05", june: "06", july: "07", august: "08",
    september: "09", october: "10", november: "11", december: "12",
  };

  const dmy = dateStr.match(/(\d{1,2})(?:st|nd|rd|th)?\s+(\w+)\s+(\d{4})/i);
  if (dmy && months[dmy[2].toLowerCase()]) {
    return `${dmy[3]}-${months[dmy[2].toLowerCase()]}-${dmy[1].padStart(2, "0")}`;
  }

  const mdy = dateStr.match(/(\w+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i);
  if (mdy && months[mdy[1].toLowerCase()]) {
    return `${mdy[3]}-${months[mdy[1].toLowerCase()]}-${mdy[2].padStart(2, "0")}`;
  }

  return null;
}

async function getBookingStaffNames(supabase: any): Promise<string[]> {
  const { data } = await supabase
    .from("staff")
    .select("full_name")
    .in("role", ["reception", "admin"])
    .eq("status", "active");
  return (data || []).map((s: any) => s.full_name as string);
}

function matchStaffName(input: string, staffNames: string[]): string | null {
  const lower = input.toLowerCase().trim();
  // Exact match
  const exact = staffNames.find(n => n.toLowerCase() === lower);
  if (exact) return exact;
  // Partial match (first name)
  const partial = staffNames.find(n => n.toLowerCase().split(" ")[0] === lower || n.toLowerCase().includes(lower));
  if (partial) return partial;
  return null;
}

function getValidationIssues(apt: any, staffNames: string[]): string[] {
  const issues: string[] = [];
  if (!isValidClinicTime(apt.appointment_time)) {
    issues.push(`⏰ Invalid time "${apt.appointment_time}" — clinic hours are 10:00 AM to 10:00 PM. Please provide a valid time.`);
  }
  if (isPastDate(apt.appointment_date)) {
    issues.push(`📅 The date ${apt.appointment_date} is a past date. Please provide today's date or a future date.`);
  }
  const phoneClean = (apt.phone || "").replace(/\s+/g, "").replace(/[^\d+]/g, "");
  if (phoneClean.length < 7) {
    issues.push(`📱 Phone number looks invalid. Please provide a valid phone number.`);
  }
  if (!apt.booked_by || apt.booked_by === "WhatsApp") {
    issues.push(`👤 Who booked this appointment? Please reply with one of: ${staffNames.join(", ")}`);
  } else if (!staffNames.some(n => n.toLowerCase() === (apt.booked_by || "").toLowerCase())) {
    // Name exists but doesn't match any staff
    const matched = matchStaffName(apt.booked_by, staffNames);
    if (!matched) {
      issues.push(`👤 "${apt.booked_by}" is not a valid staff member. Please reply with one of: ${staffNames.join(", ")}`);
    }
  }
  if (!apt.service || apt.service === "Consultation") {
    issues.push("💉 What treatment/service is this for?");
  }
  return issues;
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

    // ============================================================
    // STEP 1: Check if this is a staff reply to a missing/invalid info question
    // ============================================================
    {
      const { data: recentOutbound } = await supabase
        .from("whatsapp_messages")
        .select("appointment_id, message_text, created_at")
        .eq("phone", senderPhone)
        .eq("direction", "outbound")
        .or("message_text.ilike.%❓ Please reply%,message_text.ilike.%⚠️ Issues found%")
        .order("created_at", { ascending: false })
        .limit(1);

      if (recentOutbound && recentOutbound.length > 0 && recentOutbound[0].appointment_id) {
        const pendingAptId = recentOutbound[0].appointment_id;
        const outboundMsg = recentOutbound[0].message_text || "";

        // Use AI to parse the staff reply against the pending questions
        const pendingQuestions: string[] = [];
        if (outboundMsg.includes("Who booked") || outboundMsg.includes("not a valid staff member")) pendingQuestions.push("booked_by");
        if (outboundMsg.includes("valid time")) pendingQuestions.push("time");
        if (outboundMsg.includes("valid date") || outboundMsg.includes("past date")) pendingQuestions.push("date");
        if (outboundMsg.includes("phone number")) pendingQuestions.push("phone");
        if (outboundMsg.includes("treatment")) pendingQuestions.push("service");

        if (pendingQuestions.length > 0) {
          // Fetch valid staff names for booked_by validation
          const staffNames = await getBookingStaffNames(supabase);

          // Parse reply - could be multi-line answers or single value
          const updates: Record<string, string> = {};
          const rejections: string[] = [];
          const replyLines = messageText.trim().split("\n").map(l => l.trim()).filter(Boolean);

          // Try to match answers to questions using AI for complex replies
          if (pendingQuestions.length === 1 && replyLines.length === 1) {
            // Simple single answer
            const field = pendingQuestions[0];
            const value = replyLines[0];
            
            if (field === "time") {
              const timeVal = parseTimeString(value);
              if (timeVal && isValidClinicTime(timeVal)) {
                updates["appointment_time"] = timeVal;
              }
            } else if (field === "date") {
              const dateVal = parseDateString(value);
              if (dateVal && !isPastDate(dateVal)) {
                updates["appointment_date"] = dateVal;
              }
            } else if (field === "phone") {
              const cleanPhone = value.replace(/\s+/g, "").replace(/[^\d+]/g, "");
              if (cleanPhone.length >= 7) {
                updates["phone"] = cleanPhone;
              }
            } else if (field === "service") {
              updates["service"] = value;
            } else if (field === "booked_by") {
              const matched = matchStaffName(value, staffNames);
              if (matched) {
                updates["booked_by"] = matched;
              } else {
                rejections.push(`❌ "${value}" — no staff member with this name. Please reply with one of: ${staffNames.join(", ")}`);
              }
            }
          } else {
            // Multi-field reply - try to match by keyword or order
            for (const line of replyLines) {
              const bookedMatch = line.match(/(?:booked\s*by|agent|by)\s*[:：-]\s*(.+)/i);
              const timeMatch = line.match(/(?:time)\s*[:：-]\s*(.+)/i) || line.match(/^(\d{1,2}[:\.]\d{2}\s*(?:AM|PM|am|pm)?)$/i);
              const dateMatch = line.match(/(?:date)\s*[:：-]\s*(.+)/i);
              const phoneMatch = line.match(/(?:phone|number)\s*[:：-]\s*([\d\s+()-]+)/i);
              const serviceMatch = line.match(/(?:service|treatment)\s*[:：-]\s*(.+)/i);
              const instrMatch = line.match(/(?:instruction|note|special)\s*[:：-]\s*(.+)/i);

              if (bookedMatch && pendingQuestions.includes("booked_by")) {
                const matched = matchStaffName(bookedMatch[1].trim(), staffNames);
                if (matched) {
                  updates["booked_by"] = matched;
                } else {
                  rejections.push(`❌ "${bookedMatch[1].trim()}" — no staff member with this name. Please reply with one of: ${staffNames.join(", ")}`);
                }
              } else if (timeMatch && pendingQuestions.includes("time")) {
                const tv = parseTimeString(timeMatch[1]?.trim() || line.trim());
                if (tv && isValidClinicTime(tv)) updates["appointment_time"] = tv;
              } else if (dateMatch && pendingQuestions.includes("date")) {
                const dv = parseDateString(dateMatch[1].trim());
                if (dv && !isPastDate(dv)) updates["appointment_date"] = dv;
              } else if (phoneMatch && pendingQuestions.includes("phone")) {
                const cp = phoneMatch[1].trim().replace(/\s+/g, "");
                if (cp.length >= 7) updates["phone"] = cp;
              } else if (serviceMatch && pendingQuestions.includes("service")) {
                updates["service"] = serviceMatch[1].trim();
              } else if (instrMatch) {
                updates["special_instructions"] = instrMatch[1].trim();
              } else if (pendingQuestions.length === 1 && replyLines.length <= 2) {
                const field = pendingQuestions[0];
                if (field === "booked_by") {
                  const matched = matchStaffName(line.trim(), staffNames);
                  if (matched) {
                    updates["booked_by"] = matched;
                  } else {
                    rejections.push(`❌ "${line.trim()}" — no staff member with this name. Please reply with one of: ${staffNames.join(", ")}`);
                  }
                } else if (field === "service") updates["service"] = line.trim();
              }
            }
          }

          // If there are rejections and no valid updates for that field, send rejection
          if (rejections.length > 0 && Object.keys(updates).length === 0) {
            await supabase.from("whatsapp_messages").insert({
              phone: senderPhone,
              patient_name: senderName || "Team",
              direction: "inbound",
              message_text: messageText,
              appointment_id: pendingAptId,
              ai_parsed_intent: "info_reply_invalid",
            });

            const rejectMsg = rejections.join("\n");
            await sendWatiMessage(senderPhone, rejectMsg);
            await supabase.from("whatsapp_messages").insert({
              phone: senderPhone,
              patient_name: senderName || "Team",
              direction: "outbound",
              message_text: rejectMsg,
              appointment_id: pendingAptId,
            });

            return new Response(
              JSON.stringify({ success: true, intent: "info_reply_invalid", rejections }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (Object.keys(updates).length > 0) {
            const { error: updateErr } = await supabase
              .from("appointments")
              .update(updates)
              .eq("id", pendingAptId);

            if (!updateErr) {
              const updatedFields = Object.entries(updates).map(([k, v]) => `${k}: ${v}`).join(", ");
              console.log(`Updated appointment ${pendingAptId}: ${updatedFields}`);

              await supabase.from("whatsapp_messages").insert({
                phone: senderPhone,
                patient_name: senderName || "Team",
                direction: "inbound",
                message_text: messageText,
                appointment_id: pendingAptId,
                ai_parsed_intent: "info_reply",
              });

              // Check if there are still pending issues
              const { data: apt } = await supabase
                .from("appointments")
                .select("*")
                .eq("id", pendingAptId)
                .single();

              const stillMissing = apt ? getValidationIssues(apt, staffNames) : [];

              let confirmMsg: string;
              if (stillMissing.length > 0) {
                confirmMsg = `✅ Updated: ${updatedFields}\n\n⚠️ Still need:\n${stillMissing.map((f, i) => `${i + 1}. ${f}`).join("\n")}\n\n❓ Please reply with the above.`;
              } else {
                confirmMsg = `✅ All good! Appointment for ${apt?.patient_name} on ${apt?.appointment_date} at ${apt?.appointment_time} is complete.\n• Service: ${apt?.service}\n• Booked by: ${apt?.booked_by}${apt?.special_instructions ? `\n• Notes: ${apt.special_instructions}` : ""}`;
              }

              await sendWatiMessage(senderPhone, confirmMsg);
              await supabase.from("whatsapp_messages").insert({
                phone: senderPhone,
                patient_name: senderName || "Team",
                direction: "outbound",
                message_text: confirmMsg,
                appointment_id: pendingAptId,
              });

              return new Response(
                JSON.stringify({ success: true, intent: "info_reply", appointment_id: pendingAptId, updates, still_missing: stillMissing }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        }
      }
    }

    // ============================================================
    // STEP 2: Check if this is a structured appointment booking message
    // ============================================================
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

      // Fetch valid booking staff names (reception/admin only, no doctors/nurses)
      const staffNames = await getBookingStaffNames(supabase);

      // Extract booked_by and validate against staff
      const bookedByMatch = messageText.match(/(?:booked\s*by|agent)\s*[:：]\s*(.+)/i);
      const rawBookedBy = bookedByMatch ? bookedByMatch[1].trim() : null;
      const bookedBy = rawBookedBy ? matchStaffName(rawBookedBy, staffNames) : null;

      // Extract special instructions
      const instrMatch = messageText.match(/(?:special\s*instruction|instruction|note|remark)\s*[:：]\s*(.+)/i);
      const specialInstructions = instrMatch ? instrMatch[1].trim() : null;

      // Validate time (10 AM - 10 PM)
      const timeValid = isValidClinicTime(appointmentData.time);
      
      // Validate date (today or future)
      const dateValid = !isPastDate(appointmentData.date);

      // Validate phone
      const phoneClean = appointmentData.phone.replace(/\s+/g, "").replace(/[^\d+]/g, "");
      const phoneValid = phoneClean.length >= 7;

      // Build validation issues
      const validationIssues: string[] = [];
      if (!timeValid) validationIssues.push(`⏰ Invalid time "${appointmentData.time}" — clinic hours are 10:00 AM to 10:00 PM. Please provide a valid time.`);
      if (!dateValid) validationIssues.push(`📅 The date ${appointmentData.date} is a past date. Please provide today's date or a future date.`);
      if (!phoneValid) validationIssues.push(`📱 Phone number "${appointmentData.phone}" looks invalid. Please provide a valid phone number.`);
      if (!rawBookedBy) {
        validationIssues.push(`👤 Who booked this appointment? Please reply with one of: ${staffNames.join(", ")}`);
      } else if (!bookedBy) {
        validationIssues.push(`👤 "${rawBookedBy}" is not a valid staff member. Please reply with one of: ${staffNames.join(", ")}`);
      }
      if (!appointmentData.service || appointmentData.service === "Consultation") {
        validationIssues.push("💉 What treatment/service is this for?");
      }

      // Create the appointment (even with issues, so we can update later)
      const { data: newApt, error: aptError } = await supabase
        .from("appointments")
        .insert({
          patient_name: appointmentData.name,
          phone: phoneValid ? phoneClean : appointmentData.phone,
          appointment_date: dateValid ? appointmentData.date : appointmentData.date,
          appointment_time: appointmentData.time,
          service: appointmentData.service,
          status: "upcoming",
          confirmation_status: "unconfirmed",
          booked_by: bookedBy || "WhatsApp",
          is_new_patient: false,
          special_instructions: specialInstructions,
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

      // Build confirmation reply
      let replyMsg = `✅ Appointment created:\n• Name: ${appointmentData.name}\n• Date: ${appointmentData.date}${!dateValid ? " ⚠️" : ""}\n• Time: ${appointmentData.time}${!timeValid ? " ⚠️" : ""}\n• Service: ${appointmentData.service}\n• Phone: ${appointmentData.phone}${!phoneValid ? " ⚠️" : ""}`;
      
      if (bookedBy) replyMsg += `\n• Booked by: ${bookedBy}`;
      if (specialInstructions) replyMsg += `\n• Special Instructions: ${specialInstructions}`;

      if (validationIssues.length > 0) {
        replyMsg += `\n\n⚠️ Issues found:\n${validationIssues.map((f, i) => `${i + 1}. ${f}`).join("\n")}\n\n❓ Please reply with the corrections.`;
      }

      const watiResult = await sendWatiMessage(senderPhone, replyMsg);
      console.log("WATI reply result:", JSON.stringify(watiResult));

      await supabase.from("whatsapp_messages").insert({
        phone: senderPhone,
        patient_name: senderName || "Team",
        direction: "outbound",
        message_text: replyMsg,
        appointment_id: newApt?.id,
      });

      return new Response(
        JSON.stringify({ success: true, intent: "booking", appointment_id: newApt?.id, issues: validationIssues }),
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
        // Auto-confirm (update DB only, do NOT send message to patient)
        await supabase
          .from("appointments")
          .update({
            confirmation_status: "confirmed_whatsapp",
            confirmed_at: new Date().toISOString(),
            last_reply: messageText,
          })
          .eq("id", appointment.id);

        // DISABLED: No auto-reply to patients
        // const reply = `Great! Your appointment is confirmed...`;
        // await sendWatiMessage(senderPhone, reply);

        console.log("Patient confirmed (no auto-reply sent):", appointment.patient_name);
      } else if (parsed.intent === "reschedule") {
        // Create pending request (no reply to patient)
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

        // DISABLED: No auto-reply to patients
        console.log("Patient wants to reschedule (no auto-reply sent):", appointment.patient_name);

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

        // DISABLED: No auto-reply to patients
        console.log("Patient wants to cancel (no auto-reply sent):", appointment.patient_name);

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
