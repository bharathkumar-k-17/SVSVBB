-- Migration to create Secure RPCs for QR Chanda Review Bypassing Edge Functions

-- 1. Helper function to check admin rights securely
CREATE OR REPLACE FUNCTION is_admin_or_superadmin() RETURNS BOOLEAN AS $$
DECLARE
    v_role TEXT;
BEGIN
    SELECT role INTO v_role FROM users WHERE id = auth.uid();
    RETURN v_role IN ('admin', 'superadmin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Reject RPC
CREATE OR REPLACE FUNCTION review_qr_chanda_reject(
    p_request_id UUID,
    p_rejection_reason TEXT
)
RETURNS JSON AS $$
DECLARE
    v_user RECORD;
    v_request RECORD;
    v_now NUMERIC;
BEGIN
    -- 1. Verify User Role
    IF NOT is_admin_or_superadmin() THEN
        RAISE EXCEPTION 'Unauthorized: Only Admins can review QR requests';
    END IF;

    -- Fetch Admin User details
    SELECT id, name, phone INTO v_user FROM users WHERE id = auth.uid();

    -- 2. Lock & Verify Request
    SELECT * INTO v_request 
    FROM public_chanda_requests 
    WHERE id = p_request_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found';
    END IF;

    IF v_request.status != 'PENDING_REVIEW' THEN
        RAISE EXCEPTION 'Request is already processed';
    END IF;

    v_now := (EXTRACT(EPOCH FROM NOW()) * 1000)::NUMERIC;

    -- 3. Update Request Status
    UPDATE public_chanda_requests
    SET status = 'REJECTED',
        rejection_reason = p_rejection_reason,
        reviewed_by = v_user.id,
        reviewed_by_name = v_user.name,
        reviewed_by_phone = v_user.phone,
        reviewed_at = NOW()::TEXT,
        updated_at = NOW()::TEXT
    WHERE id = p_request_id;

    -- 4. Create Notification
    INSERT INTO notifications (
        type, message, amount, created_at, created_by, created_by_name, audience_roles
    ) VALUES (
        'QR CHANDA REVIEW',
        'QR Chanda Request from ' || v_request.name || ' was REJECTED by ' || v_user.name || '. Reason: ' || COALESCE(p_rejection_reason, 'None provided'),
        0,
        v_now,
        v_user.id,
        v_user.name,
        ARRAY['superadmin', 'admin']
    );

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. Accept RPC
CREATE OR REPLACE FUNCTION review_qr_chanda_accept(
    p_request_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_user RECORD;
    v_request RECORD;
    v_now NUMERIC;
    v_year INTEGER;
    v_year_str TEXT;
    v_counter_key TEXT;
    v_receipt_count INTEGER;
    v_receipt_no TEXT;
    v_pending_amount NUMERIC;
    v_payment_status TEXT;
    v_devotee_id UUID;
    v_is_vip BOOLEAN;
    v_max_order INTEGER;
BEGIN
    -- 1. Verify User Role
    IF NOT is_admin_or_superadmin() THEN
        RAISE EXCEPTION 'Unauthorized: Only Admins can review QR requests';
    END IF;

    -- Fetch Admin User details
    SELECT id, name, phone INTO v_user FROM users WHERE id = auth.uid();

    -- 2. Lock & Verify Request
    SELECT * INTO v_request 
    FROM public_chanda_requests 
    WHERE id = p_request_id 
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request not found';
    END IF;

    IF v_request.status != 'PENDING_REVIEW' THEN
        RAISE EXCEPTION 'Request is already processed';
    END IF;

    v_now := (EXTRACT(EPOCH FROM NOW()) * 1000)::NUMERIC;
    v_year := EXTRACT(YEAR FROM NOW())::INTEGER;
    v_year_str := SUBSTRING(v_year::TEXT FROM 3 FOR 2);
    v_counter_key := 'receipt_' || v_year_str;

    -- 3. Generate Official Receipt Automatically
    INSERT INTO counters (id, count)
    VALUES (v_counter_key, 1)
    ON CONFLICT (id) DO UPDATE SET count = counters.count + 1
    RETURNING count INTO v_receipt_count;

    v_receipt_no := 'SVSVBB' || v_year_str || LPAD(v_receipt_count::TEXT, 4, '0');

    -- Calculate pending amount natively
    v_pending_amount := COALESCE(v_request.total_amount, 0) - COALESCE(v_request.paid_amount, 0);
    
    IF v_pending_amount <= 0 THEN
        v_payment_status := 'PAID';
    ELSIF COALESCE(v_request.paid_amount, 0) > 0 THEN
        v_payment_status := 'PARTIAL';
    ELSE
        v_payment_status := 'UNPAID';
    END IF;

    -- 4. Create Official Devotee
    INSERT INTO devotees (
        name, phone, total_amount, paid_amount, pending_amount, 
        donation_item, payment_mode, payment_status, gotram, family_members, 
        year, volunteer_id, volunteer_name, volunteer_phone, created_at, receipt_no,
        payment_proof_path, payment_proof_name, payment_proof_type, payment_proof_status
    ) VALUES (
        v_request.name,
        COALESCE(v_request.phone, ''),
        COALESCE(v_request.total_amount, 0),
        COALESCE(v_request.paid_amount, 0),
        v_pending_amount,
        COALESCE(v_request.donation_item, ''),
        COALESCE(v_request.payment_mode, 'Cash'),
        v_payment_status,
        COALESCE(v_request.gotram, ''),
        '{}'::TEXT[], -- Empty array since QR requests don't natively map nested families
        v_year,
        v_user.id,
        v_user.name,
        COALESCE(v_user.phone, ''),
        v_now,
        v_receipt_no,
        v_request.payment_proof_path,
        v_request.payment_proof_name,
        v_request.payment_proof_type,
        CASE WHEN v_request.payment_proof_path IS NOT NULL THEN 'UPI_PAYMENT_PROOF_VERIFIED' ELSE NULL END
    ) RETURNING id INTO v_devotee_id;

    -- 5. Mark Request Accepted
    UPDATE public_chanda_requests
    SET status = 'ACCEPTED',
        reference_number = v_receipt_no,
        reviewed_by = v_user.id,
        reviewed_by_name = v_user.name,
        reviewed_by_phone = v_user.phone,
        reviewed_at = NOW()::TEXT,
        updated_at = NOW()::TEXT
    WHERE id = p_request_id;

    -- 6. Insert Collection History if paid
    IF COALESCE(v_request.paid_amount, 0) > 0 THEN
        INSERT INTO payment_histories (
            devotee_id, amount, mode, date, volunteer_id, volunteer_name, year, transaction_id
        ) VALUES (
            v_devotee_id,
            v_request.paid_amount,
            COALESCE(v_request.payment_mode, 'Cash'),
            v_now,
            v_user.id,
            v_user.name,
            v_year,
            v_request.payment_proof_path
        );
    END IF;

    -- 7. Process VIP Gotram
    v_is_vip := (COALESCE(v_request.total_amount, 0) >= 1000) OR (TRIM(COALESCE(v_request.donation_item, '')) != '');
    IF v_is_vip AND TRIM(COALESCE(v_request.gotram, '')) != '' AND COALESCE(v_request.total_amount, 0) >= 1000 THEN
        SELECT COALESCE(MAX("order"), 0) INTO v_max_order FROM vip_gotrams WHERE year = v_year;
        
        INSERT INTO vip_gotrams (
            gotram, family_members, "order", source, devotee_id, year, created_at
        ) VALUES (
            TRIM(v_request.gotram),
            '{}'::TEXT[],
            v_max_order + 1,
            'Chanda',
            v_devotee_id,
            v_year,
            v_now
        );
    END IF;

    -- 8. Broadcast Notification
    INSERT INTO notifications (
        type, message, amount, created_at, created_by, created_by_name, audience_roles
    ) VALUES (
        'QR CHANDA REVIEW',
        'QR Chanda Request from ' || v_request.name || ' for ₹' || v_request.paid_amount || ' was ACCEPTED by ' || v_user.name || '. Receipt: ' || v_receipt_no,
        COALESCE(v_request.paid_amount, 0),
        v_now,
        v_user.id,
        v_user.name,
        ARRAY['superadmin', 'admin']
    );

    RETURN json_build_object('success', true, 'devoteeId', v_devotee_id, 'receiptNo', v_receipt_no);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
