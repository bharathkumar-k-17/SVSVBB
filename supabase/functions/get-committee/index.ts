import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

export default {
  async fetch(req: Request) {
    const origin = req.headers.get('Origin') || '';
    const allowedOrigins = ['http://localhost:5173', 'https://svsvbb.vercel.app'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    const corsHeaders = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };

    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders, status: 200 });
    }

    const handler = withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
      try {
        const { data: users, error } = await ctx.supabaseAdmin
          .from('users')
          .select('id, name, phone')
          .in('role', ['superadmin', 'admin', 'volunteer'])
          .eq('status', 'approved')
          .order('name');

        if (error) throw error;

        return new Response(JSON.stringify({ success: true, users }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      } catch (err: any) {
        return new Response(JSON.stringify({ success: false, error: err.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    });

    return handler(req);
  }
};
