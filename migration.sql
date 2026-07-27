
CREATE TABLE IF NOT EXISTS public_chanda_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  payment_mode TEXT,
  transaction_id TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);