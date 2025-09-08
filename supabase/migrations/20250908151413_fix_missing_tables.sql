-- Ensure all tables exist for escrow service

-- Check if escrows table exists and create if not
CREATE TABLE IF NOT EXISTS escrows (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text UNIQUE NOT NULL,
  seller_id uuid REFERENCES profiles(id) NOT NULL,
  buyer_id uuid REFERENCES profiles(id),
  description text NOT NULL,
  price numeric NOT NULL,
  admin_fee numeric DEFAULT 300,
  product_image_url text,
  status text NOT NULL DEFAULT 'created',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Check if status_logs table exists and create if not
CREATE TABLE IF NOT EXISTS status_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  escrow_id uuid REFERENCES escrows(id) NOT NULL,
  status text NOT NULL,
  changed_by uuid REFERENCES profiles(id) NOT NULL,
  changed_at timestamp with time zone DEFAULT now()
);

-- Ensure storage bucket exists
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', false) 
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on tables
ALTER TABLE escrows ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for escrows table
DROP POLICY IF EXISTS "Users can view escrows they are part of" ON escrows;
CREATE POLICY "Users can view escrows they are part of" ON escrows
  FOR SELECT USING (seller_id = auth.uid() OR buyer_id = auth.uid());

DROP POLICY IF EXISTS "Sellers can create escrows" ON escrows;
CREATE POLICY "Sellers can create escrows" ON escrows
  FOR INSERT WITH CHECK (seller_id = auth.uid());

DROP POLICY IF EXISTS "Sellers can update their escrows" ON escrows;
CREATE POLICY "Sellers can update their escrows" ON escrows
  FOR UPDATE USING (seller_id = auth.uid());

-- RLS Policies for status_logs table  
DROP POLICY IF EXISTS "Users can view status logs for their escrows" ON status_logs;
CREATE POLICY "Users can view status logs for their escrows" ON status_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM escrows 
      WHERE escrows.id = status_logs.escrow_id 
      AND (escrows.seller_id = auth.uid() OR escrows.buyer_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create status logs for their escrows" ON status_logs;
CREATE POLICY "Users can create status logs for their escrows" ON status_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM escrows 
      WHERE escrows.id = status_logs.escrow_id 
      AND (escrows.seller_id = auth.uid() OR escrows.buyer_id = auth.uid())
    )
  );
