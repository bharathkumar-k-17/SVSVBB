-- Add missing columns to public_chanda_requests to match the create-chanda Edge Function payload
ALTER TABLE public_chanda_requests 
ADD COLUMN IF NOT EXISTS paid_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_amount DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_proof_path TEXT,
ADD COLUMN IF NOT EXISTS payment_proof_name TEXT,
ADD COLUMN IF NOT EXISTS payment_proof_type TEXT;

-- Reload Supabase Schema Cache (fixes "not found in schema cache" errors)
NOTIFY pgrst, 'reload schema';
