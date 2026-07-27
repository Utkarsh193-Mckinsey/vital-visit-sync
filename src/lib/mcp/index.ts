import { auth, defineMcp } from "@lovable.dev/mcp-js";
import echoTool from "./tools/echo";
import listPatientsTool from "./tools/list-patients";
import todayScheduleTool from "./tools/today-schedule";

// Build the OAuth issuer from the project ref so it matches the direct
// supabase.co host published by the discovery document (RFC 8414 §3.3).
// VITE_SUPABASE_PROJECT_ID is inlined at build time by Vite.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "cosmique-clinic-mcp",
  title: "Cosmique Clinic MCP",
  version: "0.1.0",
  instructions:
    "Tools for the Cosmique Aesthetics & Dermatology clinic management system. Use `echo` to verify connectivity, `list_patients` to search clinic patients, and `today_schedule` to view scheduled appointments. All tools act as the signed-in staff member and respect the app's data access rules.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [echoTool, listPatientsTool, todayScheduleTool],
});
