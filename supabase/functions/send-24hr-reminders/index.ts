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
  const TEMPLATE_NAME = Deno.env.get("WATI_TEMPLATE_CONFIRMATION_24HR");

  if (!WATI_API_URL || !WATI_API_KEY || !TEMPLATE_NAME) {
    return new Response(
      JSON.stringify({ error: "WATI environment variables not configured" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Get tomorrow's date in YYYY-MM-DD
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    // Find appointments for tomorrow that haven't received 24hr reminder
    const { data: appointments, error: fetchErr } = await supabase
      .from("appointments")
      .select("*")
      .eq("appointment_date", tomorrowStr)
      .eq("reminder_24hr_sent", false)
      .neq("status", "cancelled");

    if (fetchErr) throw fetchErr;

    const results: { id: string; success: boolean; error?: string }[] = [];

    // DISABLED: Patient messaging is currently turned off
    // All reminders are paused - no messages sent to patients
    console.log(`Found ${(appointments || []).length} appointments for 24hr reminders, but patient messaging is DISABLED`);
    const results: { id: string; success: boolean; error?: string }[] = [];

    return new Response(
      JSON.stringify({
        processed: results.length,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-24hr-reminders:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
