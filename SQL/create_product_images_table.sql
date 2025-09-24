-- Create the product_images table
CREATE TABLE product_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploaded_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add an index on uploaded_by for faster lookups
CREATE INDEX idx_uploaded_by ON product_images(uploaded_by);

-- Add an index on file_path for faster lookups
CREATE INDEX idx_file_path ON product_images(file_path);