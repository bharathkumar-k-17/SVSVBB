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
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
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
          isPortal,
          paid_to_user_id,
          paid_to_name,
          paid_to_phone,
          payment_proof_path,
          payment_proof_name,
          payment_proof_type,
          payment_proof_uploaded_at,
          payment_proof_status
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

        // Enterprise Validation
        if (payment_mode === 'Cash' && !paid_to_user_id) {
          return new Response(JSON.stringify({ error: 'Paid To recipient is required for Cash payments' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        if (payment_mode === 'UPI' && !payment_proof_path) {
          return new Response(JSON.stringify({ error: 'Payment proof is required for UPI transactions' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // 8. Prevent duplicate submissions
        if (phone && typeof phone === 'string' && phone.length === 10) {
          const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);

          if (isPortal) {
            const { data: recentEntries, error: checkError } = await ctx.supabaseAdmin
              .from('public_chanda_requests')
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
          } else {
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
        }

        const pending = tAmt - pAmt;
        const finalStatus = payment_status || (pending === 0 ? 'PAID' : (pAmt > 0 ? 'PARTIAL' : 'UNPAID'));
        const now = Date.now();

        const finalVolunteerId = paid_to_user_id || volunteer_id || 'portal';
        const finalVolunteerName = paid_to_name || volunteer_name || 'Self (Portal)';
        const finalVolunteerPhone = paid_to_phone || volunteer_phone || phone || '';

        let devoteeId = null;
        let receiptNo = '';

        if (isPortal) {
          // If it's a portal submission, insert into public_chanda_requests
          const portalRequestData = {
            name,
            phone: phone || '',
            total_amount: tAmt,
            paid_amount: pAmt,
            pending_amount: pending,
            donation_item: donation_item || '',
            payment_mode: payment_mode || 'Cash',
            payment_proof_path: payment_proof_path || null,
            payment_proof_name: payment_proof_name || null,
            payment_proof_type: payment_proof_type || null,
            gotram: gotram ? `${gotram}${Array.isArray(family_members) && family_members.length > 0 ? ` - Family: ${family_members.join(', ')}` : ''}` : '',
            status: 'PENDING_REVIEW',
            created_at: created_at || now,
            updated_at: new Date(now).toISOString()
          };

          const { data: insertedRow, error: insertError } = await ctx.supabaseAdmin
            .from('public_chanda_requests')
            .insert(portalRequestData)
            .select('id')
            .single();

          if (insertError) {
            console.error('[CREATE CHANDA] DB error (public_chanda_requests):', insertError);
            throw insertError;
          }
          devoteeId = insertedRow.id;

          // Notifications for Portal
          const amountStr = new Intl.NumberFormat('en-IN').format(pAmt);
          const proofSnippet = payment_mode === 'UPI' ? '\nPayment proof submitted.' : '';
          const notifMessage = `${name} submitted a new QR Chanda Registration (₹${amountStr} via ${payment_mode}).${proofSnippet}\nRequires admin review.`;

          await ctx.supabaseAdmin.from('notifications').insert({
            type: 'QR CHANDA REVIEW',
            message: notifMessage,
            amount: pAmt > 0 ? pAmt : 0,
            created_at: now,
            created_by: 'portal',
            created_by_name: name || 'Unknown Portal User',
            audience_roles: ['superadmin', 'admin'],
          });
        } else {
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

          if (insertError) {
            console.error('[CREATE CHANDA] DB error (devotees):', insertError);
            throw insertError;
          }
          devoteeId = insertedRow.id;

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
        }

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
        console.error("[CREATE CHANDA] error:", error);
        return new Response(JSON.stringify({
          error: 'CREATE_CHANDA_ERROR',
          message: error.message || 'Internal Server Error'
        }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    });

    return handler(req);
  }
};
