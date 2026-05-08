-- RLS Policies for SVSVBB

-- Helper function to get the current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT role FROM users WHERE id = auth.uid();
$$;

-- Helper function to check if a year is locked
CREATE OR REPLACE FUNCTION is_year_locked(y_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT is_locked FROM festival_years WHERE id = y_id;
$$;


-- ==========================================
-- USERS
-- ==========================================
-- Everyone can read their own user data
CREATE POLICY "Users can read own data" ON users FOR SELECT USING (auth.uid() = id);
-- SUPER_ADMIN and ADMIN can read all users
CREATE POLICY "Admins can read all users" ON users FOR SELECT USING (get_user_role() IN ('SUPER_ADMIN', 'ADMIN'));
-- Only SUPER_ADMIN can create/update admins, ADMINs can update volunteers
CREATE POLICY "Super Admins can update users" ON users FOR UPDATE USING (get_user_role() = 'SUPER_ADMIN');


-- ==========================================
-- FESTIVAL YEARS
-- ==========================================
-- Everyone can read years
CREATE POLICY "Everyone can read years" ON festival_years FOR SELECT USING (true);
-- Only Admins can modify years
CREATE POLICY "Admins can insert years" ON festival_years FOR INSERT WITH CHECK (get_user_role() IN ('SUPER_ADMIN', 'ADMIN'));
CREATE POLICY "Admins can update years" ON festival_years FOR UPDATE USING (get_user_role() IN ('SUPER_ADMIN', 'ADMIN'));


-- ==========================================
-- CHANDA COLLECTIONS
-- ==========================================
-- Everyone can read stats, but maybe only admins can edit if year is locked.
-- For now, all authenticated users can read.
CREATE POLICY "All auth users can read chanda" ON chanda_collections FOR SELECT USING (auth.uid() IS NOT NULL);

-- Volunteers and Admins can insert/update if the year is NOT locked.
CREATE POLICY "Can insert chanda if year active" ON chanda_collections 
FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND 
  is_year_locked(year_id) = false
);

CREATE POLICY "Can update chanda if year active" ON chanda_collections 
FOR UPDATE USING (
  auth.uid() IS NOT NULL AND 
  is_year_locked(year_id) = false
);


-- ==========================================
-- EXPENSES
-- ==========================================
-- All users can view expenses
CREATE POLICY "All auth users can read expenses" ON expenses FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "All auth users can read expense categories" ON expense_categories FOR SELECT USING (auth.uid() IS NOT NULL);

-- Only Admins can add/update expenses (per rules: "ADMIN: Manage expenses")
CREATE POLICY "Admins can insert expenses" ON expenses 
FOR INSERT WITH CHECK (
  get_user_role() IN ('SUPER_ADMIN', 'ADMIN') AND 
  is_year_locked(year_id) = false
);

CREATE POLICY "Admins can update expenses" ON expenses 
FOR UPDATE USING (
  get_user_role() IN ('SUPER_ADMIN', 'ADMIN') AND 
  is_year_locked(year_id) = false
);
