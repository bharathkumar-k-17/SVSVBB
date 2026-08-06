-- 1. Create the App Lock Status Table (idempotent)
CREATE TABLE IF NOT EXISTS public.app_lock_status (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false NOT NULL,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  device_name TEXT
);

-- 2. Create Index on user_id (idempotent)
CREATE INDEX IF NOT EXISTS idx_app_lock_status_user_id ON public.app_lock_status(user_id);

-- 3. Enable RLS (idempotent)
ALTER TABLE public.app_lock_status ENABLE ROW LEVEL SECURITY;

-- 4. Drop Existing Policies to make it idempotent
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can manage their own app lock status" ON public.app_lock_status;
    DROP POLICY IF EXISTS "Admins can view app lock status" ON public.app_lock_status;
END
$$;

-- 5. Create Policy 1: Users can manage their own
CREATE POLICY "Users can manage their own app lock status" 
  ON public.app_lock_status FOR ALL USING (auth.uid() = user_id);

-- 6. Create Policy 2: Super Admins can view
-- Using the exact lowercase enum values as requested by the user
CREATE POLICY "Admins can view app lock status" 
  ON public.app_lock_status FOR SELECT 
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE public.users.id = auth.uid() AND public.users.role = 'superadmin'::user_role
    )
  );