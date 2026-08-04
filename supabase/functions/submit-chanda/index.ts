import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.11.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // Initialize Supabase client with the Service Role key to bypass RLS
    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      }
    });

    const body = await req.json();
    const { 
      name, 
      phone, 
      totalAmount, 
      paidAmount, 
      donationItem, 
      paymentMode, 
      gotram, 
      familyMembers, 
      year, 
      date 
    } = body;

    // 1. Validation
    if (!name || typeof name !== 'string') {
      return new Response(JSON.stringify({ error: 'Name is required' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    const tAmt = Number(totalAmount) || 0;
    const pAmt = Number(paidAmount) || 0;

    if (tAmt < 0 || pAmt < 0 || pAmt > tAmt) {
      return new Response(JSON.stringify({ error: 'Invalid amounts' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    // 2. Spam / Duplicate Protection (Rate Limiting based on phone number and time)
    if (phone && typeof phone === 'string' && phone.length === 10) {
      const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
      
      const { data: recentEntries, error: checkError } = await supabase
        .from('devotees')
        .select('id')
        .eq('phone', phone)
        .gte('created_at', fiveMinutesAgo)
        .limit(1);

      if (checkError) throw checkError;
      
      if (recentEntries && recentEntries.length > 0) {
        return new Response(JSON.stringify({ error: 'Please wait a few minutes before submitting again.' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 429 });
      }
    }

    // 3. Generate Receipt Number
    const submissionDate = date ? new Date(date) : new Date();
    const yy = submissionDate.getFullYear().toString().slice(-2);
    const mm = (submissionDate.getMonth() + 1).toString().padStart(2, '0');
    const dd = submissionDate.getDate().toString().padStart(2, '0');
    const dateStr = `${yy}${mm}${dd}`;

    let receiptNo = `G${dateStr}${Date.now().toString().slice(-4)}`; // Fallback

    const { data: rpcData, error: rpcError } = await supabase.rpc('generate_receipt_no', {
      date_str: dateStr,
    });

    if (!rpcError && rpcData) {
      receiptNo = rpcData;
    } else {
      // Fallback manual counter if RPC fails
      const counterKey = `receipt_${dateStr}`;
      const { data: existing } = await supabase.from('counters').select('count').eq('id', counterKey).single();
      let currentCount = 1;
      if (existing) {
        currentCount = (existing.count || 0) + 1;
        await supabase.from('counters').update({ count: currentCount }).eq('id', counterKey);
      } else {
        await supabase.from('counters').insert({ id: counterKey, count: 1 });
      }
      receiptNo = `G${dateStr}${currentCount.toString().padStart(3, '0')}`;
    }

    // 4. Insert Devotee
    const pending = tAmt - pAmt;
    const status = pending === 0 ? 'PAID' : (pAmt > 0 ? 'PARTIAL' : 'UNPAID');
    const now = Date.now();

    const devoteeData = {
      name,
      phone: phone || '',
      total_amount: tAmt,
      paid_amount: pAmt,
      pending_amount: pending,
      donation_item: donationItem || '',
      payment_mode: paymentMode || 'Cash',
      payment_status: status,
      gotram: gotram || '',
      family_members: Array.isArray(familyMembers) ? familyMembers : [],
      year: year || new Date().getFullYear(),
      volunteer_id: 'portal',
      volunteer_name: 'Self (Portal)',
      volunteer_phone: phone || '',
      created_at: submissionDate.getTime(),
      receipt_no: receiptNo,
    };

    const { data: insertedRow, error: insertError } = await supabase
      .from('devotees')
      .insert(devoteeData)
      .select('id')
      .single();

    if (insertError) throw insertError;
    const devoteeId = insertedRow.id;

    // 5. Payment History
    if (pAmt > 0) {
      await supabase.from('payment_histories').insert({
        devotee_id: devoteeId,
        amount: pAmt,
        mode: paymentMode || 'Cash',
        date: now,
        volunteer_id: 'portal',
        volunteer_name: 'Self (Portal)',
        year: year || new Date().getFullYear(),
      });
    }

    // 6. VIP Gotram
    const isVip = tAmt >= 1000 || (donationItem && donationItem.trim().length > 0);
    if (isVip && gotram && gotram.trim() && tAmt >= 1000) {
      const { data: vipData } = await supabase
        .from('vip_gotrams')
        .select('order')
        .eq('year', year)
        .order('order', { ascending: false })
        .limit(1);

      const maxOrder = vipData && vipData.length > 0 ? (vipData[0].order ?? 0) : 0;
      await supabase.from('vip_gotrams').insert({
        gotram: gotram.trim(),
        family_members: Array.isArray(familyMembers) ? familyMembers : [],
        order: maxOrder + 1,
        source: 'Chanda',
        devotee_id: devoteeId,
        year: year || new Date().getFullYear(),
        created_at: now,
      });
    }

    // 7. Notification
    const amountStr = new Intl.NumberFormat('en-IN').format(pAmt);
    let notifType = '';
    let notifMessage = '';
    if (pAmt > 0) {
      notifType = 'QR PORTAL · CHANDA';
      notifMessage = `${name} submitted ₹${amountStr} Chanda via ${paymentMode}.`;
    } else {
      notifType = 'QR PORTAL · REGISTRATION';
      notifMessage = `${name} completed a new registration.`;
    }

    await supabase.from('notifications').insert({
      type: notifType,
      message: notifMessage,
      amount: pAmt > 0 ? pAmt : 0,
      created_at: now,
      created_by: 'portal',
      created_by_name: name || 'Unknown Portal User',
      audience_roles: ['superadmin', 'admin'],
    });

    return new Response(JSON.stringify({ 
      success: true, 
      devoteeId,
      receiptNo,
      message: 'Submission successful'
    }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200 
    });

  } catch (error) {
    console.error("Error in submit-chanda function:", error);
    return new Response(JSON.stringify({ error: error.message || 'Internal Server Error' }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500 
    });
  }
});
