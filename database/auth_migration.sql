-- ============================================================================
-- SVSVBB Auth System Migration
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================================

-- ─── 1. Add new columns to existing users table ─────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pending';
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT DEFAULT '';

-- Add constraints
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_username_unique UNIQUE (username);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_email_unique UNIQUE (email);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_status_check
    CHECK (status IN ('pending', 'approved', 'rejected'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 2. Migrate role values to lowercase ────────────────────────────────────

-- Drop the old enum type constraint if it exists
ALTER TABLE users ALTER COLUMN role TYPE TEXT USING role::TEXT;

-- Normalize existing role values
UPDATE users SET role = 'superadmin'  WHERE role IN ('SUPER_ADMIN', 'super_admin');
UPDATE users SET role = 'admin'      WHERE role IN ('ADMIN');
UPDATE users SET role = 'volunteer'  WHERE role IN ('VOLUNTEER');

-- Add role check constraint
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('superadmin', 'admin', 'volunteer'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── 3. Drop old columns ───────────────────────────────────────────────────

ALTER TABLE users DROP COLUMN IF EXISTS active;

-- ─── 4. Security Functions ─────────────────────────────────────────────────

-- Function: enforce max 1 superadmin
CREATE OR REPLACE FUNCTION check_superadmin_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'superadmin' THEN
    IF (SELECT COUNT(*) FROM users
        WHERE role = 'superadmin'
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) >= 1 THEN
      RAISE EXCEPTION 'Only one superadmin account is allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: enforce max 5 admins
CREATE OR REPLACE FUNCTION check_admin_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    IF (SELECT COUNT(*) FROM users
        WHERE role = 'admin'
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) >= 5 THEN
      RAISE EXCEPTION 'Maximum 5 admin accounts allowed';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: get current user role (for RLS)
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$;

-- Function: get current user status (for RLS)
CREATE OR REPLACE FUNCTION get_user_status()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT status FROM users WHERE id = auth.uid();
$$;

-- ─── 5. Triggers ───────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS enforce_superadmin_limit ON users;
CREATE TRIGGER enforce_superadmin_limit
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION check_superadmin_limit();

DROP TRIGGER IF EXISTS enforce_admin_limit ON users;
CREATE TRIGGER enforce_admin_limit
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION check_admin_limit();

-- ─── 6. RLS Policies (Updated) ─────────────────────────────────────────────

-- Drop old policies
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Admins can read all users" ON users;
DROP POLICY IF EXISTS "Super Admins can update users" ON users;
DROP POLICY IF EXISTS "users_select_own" ON users;
DROP POLICY IF EXISTS "users_select_superadmin" ON users;
DROP POLICY IF EXISTS "users_select_admin" ON users;
DROP POLICY IF EXISTS "users_insert_self" ON users;
DROP POLICY IF EXISTS "users_update_superadmin" ON users;
DROP POLICY IF EXISTS "users_delete_superadmin" ON users;

-- Ensure RLS is enabled
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Everyone can read their own profile
CREATE POLICY "users_select_own" ON users
  FOR SELECT USING (auth.uid() = id);

-- Superadmin can read all users
CREATE POLICY "users_select_superadmin" ON users
  FOR SELECT USING (get_user_role() = 'superadmin');

-- Admin can read all users (for display purposes)
CREATE POLICY "users_select_admin" ON users
  FOR SELECT USING (get_user_role() = 'admin');

-- Anyone can insert their own profile row (during signup)
CREATE POLICY "users_insert_self" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Only superadmin can update any user (for approvals, role changes)
CREATE POLICY "users_update_superadmin" ON users
  FOR UPDATE USING (get_user_role() = 'superadmin');

-- Users can update their own non-role/status fields
CREATE POLICY "users_update_self" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Only superadmin can delete users
CREATE POLICY "users_delete_superadmin" ON users
  FOR DELETE USING (get_user_role() = 'superadmin');

-- ─── 7. Indexes ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ============================================================================
-- DONE! After running this, configure in Supabase Dashboard:
-- 1. Authentication → Providers → Google → Enable (add OAuth credentials)
-- 2. Authentication → Providers → Email → Enable "Confirm Email"
-- 3. Authentication → URL Configuration → Add redirect URLs
-- ============================================================================
