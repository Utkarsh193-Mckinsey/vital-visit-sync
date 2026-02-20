import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const WATI_API_URL = Deno.env.get("WATI_API_URL");
  const WATI_API_KEY = Deno.env.get("WATI_API_KEY");
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { phone, message, patient_name, template_name, parameters, broadcast_name } = await req.json();

    if (!phone) {
      return new Response(JSON.stringify({ error: "Missing phone" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send via WATI
    if (!WATI_API_URL || !WATI_API_KEY) {
      return new Response(JSON.stringify({ error: "WATI not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleanPhone = phone.replace(/^\+/, "");
    let watiRes;
    let logMessage = message || "";

    if (template_name) {
      // Send template message (works outside 24hr window)
      // broadcast_name must be unique per send to avoid WATI rejections
      const uniqueBroadcastName = broadcast_name || `cosmique_${Date.now()}`;
      const templateBody = {
        template_name,
        broadcast_name: uniqueBroadcastName,
        parameters: parameters || [],
      };
      console.log("Sending WATI template:", JSON.stringify(templateBody));
      watiRes = await fetch(
        `${WATI_API_URL}/api/v1/sendTemplateMessage/${cleanPhone}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${WATI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(templateBody),
        }
      );
      logMessage = `[Template: ${template_name}] ${(parameters || []).map((p: any) => `${p.name}=${p.value}`).join(", ")}`;
    } else {
      if (!message) {
        return new Response(JSON.stringify({ error: "Missing message" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Send session message (only works within 24hr window)
      watiRes = await fetch(
        `${WATI_API_URL}/api/v1/sendSessionMessage/${cleanPhone}?messageText=${encodeURIComponent(message)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${WATI_API_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const watiText = await watiRes.text();
    console.log("WATI send response status:", watiRes.status);
    console.log("WATI send response body:", watiText);

    if (!watiRes.ok) {
      console.error("WATI API error body:", watiText);
      return new Response(JSON.stringify({ error: `WATI API error ${watiRes.status}: ${watiText}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log outbound message
    await supabase.from("whatsapp_messages").insert({
      phone: cleanPhone,
      patient_name: patient_name || null,
      direction: "outbound",
      message_text: logMessage,
    });

    return new Response(JSON.stringify({ success: true, wati_response: watiText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
