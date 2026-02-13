import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const watiApiKey = Deno.env.get("WATI_API_KEY");
    const watiApiUrl = Deno.env.get("WATI_API_URL");
    const adminPhone = Deno.env.get("ADMIN_PHONE_NUMBER");

    const supabase = createClient(supabaseUrl, supabaseKey);

    // UAE time: UTC+4
    const uaeOffset = 4 * 60 * 60 * 1000;
    const now = new Date();
    const uaeNow = new Date(now.getTime() + uaeOffset);
    const todayStr = uaeNow.toISOString().split("T")[0];
    const tomorrow = new Date(uaeNow);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    // Fetch stats in parallel
    const [todayCompletedRes, noShowRes, cancelRes, tomorrowRes, tomorrowConfRes, pendingRes] = await Promise.all([
      supabase.from("appointments").select("id", { count: "exact", head: true })
        .eq("appointment_date", todayStr).in("status", ["completed", "upcoming"]),
      supabase.from("appointments").select("id", { count: "exact", head: true })
        .eq("appointment_date", todayStr).eq("status", "no_show"),
      supabase.from("appointments").select("id", { count: "exact", head: true })
        .eq("appointment_date", todayStr).eq("status", "cancelled"),
      supabase.from("appointments").select("id", { count: "exact", head: true })
        .eq("appointment_date", tomorrowStr).neq("status", "cancelled"),
      supabase.from("appointments").select("id", { count: "exact", head: true })
        .eq("appointment_date", tomorrowStr)
        .in("confirmation_status", ["confirmed_whatsapp", "confirmed_call", "double_confirmed"]),
      supabase.from("pending_requests").select("id", { count: "exact", head: true })
        .eq("status", "pending"),
    ]);

    const seen = todayCompletedRes.count || 0;
    const noShows = noShowRes.count || 0;
    const cancellations = cancelRes.count || 0;
    const tomorrowTotal = tomorrowRes.count || 0;
    const tomorrowConfirmed = tomorrowConfRes.count || 0;
    const confirmPct = tomorrowTotal > 0 ? Math.round((tomorrowConfirmed / tomorrowTotal) * 100) : 0;
    const pending = pendingRes.count || 0;
    const unconfirmed = tomorrowTotal - tomorrowConfirmed;

    const message = [
      `*Cosmique Daily Summary* 📊`,
      ``,
      `*Today:* ${seen} patients seen, ${noShows} no-show${noShows !== 1 ? "s" : ""}, ${cancellations} cancellation${cancellations !== 1 ? "s" : ""}`,
      `*Tomorrow:* ${tomorrowTotal} appointments, ${tomorrowConfirmed} confirmed (${confirmPct}%), ${unconfirmed} pending`,
      `*Pending Requests:* ${pending} need your attention`,
    ].join("\n");

    console.log("Daily summary:", message);

    // Send via WATI if configured
    if (watiApiKey && watiApiUrl && adminPhone) {
      try {
        await fetch(`${watiApiUrl}/api/v1/sendSessionMessage/${adminPhone}?messageText=${encodeURIComponent(message)}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${watiApiKey}`,
            "Content-Type": "application/json",
          },
        });
        console.log("Daily summary sent to admin via WATI");
      } catch (e) {
        console.error("Failed to send WATI daily summary:", e);
      }
    } else {
      console.log("WATI not configured, skipping WhatsApp notification");
    }

    return new Response(JSON.stringify({ success: true, message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
