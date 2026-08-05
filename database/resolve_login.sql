-- Function to securely resolve an email from a username or phone number
-- This runs with SECURITY DEFINER to bypass RLS since the user is not yet logged in during login.
CREATE OR REPLACE FUNCTION public.resolve_login_email(identifier text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  resolved_email text;
BEGIN
  -- Try to match by username (case insensitive) or exactly by phone
  SELECT email INTO resolved_email
  FROM public.users
  WHERE lower(username) = lower(identifier)
     OR phone = identifier
  LIMIT 1;
  
  RETURN resolved_email;
END;
$$;

-- Grant execution to public (anon users) so they can call this before login
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO anon;
GRANT EXECUTE ON FUNCTION public.resolve_login_email(text) TO authenticated;
