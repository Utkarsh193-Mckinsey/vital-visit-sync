import { createClient } from "@supabase/supabase-js";
import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";

function supabaseForUser(ctx: ToolContext) {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export default defineTool({
  name: "today_schedule",
  title: "Today's schedule",
  description: "Return today's appointments (UAE date) for the clinic. Respects the signed-in staff member's access.",
  inputSchema: {
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .describe("Optional YYYY-MM-DD date. Defaults to today in UAE time (+4)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ date }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const uaeToday = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const day = date ?? uaeToday;

    const { data, error } = await supabaseForUser(ctx)
      .from("appointments")
      .select("id, patient_name, phone, appointment_date, appointment_time, status, confirmation_status")
      .eq("appointment_date", day)
      .order("appointment_time", { ascending: true });

    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [
        { type: "text", text: `Appointments for ${day}: ${data?.length ?? 0}\n${JSON.stringify(data ?? [], null, 2)}` },
      ],
      structuredContent: { date: day, appointments: data ?? [] },
    };
  },
});
