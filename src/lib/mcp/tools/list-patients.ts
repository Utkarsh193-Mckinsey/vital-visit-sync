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
  name: "list_patients",
  title: "List patients",
  description: "List patients from the clinic, most recent first. Respects the signed-in staff member's access.",
  inputSchema: {
    search: z.string().optional().describe("Optional name / phone / ID substring filter."),
    limit: z.number().int().min(1).max(100).optional().describe("Max rows to return (default 20)."),
  },
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ search, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("patients")
      .select("id, first_name, last_name, phone, emirates_id, nationality, created_date")
      .order("created_date", { ascending: false })
      .limit(limit ?? 20);

    if (search && search.trim().length > 0) {
      const s = search.trim();
      q = q.or(
        `first_name.ilike.%${s}%,last_name.ilike.%${s}%,phone.ilike.%${s}%,emirates_id.ilike.%${s}%`,
      );
    }

    const { data, error } = await q;
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { patients: data ?? [] },
    };
  },
});
