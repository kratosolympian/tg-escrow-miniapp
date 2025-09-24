-- Update RLS policies for product-images bucket

-- Allow buyers to read product images associated with their escrow
CREATE POLICY "buyer read product images" ON product_images
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM escrows e
    WHERE e.id = product_images.escrow_id
    AND e.buyer_id = auth.uid()
  )
);