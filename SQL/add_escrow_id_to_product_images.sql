-- Add escrow_id column to product_images table
ALTER TABLE product_images
ADD COLUMN escrow_id UUID REFERENCES escrows(id) ON DELETE CASCADE;

-- Add an index on escrow_id for faster lookups
CREATE INDEX idx_escrow_id ON product_images(escrow_id);