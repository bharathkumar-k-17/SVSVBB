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
    
    const handler = withSupabase({ auth: ["publishable", "secret"] }, async (req, ctx) => {
      if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
      }

      try {
        const body = await req.json();
        const {
          request_id,
          action, // 'ACCEPT' or 'REJECT'
          rejection_reason,
          reviewer_id,
          reviewer_name,
          reviewer_phone
        } = body;

        if (!request_id || !action || !reviewer_id) {
          return new Response(JSON.stringify({ error: 'Missing required fields' }), { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        // Fetch the pending request
        const { data: qrRequest, error: fetchError } = await ctx.supabaseAdmin
          .from('public_chanda_requests')
          .select('*')
          .eq('id', request_id)
          .single();

        if (fetchError || !qrRequest) {
          return new Response(JSON.stringify({ error: 'Request not found' }), { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        if (qrRequest.status !== 'PENDING_REVIEW') {
          return new Response(JSON.stringify({ error: 'Request is already processed' }), { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        const now = Date.now();
        const currentDate = new Date(now).toISOString();

        if (action === 'REJECT') {
          // Update request to REJECTED
          const { error: rejectError } = await ctx.supabaseAdmin
            .from('public_chanda_requests')
            .update({
              status: 'REJECTED',
              reviewed_by: reviewer_id,
              reviewed_by_name: reviewer_name,
              reviewed_by_phone: reviewer_phone,
              reviewed_at: currentDate,
              rejection_reason: rejection_reason || null,
              updated_at: currentDate
            })
            .eq('id', request_id);

          if (rejectError) throw rejectError;

          // Notification for Rejection
          await ctx.supabaseAdmin.from('notifications').insert({
            type: 'QR CHANDA REVIEW',
            message: `QR Chanda Request from ${qrRequest.name} was REJECTED by ${reviewer_name}. Reason: ${rejection_reason || 'None provided'}`,
            amount: 0,
            created_at: now,
            created_by: reviewer_id,
            created_by_name: reviewer_name,
            audience_roles: ['superadmin', 'admin'],
          });

          return new Response(JSON.stringify({ success: true, message: 'Request rejected successfully' }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        if (action === 'ACCEPT') {
          // 1. Generate Receipt Number
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
          const currentYear = new Date().getFullYear();
          
          const tAmt = Number(qrRequest.total_amount) || 0;
          const pAmt = Number(qrRequest.paid_amount) || 0;
          const pending = tAmt - pAmt;
          const finalStatus = pending === 0 ? 'PAID' : (pAmt > 0 ? 'PARTIAL' : 'UNPAID');

          // 2. Insert the devotee
          const devoteeData = {
            name: qrRequest.name,
            phone: qrRequest.phone || '',
            total_amount: tAmt,
            paid_amount: pAmt,
            pending_amount: pending,
            donation_item: qrRequest.donation_item || '',
            payment_mode: qrRequest.payment_mode || 'Cash',
            payment_status: finalStatus,
            gotram: qrRequest.gotram || '',
            family_members: Array.isArray(qrRequest.family_members) ? qrRequest.family_members : [],
            year: currentYear,
            volunteer_id: reviewer_id,
            volunteer_name: reviewer_name,
            volunteer_phone: reviewer_phone,
            created_at: now,
            receipt_no: receiptNo,
            payment_proof_path: qrRequest.payment_proof_path || null,
            payment_proof_name: qrRequest.payment_proof_name || null,
            payment_proof_type: qrRequest.payment_proof_type || null,
            payment_proof_status: qrRequest.payment_proof_path ? 'UPI_PAYMENT_PROOF_VERIFIED' : null,
          };

          const { data: insertedDevotee, error: devoteeError } = await ctx.supabaseAdmin
            .from('devotees')
            .insert(devoteeData)
            .select('id')
            .single();

          if (devoteeError) throw devoteeError;
          const devoteeId = insertedDevotee.id;

          // 3. Update the request status
          const { error: acceptError } = await ctx.supabaseAdmin
            .from('public_chanda_requests')
            .update({
              status: 'ACCEPTED',
              reference_number: receiptNo,
              reviewed_by: reviewer_id,
              reviewed_by_name: reviewer_name,
              reviewed_by_phone: reviewer_phone,
              reviewed_at: currentDate,
              updated_at: currentDate
            })
            .eq('id', request_id);

          if (acceptError) throw acceptError;

          // 4. Payment history
          if (pAmt > 0) {
            await ctx.supabaseAdmin.from('payment_histories').insert({
              devotee_id: devoteeId,
              amount: pAmt,
              mode: qrRequest.payment_mode || 'Cash',
              date: now,
              volunteer_id: reviewer_id,
              volunteer_name: reviewer_name,
              year: currentYear,
              transaction_id: qrRequest.payment_proof_path || null
            });
          }

          // 5. VIP Gotram
          const isVip = tAmt >= 1000 || (qrRequest.donation_item && qrRequest.donation_item.trim().length > 0);
          if (isVip && qrRequest.gotram && qrRequest.gotram.trim() && tAmt >= 1000) {
            const { data: vipData } = await ctx.supabaseAdmin
              .from('vip_gotrams')
              .select('order')
              .eq('year', currentYear)
              .order('order', { ascending: false })
              .limit(1);

            const maxOrder = vipData && vipData.length > 0 ? (vipData[0].order ?? 0) : 0;
            await ctx.supabaseAdmin.from('vip_gotrams').insert({
              gotram: qrRequest.gotram.trim(),
              family_members: Array.isArray(qrRequest.family_members) ? qrRequest.family_members : [],
              order: maxOrder + 1,
              source: 'Chanda',
              devotee_id: devoteeId,
              year: currentYear,
              created_at: now,
            });
          }

          // 6. Notification
          const amountStr = new Intl.NumberFormat('en-IN').format(pAmt);
          await ctx.supabaseAdmin.from('notifications').insert({
            type: 'QR CHANDA REVIEW',
            message: `QR Chanda Request from ${qrRequest.name} for ₹${amountStr} was ACCEPTED by ${reviewer_name}. Receipt: ${receiptNo}`,
            amount: pAmt > 0 ? pAmt : 0,
            created_at: now,
            created_by: reviewer_id,
            created_by_name: reviewer_name,
            audience_roles: ['superadmin', 'admin'],
          });

          return new Response(JSON.stringify({ 
            success: true, 
            message: 'Request accepted successfully',
            devoteeId,
            receiptNo
          }), { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          });
        }

        return new Response(JSON.stringify({ error: 'Invalid action' }), { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });

      } catch (error: any) {
        console.error("Error in review-qr-chanda function:", error);
        return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }
    });

    return handler(req);
  }
};
