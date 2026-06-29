import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });
  try {
    const { email, password } = await req.json();
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { data: list } = await supabase.auth.admin.listUsers();
    let user = list?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());

    if (user) {
      const { error } = await supabase.auth.admin.updateUserById(user.id, { password, email_confirm: true });
      if (error) throw error;
    } else {
      const { data, error } = await supabase.auth.admin.createUser({ email, password, email_confirm: true });
      if (error) throw error;
      user = data.user;
    }

    // Relink staff record to new/current auth user
    const { error: staffErr } = await supabase
      .from('staff')
      .update({ user_id: user!.id, status: 'active' })
      .eq('email', email);
    if (staffErr) throw staffErr;

    return new Response(JSON.stringify({ success: true, user_id: user!.id, email }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : String(e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500,
    });
  }
});
