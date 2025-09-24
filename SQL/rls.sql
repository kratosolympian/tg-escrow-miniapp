alter table profiles enable row level security;
alter table escrows enable row level security;
alter table receipts enable row level security;
alter table admin_settings enable row level security;
alter table status_logs enable row level security;
alter table disputes enable row level security;

-- PROFILES
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'own profile read' AND tablename = 'profiles'
  ) THEN
    CREATE POLICY "own profile read" ON profiles FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'own profile update' AND tablename = 'profiles'
  ) THEN
    CREATE POLICY "own profile update" ON profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'admin read profiles' AND tablename = 'profiles'
  ) THEN
    CREATE POLICY "admin read profiles" ON profiles FOR SELECT USING (
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );
  END IF;
END $$;

-- ESCROWS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'seller insert escrow' AND tablename = 'escrows'
  ) THEN
    CREATE POLICY "seller insert escrow" ON escrows FOR INSERT WITH CHECK (seller_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'member read escrows' AND tablename = 'escrows'
  ) THEN
    CREATE POLICY "member read escrows" ON escrows FOR SELECT USING (
      seller_id = auth.uid() OR buyer_id = auth.uid() OR EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin'
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'seller update own' AND tablename = 'escrows'
  ) THEN
    CREATE POLICY "seller update own" ON escrows FOR UPDATE USING (seller_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'buyer update own' AND tablename = 'escrows'
  ) THEN
    CREATE POLICY "buyer update own" ON escrows FOR UPDATE USING (buyer_id = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'admin all escrows' AND tablename = 'escrows'
  ) THEN
    CREATE POLICY "admin all escrows" ON escrows FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );
  END IF;
END $$;

-- RECEIPTS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'insert own receipt' AND tablename = 'receipts'
  ) THEN
    CREATE POLICY "insert own receipt" ON receipts FOR INSERT WITH CHECK (uploaded_by = auth.uid());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'member read receipts' AND tablename = 'receipts'
  ) THEN
    CREATE POLICY "member read receipts" ON receipts FOR SELECT USING (
      uploaded_by = auth.uid() OR EXISTS (
        SELECT 1 FROM escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid())
      ) OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );
  END IF;
END $$;

-- ADMIN SETTINGS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'read settings (public)' AND tablename = 'admin_settings'
  ) THEN
    CREATE POLICY "read settings (public)" ON admin_settings FOR SELECT USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'admin write settings' AND tablename = 'admin_settings'
  ) THEN
    CREATE POLICY "admin write settings" ON admin_settings FOR ALL USING (
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );
  END IF;
END $$;

-- STATUS LOGS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'member read logs' AND tablename = 'status_logs'
  ) THEN
    CREATE POLICY "member read logs" ON status_logs FOR SELECT USING (
      EXISTS (SELECT 1 FROM escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid()))
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'member write logs' AND tablename = 'status_logs'
  ) THEN
    CREATE POLICY "member write logs" ON status_logs FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid()))
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );
  END IF;
END $$;

-- DISPUTES
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'member read disputes' AND tablename = 'disputes'
  ) THEN
    CREATE POLICY "member read disputes" ON disputes FOR SELECT USING (
      EXISTS (SELECT 1 FROM escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid()))
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'member write disputes' AND tablename = 'disputes'
  ) THEN
    CREATE POLICY "member write disputes" ON disputes FOR ALL USING (
      EXISTS (SELECT 1 FROM escrows e WHERE e.id = escrow_id AND (e.seller_id = auth.uid() OR e.buyer_id = auth.uid()))
      OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
    );
  END IF;
END $$;

-- STORAGE BUCKETS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'authenticated access to product-images' AND tablename = 'storage_buckets'
  ) THEN
    CREATE POLICY "authenticated access to product-images" ON storage_buckets FOR SELECT USING (
      auth.uid() IS NOT NULL
    );
  END IF;
END $$;
