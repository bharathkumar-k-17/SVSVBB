-- ============================================================================
-- SVSVBB Add Auth Signup Trigger
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================================

-- Function to automatically create a user profile when a new user signs up
CREATE OR REPLACE FUNCTION public.create_profile_for_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_count INT;
  assigned_role TEXT;
  assigned_status TEXT;
  final_username TEXT;
  final_name TEXT;
  final_phone TEXT;
BEGIN
  -- 1. Check if this is the first user in the database
  SELECT COUNT(*) INTO user_count FROM public.users;
  
  IF user_count = 0 THEN
    assigned_role := 'superadmin';
    assigned_status := 'approved';
  ELSE
    assigned_role := NEW.raw_user_meta_data->>'role';
    IF assigned_role IS NULL OR assigned_role = '' THEN
      assigned_role := 'volunteer';
    END IF;
    -- Ensure role is valid and not superadmin if count > 0
    IF assigned_role = 'superadmin' THEN
      assigned_role := 'volunteer';
    END IF;
    assigned_status := 'pending';
  END IF;

  -- 2. Safely parse username, falling back to a generated one if missing or empty
  final_username := NEW.raw_user_meta_data->>'username';
  IF final_username IS NULL OR final_username = '' THEN
    final_username := split_part(NEW.email, '@', 1) || '_' || substr(md5(random()::text), 1, 4);
  END IF;

  -- 3. Safely parse name and phone
  final_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  IF final_name IS NULL OR final_name = '' THEN
    final_name := 'User';
  END IF;

  final_phone := NEW.raw_user_meta_data->>'phone';
  IF final_phone IS NULL OR final_phone = '' THEN
    final_phone := '';
  END IF;

  -- 4. Insert user into public.users using explicit enum types directly
  INSERT INTO public.users (
    id, email, name, username, phone, role, status, created_at, last_login, approved_at, approved_by
  ) VALUES (
    NEW.id,
    NEW.email,
    final_name,
    final_username,
    final_phone,
    assigned_role::public.user_role,
    assigned_status::public.user_status,
    now(),
    null,
    null,
    null
  ) ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger to call the function after a user is inserted into auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_profile_for_new_user();
