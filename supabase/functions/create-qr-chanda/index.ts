import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { generateReceiptNo } from "../_shared/receipt.ts";

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
            if (req.method !== 'POST') {
                return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: corsHeaders });
            }

            let currentStep = 'initializing';
            try {
                currentStep = 'parsing body';
                const body = await req.json();
                const {
                    name, phone, total_amount, paid_amount, payment_mode,
                    donation_item, gotram, family_members, paidToUserId, paidToName, paidToPhone,
                    payment_proof_path, payment_proof_name, payment_proof_type
                } = body;

                if (!name || typeof name !== 'string' || name.trim() === '') {
                    return new Response(JSON.stringify({ success: false, error: 'Name is required' }), { status: 400, headers: corsHeaders });
                }
                if (!phone || typeof phone !== 'string' || phone.trim() === '') {
                    return new Response(JSON.stringify({ success: false, error: 'Valid Mobile Number is required' }), { status: 400, headers: corsHeaders });
                }

                const tAmt = Number(total_amount);
                const pAmt = Number(paid_amount);

                if (isNaN(tAmt) || isNaN(pAmt) || tAmt <= 0 || pAmt < 0 || pAmt > tAmt) {
                    return new Response(JSON.stringify({ success: false, error: 'Invalid amounts provided' }), { status: 400, headers: corsHeaders });
                }

                if (!paidToUserId) {
                    return new Response(JSON.stringify({ success: false, error: 'Paid To information required' }), { status: 400, headers: corsHeaders });
                }

                currentStep = 'Duplicate Protection Check';
                const now = Date.now();
                const fiveMinutesAgo = now - (5 * 60 * 1000);
                const { data: recentEntries, error: checkError } = await ctx.supabaseAdmin
                    .from('devotees')
                    .select('id')
                    .eq('phone', phone)
                    .gte('created_at', fiveMinutesAgo)
                    .limit(1);

                if (checkError) {
                    throw checkError;
                }

                if (recentEntries && recentEntries.length > 0) {
                    return new Response(JSON.stringify({ success: false, error: 'Duplicate submission detected. Please wait before submitting again.', code: 'DUPLICATE_ENTRY' }), { status: 429, headers: corsHeaders });
                }

                const year = new Date().getFullYear();
                currentStep = 'generating receipt and inserting devotee';
                const currentYearStr = year.toString().slice(-2);
                const prefix = `G${currentYearStr}-`;

                const { data: allDevotees } = await ctx.supabaseAdmin
                    .from('devotees')
                    .select('receipt_no')
                    .eq('year', year);

                const usedNumbers = new Set<number>();
                if (allDevotees) {
                    for (const d of allDevotees) {
                        if (d.receipt_no && typeof d.receipt_no === 'string' && d.receipt_no.startsWith(prefix)) {
                            const num = parseInt(d.receipt_no.replace(prefix, ''), 10);
                            if (!isNaN(num)) usedNumbers.add(num);
                        }
                    }
                }

                const pending = tAmt - pAmt;
                const finalStatus = pending === 0 ? 'PAID' : (pAmt > 0 ? 'PARTIAL' : 'UNPAID');

                let currentCount = 1;
                let receiptNo = '';
                let devoteeId = null;

                while (true) {
                    while (usedNumbers.has(currentCount)) {
                        currentCount++;
                    }
                    receiptNo = `${prefix}${currentCount.toString().padStart(3, '0')}`;

                    const devoteeData = {
                        name: name.trim(),
                        phone: phone.trim(),
                        total_amount: tAmt,
                        paid_amount: pAmt,
                        pending_amount: pending,
                        donation_item: donation_item || '',
                        payment_mode: payment_mode || 'Cash',
                        payment_status: finalStatus,
                        gotram: gotram ? gotram.trim() : '',
                        family_members: Array.isArray(family_members) ? family_members : [],
                        year: year,
                        volunteer_id: paidToUserId,
                        volunteer_name: paidToName || 'Portal',
                        volunteer_phone: paidToPhone || '',
                        created_at: now,
                        receipt_no: receiptNo
                    };

                    const { data: insertedDevotee, error: devoteeError } = await ctx.supabaseAdmin
                        .from('devotees')
                        .insert(devoteeData)
                        .select('id')
                        .single();

                    if (devoteeError) {
                        if (devoteeError.code === '23505' || String(devoteeError.message).toLowerCase().includes('duplicate') || String(devoteeError.message).toLowerCase().includes('unique')) {
                            usedNumbers.add(currentCount);
                            continue;
                        }
                        throw devoteeError;
                    }

                    devoteeId = insertedDevotee.id;
                    break;
                }

                currentStep = 'payment history';
                if (pAmt > 0) {
                    await ctx.supabaseAdmin.from('payment_histories').insert({
                        devotee_id: devoteeId,
                        amount: pAmt,
                        mode: payment_mode || 'Cash',
                        date: now,
                        volunteer_id: paidToUserId,
                        volunteer_name: paidToName || 'Portal',
                        year: year,
                        transaction_id: payment_proof_path || null
                    });
                }

                currentStep = 'vip gotram';
                const isVip = tAmt >= 1000 || (donation_item && donation_item.trim().length > 0);
                if (isVip && gotram && gotram.trim() && tAmt >= 1000) {
                    const { data: vipData } = await ctx.supabaseAdmin
                        .from('vip_gotrams')
                        .select('order')
                        .eq('year', year)
                        .order('order', { ascending: false })
                        .limit(1);

                    const maxOrder = vipData && vipData.length > 0 ? (vipData[0].order ?? 0) : 0;
                    await ctx.supabaseAdmin.from('vip_gotrams').insert({
                        gotram: gotram.trim(),
                        family_members: Array.isArray(family_members) ? family_members : [],
                        order: maxOrder + 1,
                        source: 'Chanda',
                        devotee_id: devoteeId,
                        year: year,
                        created_at: now,
                    });
                }

                currentStep = 'notification';
                const amountStr = new Intl.NumberFormat('en-IN').format(pAmt);
                await ctx.supabaseAdmin.from('notifications').insert({
                    type: 'QR CHANDA',
                    message: `${name.trim()} registered ₹${amountStr} by self and paid to ${paidToName || 'the Committee'}.\nReceipt: ${receiptNo}`,
                    amount: pAmt,
                    created_at: now,
                    created_by: paidToUserId,
                    created_by_name: paidToName || 'Portal',
                    audience_roles: ['superadmin', 'admin']
                });

                currentStep = 'success';
                return new Response(JSON.stringify({
                    success: true,
                    devoteeId,
                    receiptNo,
                    message: 'Registration created successfully!'
                }), {
                    status: 200,
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
            } catch (error: any) {
                console.error(`[create-qr-chanda ERROR] failed at step: ${currentStep}`, error);

                let actualErrorMsg = error.message || String(error);
                if (error.details) actualErrorMsg += ` | details: ${error.details}`;
                if (error.hint) actualErrorMsg += ` | hint: ${error.hint}`;

                return new Response(JSON.stringify({
                    success: false,
                    error: actualErrorMsg,
                    code: error.code || 'UNKNOWN',
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
