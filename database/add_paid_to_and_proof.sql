-- Migration: Add Paid To and Payment Proof to devotees table

-- 1. Alter devotees table
ALTER TABLE devotees
ADD COLUMN paid_to_user_id UUID REFERENCES users(id),
ADD COLUMN paid_to_name TEXT,
ADD COLUMN paid_to_phone TEXT,
ADD COLUMN payment_proof_path TEXT,
ADD COLUMN payment_proof_name TEXT,
ADD COLUMN payment_proof_type TEXT,
ADD COLUMN payment_proof_uploaded_at BIGINT,
ADD COLUMN payment_proof_status TEXT;

-- 2. Create Storage Bucket for payment proofs (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- 3. Storage RLS Policies for payment-proofs bucket
CREATE POLICY "Authenticated users can upload payment proofs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'payment-proofs');

CREATE POLICY "Authorized users can view payment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'payment-proofs');
