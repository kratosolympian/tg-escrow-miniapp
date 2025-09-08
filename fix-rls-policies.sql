-- Fix RLS policies to avoid infinite recursion
-- Temporarily remove admin checks that reference profiles table

-- Drop existing policies that cause recursion
DROP POLICY IF EXISTS "member read escrows" ON escrows;
DROP POLICY IF EXISTS "admin all escrows" ON escrows;
DROP POLICY IF EXISTS "member read logs" ON status_logs;
DROP POLICY IF EXISTS "member write logs" ON status_logs;
DROP POLICY IF EXISTS "member read receipts" ON receipts;
DROP POLICY IF EXISTS "admin write settings" ON admin_settings;
DROP POLICY IF EXISTS "member read disputes" ON disputes;
DROP POLICY IF EXISTS "member write disputes" ON disputes;

-- Create simplified policies without profiles table references
-- ESCROWS - simplified version without admin checks
CREATE POLICY "seller insert escrow v2" ON escrows FOR INSERT WITH CHECK (seller_id = auth.uid());
CREATE POLICY "member read escrows v2" ON escrows FOR SELECT USING (
  seller_id = auth.uid() OR buyer_id = auth.uid()
);
CREATE POLICY "seller update own v2" ON escrows FOR UPDATE USING (seller_id = auth.uid());
CREATE POLICY "buyer update own v2" ON escrows FOR UPDATE USING (buyer_id = auth.uid());

-- STATUS LOGS - simplified version without admin checks
CREATE POLICY "member read logs v2" ON status_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid()))
);
CREATE POLICY "member write logs v2" ON status_logs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid()))
);

-- RECEIPTS - simplified version
CREATE POLICY "insert own receipt v2" ON receipts FOR INSERT WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "member read receipts v2" ON receipts FOR SELECT USING (
  uploaded_by = auth.uid() OR EXISTS (
    SELECT 1 FROM escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid())
  )
);

-- ADMIN SETTINGS - allow all authenticated users to read (temporary)
CREATE POLICY "read settings v2" ON admin_settings FOR SELECT USING (auth.uid() IS NOT NULL);

-- DISPUTES - simplified version
CREATE POLICY "member read disputes v2" ON disputes FOR SELECT USING (
  EXISTS (SELECT 1 FROM escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid()))
);
CREATE POLICY "member write disputes v2" ON disputes FOR ALL USING (
  EXISTS (SELECT 1 FROM escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid()))
);
