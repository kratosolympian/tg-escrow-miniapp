-- Enable Row-Level Security for the product-images bucket
ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

-- Allow users to insert their own product images
CREATE POLICY "insert own product image" ON product_images
FOR INSERT
WITH CHECK (uploaded_by = auth.uid());

-- Allow users to read their own product images
CREATE POLICY "read own product image" ON product_images
FOR SELECT
USING (uploaded_by = auth.uid());

-- Allow admins to read all product images
CREATE POLICY "admin read product images" ON product_images
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);

-- Allow admins to delete any product image
CREATE POLICY "admin delete product images" ON product_images
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  )
);