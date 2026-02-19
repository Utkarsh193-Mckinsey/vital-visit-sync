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

  const WATI_API_URL = Deno.env.get("WATI_API_URL");
  const WATI_API_KEY = Deno.env.get("WATI_API_KEY");

  if (!WATI_API_URL || !WATI_API_KEY) {
    return new Response(
      JSON.stringify({ error: "WATI not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const { action, template } = await req.json();

    if (action === "list") {
      const res = await fetch(
        `${WATI_API_URL}/api/v1/getMessageTemplates?pageSize=100&pageNumber=0`,
        {
          headers: { Authorization: `Bearer ${WATI_API_KEY}` },
        }
      );
      const data = await res.json();
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "create") {
      if (!template?.name || !template?.body || !template?.category) {
        return new Response(
          JSON.stringify({ error: "Missing template name, body, or category" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const payload: Record<string, unknown> = {
        type: "template",
        category: template.category,
        elementName: template.name,
        language: template.language || "en",
        body: template.body,
        allowCategoryChange: true,
      };
      const extraKeys = ["customParams", "bodyExamples", "parameterFormat", "header", "footer", "buttons", "buttonsType", "subCategory", "creationMethod"];
      for (const key of extraKeys) {
        if (template[key] !== undefined) payload[key] = template[key];
      }

      const res = await fetch(
        `${WATI_API_URL}/api/v1/whatsApp/templates`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${WATI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const text = await res.text();
      console.log("WATI create template response:", res.status, text);

      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      return new Response(JSON.stringify({ success: res.ok, status: res.status, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Invalid action. Use 'list' or 'create'" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Error in manage-wati-templates:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
