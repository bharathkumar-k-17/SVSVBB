import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { generateReceiptNo, getDynamicReceiptPrefix } from "../_shared/receipt.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export default {
  async fetch(req: Request) {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }
    
    // We wrap the actual logic in withSupabase to get ctx.supabaseAdmin
    const handler = withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
      if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      try {
        const body = await req.json();
        const {
          name,
          total_amount,
          paid_amount,
          payment_mode,
          payment_status,
          phone,
          gotram,
          family_members,
          donation_item,
          year,
          volunteer_id,
          volunteer_name,
          volunteer_phone,
          created_at,
          isPortal
        } = body;

        // 2. Validate fields
        if (!name || typeof name !== 'string') {
          return new Response(JSON.stringify({ error: 'Name is required' }), { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        const tAmt = Number(total_amount) || 0;
        const pAmt = Number(paid_amount) || 0;
        
        if (tAmt < 0 || pAmt < 0 || pAmt > tAmt) {
          return new Response(JSON.stringify({ error: 'Invalid amounts' }), { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        // 8. Prevent duplicate submissions
        if (phone && typeof phone === 'string' && phone.length === 10) {
          const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
          const { data: recentEntries, error: checkError } = await ctx.supabaseAdmin
            .from('devotees')
            .select('id')
            .eq('phone', phone)
            .gte('created_at', fiveMinutesAgo)
            .limit(1);

          if (checkError) throw checkError;
          if (recentEntries && recentEntries.length > 0) {
            return new Response(JSON.stringify({ error: 'Please wait a few minutes before submitting again.' }), { 
              status: 429, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            });
          }
        }

        // 3. Generate Receipt Number
        const currentYearStr = new Date().getFullYear().toString().slice(-2);
        const counterKey = `receipt_${currentYearStr}`;
        const { data: existing } = await ctx.supabaseAdmin.from('counters').select('count').eq('id', counterKey).single();
        let currentCount = 1;
        if (existing) {
          currentCount = (existing.count || 0) + 1;
          await ctx.supabaseAdmin.from('counters').update({ count: currentCount }).eq('id', counterKey);
        } else {
          await ctx.supabaseAdmin.from('counters').insert({ id: counterKey, count: 1 });
        }
        const receiptNo = generateReceiptNo(currentCount);

        const pending = tAmt - pAmt;
        const finalStatus = payment_status || (pending === 0 ? 'PAID' : (pAmt > 0 ? 'PARTIAL' : 'UNPAID'));
        const now = Date.now();

        // 4. Insert the devotee into the "devotees" table using ctx.supabaseAdmin
        const devoteeData = {
          name,
          phone: phone || '',
          total_amount: tAmt,
          paid_amount: pAmt,
          pending_amount: pending,
          donation_item: donation_item || '',
          payment_mode: payment_mode || 'Cash',
          payment_status: finalStatus,
          gotram: gotram || '',
          family_members: Array.isArray(family_members) ? family_members : [],
          year: year || new Date().getFullYear(),
          volunteer_id: volunteer_id || 'portal',
          volunteer_name: volunteer_name || 'Self (Portal)',
          volunteer_phone: volunteer_phone || (phone || ''),
          created_at: submissionDate.getTime(),
          receipt_no: receiptNo,
        };

        const { data: insertedRow, error: insertError } = await ctx.supabaseAdmin
          .from('devotees')
          .insert(devoteeData)
          .select('id')
          .single();

        if (insertError) throw insertError;
        const devoteeId = insertedRow.id;

        // Payment history
        if (pAmt > 0) {
          await ctx.supabaseAdmin.from('payment_histories').insert({
            devotee_id: devoteeId,
            amount: pAmt,
            mode: payment_mode || 'Cash',
            date: now,
            volunteer_id: volunteer_id || 'portal',
            volunteer_name: volunteer_name || 'Self (Portal)',
            year: year || new Date().getFullYear(),
          });
        }

        // VIP Gotram
        const isVip = tAmt >= 1000 || (donation_item && donation_item.trim().length > 0);
        if (isVip && gotram && gotram.trim() && tAmt >= 1000) {
          const { data: vipData } = await ctx.supabaseAdmin
            .from('vip_gotrams')
            .select('order')
            .eq('year', year || new Date().getFullYear())
            .order('order', { ascending: false })
            .limit(1);

          const maxOrder = vipData && vipData.length > 0 ? (vipData[0].order ?? 0) : 0;
          await ctx.supabaseAdmin.from('vip_gotrams').insert({
            gotram: gotram.trim(),
            family_members: Array.isArray(family_members) ? family_members : [],
            order: maxOrder + 1,
            source: 'Chanda',
            devotee_id: devoteeId,
            year: year || new Date().getFullYear(),
            created_at: now,
          });
        }

        // Notifications
        const amountStr = new Intl.NumberFormat('en-IN').format(pAmt);
        let notifType = '';
        let notifMessage = '';
        if (isPortal) {
          if (pAmt > 0) {
            notifType = 'QR PORTAL · CHANDA';
            notifMessage = `${name} submitted ₹${amountStr} Chanda via ${payment_mode}.`;
          } else {
            notifType = 'QR PORTAL · REGISTRATION';
            notifMessage = `${name} completed a new registration.`;
          }
        } else {
          notifType = 'CHANDA ENTRY';
          notifMessage = `${volunteer_name || 'Volunteer'} added ₹${amountStr} Chanda from ${name || 'Unknown'}.`;
        }

        await ctx.supabaseAdmin.from('notifications').insert({
          type: notifType,
          message: notifMessage,
          amount: pAmt > 0 ? pAmt : 0,
          created_at: now,
          created_by: volunteer_id || 'portal',
          created_by_name: volunteer_name || name || 'Unknown Portal User',
          audience_roles: ['superadmin', 'admin'],
        });

        // 6. Return JSON success response
        return new Response(JSON.stringify({
          success: true,
          devoteeId,
          receiptNo,
          message: 'Submission successful'
        }), { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });

      } catch (error: any) {
        console.error("Error in create-chanda function:", error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    });

    return handler(req);
  }
};
