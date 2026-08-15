-- 1. Create Storage Bucket for payment proofs (if not exists)
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage RLS Policies for payment-proofs bucket
-- Allow public (anon) uploads via the QR Portal
CREATE POLICY "Public users can upload payment proofs"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'payment-proofs');

-- Allow only authenticated users to view
CREATE POLICY "Authorized users can view payment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'payment-proofs');
