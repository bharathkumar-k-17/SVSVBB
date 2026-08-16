import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { generateReceiptNo, getDynamicReceiptPrefix } from "../_shared/receipt.ts";

export default {
  async fetch(req: Request) {
    const origin = req.headers.get('Origin') || '';
    const allowedOrigins = ['http://localhost:5173', 'https://svsvbb.vercel.app'];
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

    const corsHeaders = {
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, PUT, DELETE',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    };

    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders, status: 200 });
    }

    // We wrap the actual logic in withSupabase to get ctx.supabaseAdmin
    const handler = withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
      if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
      }

      let currentStep = 'initializing';
      try {
        currentStep = 'parsing body';
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
          paid_to_user_id,
          paid_to_name,
          paid_to_phone,
          payment_proof_path,
          payment_proof_name,
          payment_proof_type,
          payment_proof_uploaded_at,
          payment_proof_status
        } = body;

        // 1. Safe Temporary Logging
        console.log("--- INCOMING SUBMISSION ---");
        console.log("Name:", name);
        console.log("Phone length:", phone ? phone.length : 0);
        console.log("Total:", total_amount, "Paid:", paid_amount);
        console.log("Mode:", payment_mode);
        console.log("Paid To ID:", paid_to_user_id);
        console.log("Proof path length:", payment_proof_path ? payment_proof_path.length : 'none');

        // 2. Validate fields
        if (!name || typeof name !== 'string') {
          console.log("Validation Failed: Empty or invalid Name");
          return new Response(JSON.stringify({ error: 'Name is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const tAmt = Number(total_amount);
        const pAmt = Number(paid_amount);

        if (isNaN(tAmt) || isNaN(pAmt) || tAmt < 0 || pAmt < 0 || pAmt > tAmt) {
          console.log("Validation Failed: Invalid amounts", { tAmt, pAmt });
          return new Response(JSON.stringify({ error: `Invalid amounts. tAmt: ${tAmt}, pAmt: ${pAmt}` }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Enterprise Validation
        if (payment_mode === 'Cash' && !paid_to_user_id) {
          console.log("Validation Failed: Cash mode but no paid_to_user_id");
          return new Response(JSON.stringify({ error: 'Paid To recipient is required for Cash payments' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (payment_mode === 'UPI' && !payment_proof_path) {
          console.log("Validation Failed: UPI mode but no proof path");
          return new Response(JSON.stringify({ error: 'Payment proof is required for UPI transactions' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // 8. Prevent duplicate submissions
        if (phone && typeof phone === 'string' && phone.length === 10) {
          const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

          
            const { data: recentEntries, error: checkError  = await ctx.supabaseAdmin
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
        }

        const pending = tAmt - pAmt;
        const finalStatus = payment_status || (pending === 0 ? 'PAID' : (pAmt > 0 ? 'PARTIAL' : 'UNPAID'));
        const now = Date.now();

        const finalVolunteerId = paid_to_user_id || volunteer_id || 'admin';
        const finalVolunteerName = paid_to_name || volunteer_name || 'Self (Portal)';
        const finalVolunteerPhone = paid_to_phone || volunteer_phone || phone || '';

        let devoteeId = null;
        let receiptNo = '';

        currentStep = 'generating receipt number';
          // Normal flow
          // Generate Receipt Number
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
          receiptNo = generateReceiptNo(currentCount);

          currentStep = 'inserting devotee';
          // Insert the devotee into the "devotees" table using ctx.supabaseAdmin
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
            volunteer_id: finalVolunteerId,
            volunteer_name: finalVolunteerName,
            volunteer_phone: finalVolunteerPhone,
            created_at: created_at || now,
            receipt_no: receiptNo,
            paid_to_user_id: paid_to_user_id || null,
            paid_to_name: paid_to_name || null,
            paid_to_phone: paid_to_phone || null,
            payment_proof_path: payment_proof_path || null,
            payment_proof_name: payment_proof_name || null,
            payment_proof_type: payment_proof_type || null,
            payment_proof_uploaded_at: payment_proof_uploaded_at || null,
            payment_proof_status: payment_proof_status || null,
          };

          const { data: insertedRow, error: insertError } = await ctx.supabaseAdmin
            .from('devotees')
            .insert(devoteeData)
            .select('id')
            .single();

          if (insertError) throw insertError;
          devoteeId = insertedRow.id;

          currentStep = 'inserting payment history';
          // Payment history
          if (pAmt > 0) {
            await ctx.supabaseAdmin.from('payment_histories').insert({
              devotee_id: devoteeId,
              amount: pAmt,
              mode: payment_mode || 'Cash',
              date: now,
              volunteer_id: finalVolunteerId,
              volunteer_name: finalVolunteerName,
              year: year || new Date().getFullYear(),
              transaction_id: payment_proof_path || null
            });
          }

          currentStep = 'inserting VIP gotram';
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

          currentStep = 'inserting notification';
          // Notifications
          const amountStr = new Intl.NumberFormat('en-IN').format(pAmt);
          const paidToSnippet = paid_to_name ? `\nPaid To: ${paid_to_name}.` : '';
          const proofSnippet = payment_mode === 'UPI' ? '\nPayment proof submitted.' : '';

          const notifType = 'CHANDA ENTRY';
          const notifMessage = `${volunteer_name || 'Volunteer'} added ₹${amountStr} Chanda from ${name || 'Unknown'}.${paidToSnippet}${proofSnippet}`;

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
        currentStep = 'success';
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
        console.error(`[create-chanda ERROR] failed at step: ${currentStep}`, error);
        return new Response(JSON.stringify({
          error: error.message || String(error),
          step: currentStep
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    });

    return handler(req);
  }
};
