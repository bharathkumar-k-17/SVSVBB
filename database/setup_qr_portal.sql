-- Create the isolated QR Chanda Requests table
CREATE TABLE public_qr_chanda_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    paid_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    pending_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    payment_mode TEXT CHECK (payment_mode IN ('Cash', 'UPI')),
    status TEXT NOT NULL DEFAULT 'PENDING_REVIEW' CHECK (status IN ('PENDING_REVIEW', 'ACCEPTED', 'REJECTED')),
    donation_item TEXT,
    gotram TEXT,
    family_members JSONB DEFAULT '[]'::jsonb,
    payment_proof_path TEXT,
    payment_proof_name TEXT,
    payment_proof_type TEXT,
    rejection_reason TEXT,
    reviewed_by UUID REFERENCES auth.users(id),
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS setup
ALTER TABLE public_qr_chanda_requests ENABLE ROW LEVEL SECURITY;

-- 1. Anyone can insert new requests (public submission)
CREATE POLICY "Public can submit QR Chanda Requests"
ON public_qr_chanda_requests FOR INSERT
TO public, anon
WITH CHECK (true);

-- 2. Authenticated Admins/Superadmins can read all requests
CREATE POLICY "Admins can view QR Chanda Requests"
ON public_qr_chanda_requests FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('superadmin', 'admin')
  )
);

-- 3. Authenticated Admins/Superadmins can update (ACCEPT/REJECT) requests
CREATE POLICY "Admins can update QR Chanda Requests"
ON public_qr_chanda_requests FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('superadmin', 'admin')
  )
);

-- Create storage bucket if not exists
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for payment-proofs (if not already existing)
CREATE POLICY "Public users can upload payment proofs"
ON storage.objects FOR INSERT
TO public, anon
WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "Authorized users can view payment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'payment-proofs');
