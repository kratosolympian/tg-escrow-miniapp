-- Fix infinite recursion in RLS policies by using a security definer function for admin checks

-- Create a function to check if user is admin (security definer to bypass RLS)
-- Use admin_users table for admin lookups to avoid RLS recursion

-- Drop old policies that cause recursion
DROP POLICY IF EXISTS "admin read profiles" ON profiles;
DROP POLICY IF EXISTS "member read escrows" ON escrows;
DROP POLICY IF EXISTS "admin all escrows" ON escrows;
DROP POLICY IF EXISTS "member read receipts" ON receipts;
DROP POLICY IF EXISTS "admin write settings" ON admin_settings;
DROP POLICY IF EXISTS "member read logs" ON status_logs;
DROP POLICY IF EXISTS "member write logs" ON status_logs;
DROP POLICY IF EXISTS "member read disputes" ON disputes;
DROP POLICY IF EXISTS "member write disputes" ON disputes;

-- Recreate policies using the is_admin function
CREATE POLICY "admin read profiles" ON profiles
  FOR SELECT USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid()));

CREATE POLICY "member read escrows" ON escrows
  FOR SELECT USING (
    seller_id = auth.uid() OR buyer_id = auth.uid() OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
  );

CREATE POLICY "admin all escrows" ON escrows
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid()));

CREATE POLICY "member read receipts" ON receipts
  FOR SELECT USING (
    uploaded_by = auth.uid() OR EXISTS (
      SELECT 1 FROM escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid())
    ) OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
  );

CREATE POLICY "admin write settings" ON admin_settings
  FOR ALL USING (EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid()));

CREATE POLICY "member read logs" ON status_logs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
  );

CREATE POLICY "member write logs" ON status_logs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
  );

CREATE POLICY "member read disputes" ON disputes
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
  );

CREATE POLICY "member write disputes" ON disputes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid()))
    OR EXISTS (SELECT 1 FROM public.admin_users a WHERE a.user_id = auth.uid())
  );