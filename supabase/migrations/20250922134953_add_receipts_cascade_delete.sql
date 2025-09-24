-- Add ON DELETE CASCADE to receipts foreign key constraint
-- This allows escrows to be deleted even when they have associated receipts

ALTER TABLE receipts
DROP CONSTRAINT receipts_escrow_id_fkey,
ADD CONSTRAINT receipts_escrow_id_fkey
FOREIGN KEY (escrow_id) REFERENCES escrows(id) ON DELETE CASCADE;