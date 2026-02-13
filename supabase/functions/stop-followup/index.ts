import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    const { phone, appointment_id } = await req.json();

    // Find active follow-ups for this phone/appointment
    let query = supabase
      .from("appointments")
      .select("id")
      .eq("status", "no_show")
      .eq("followup_status", "active");

    if (appointment_id) {
      query = query.eq("id", appointment_id);
    } else if (phone) {
      const phoneVariants = [phone, `+${phone.replace(/^\+/, "")}`, phone.replace(/^\+/, "")];
      query = query.in("phone", phoneVariants);
    } else {
      return new Response(JSON.stringify({ error: "phone or appointment_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: apts, error } = await query;
    if (error) throw error;

    let stopped = 0;
    for (const apt of apts || []) {
      await supabase
        .from("appointments")
        .update({ followup_status: "stopped" })
        .eq("id", apt.id);
      stopped++;
    }

    return new Response(JSON.stringify({ success: true, stopped }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in stop-followup:", error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
