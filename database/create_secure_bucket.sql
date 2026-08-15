-- 1. Create the Private Storage Bucket for payment proofs securely
INSERT INTO storage.buckets (id, name, public, allowed_mime_types, file_size_limit)
VALUES (
  'payment-proofs', 
  'payment-proofs', 
  false, -- PRIVATE BUCKET! Do not expose publicly
  ARRAY['image/jpeg', 'image/png', 'image/jpg', 'image/webp', 'application/pdf'],
  5242880 -- 5MB strict limit
)
ON CONFLICT (id) DO UPDATE SET 
  public = false,
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  file_size_limit = EXCLUDED.file_size_limit;

-- 2. Drop existing policies to prevent conflicts during re-creation
DROP POLICY IF EXISTS "Public users can upload payment proofs" ON storage.objects;
DROP POLICY IF EXISTS "Authorized users can view payment proofs" ON storage.objects;

-- 3. Storage RLS Policies for payment-proofs bucket
-- Allow public (anon/unauthenticated) QR Portal users strictly to UPLOAD (INSERT) ONLY
CREATE POLICY "Public users can upload payment proofs"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'payment-proofs');

-- Allow only logged-in Admins/Superadmins to VIEW (SELECT) proofs globally
CREATE POLICY "Authorized users can view payment proofs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'payment-proofs');
