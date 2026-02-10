import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { frontImage, backImage } = await req.json();

    if (!frontImage) {
      return new Response(
        JSON.stringify({ error: "Front image is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const content: any[] = [
      {
        type: "text",
        text: `Extract all information from this UAE Emirates ID card. Return a JSON object with these fields:
- full_name: The person's full name in English
- date_of_birth: Date of birth in YYYY-MM-DD format
- emirates_id: The Emirates ID number (format: 784-XXXX-XXXXXXX-X)
- nationality: Nationality
- gender: Gender (Male/Female)
- expiry_date: Card expiry date in YYYY-MM-DD format

If any field is not visible or readable, set it to null. Return ONLY the JSON object, no other text.`,
      },
      {
        type: "image_url",
        image_url: { url: frontImage },
      },
    ];

    if (backImage) {
      content[0].text += "\n\nA back side image is also provided. Extract any additional information like address if visible.";
      content.push({
        type: "image_url",
        image_url: { url: backImage },
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI Gateway error:", errorText);
      throw new Error(`AI Gateway error: ${response.status}`);
    }

    const data = await response.json();
    const rawText = data.choices?.[0]?.message?.content || "";

    // Extract JSON from the response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("Could not parse JSON from AI response:", rawText);
      return new Response(
        JSON.stringify({ error: "Could not extract data from image", raw: rawText }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const extracted = JSON.parse(jsonMatch[0]);

    return new Response(
      JSON.stringify({ success: true, data: extracted }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
