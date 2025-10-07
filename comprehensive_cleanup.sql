-- Comprehensive Database Cleanup Script
-- This script removes all orphaned data from related tables
-- Run this in your Supabase SQL Editor

-- Start a transaction for safety
BEGIN;

-- 1. Clean up orphaned profiles (profiles without corresponding auth.users)
-- This should be rare due to CASCADE constraints, but good to check
DELETE FROM profiles
WHERE id NOT IN (SELECT id FROM auth.users);

-- 2. Clean up escrows with invalid buyer_id (shouldn't happen due to CASCADE, but buyer_id can be set to null)
UPDATE escrows
SET buyer_id = NULL
WHERE buyer_id IS NOT NULL AND buyer_id NOT IN (SELECT id FROM profiles);

-- 3. Clean up orphaned user_notifications (notifications with invalid user_id or escrow_id)
DELETE FROM user_notifications
WHERE user_id NOT IN (SELECT id FROM profiles)
   OR escrow_id NOT IN (SELECT id FROM escrows);

-- 4. Clean up orphaned chat_participants (participants with invalid escrow_id or user_id)
DELETE FROM chat_participants
WHERE escrow_id NOT IN (SELECT id FROM escrows)
   OR user_id NOT IN (SELECT id FROM profiles);

-- 5. Clean up orphaned chat_messages (messages with invalid escrow_id or sender_id)
DELETE FROM chat_messages
WHERE escrow_id NOT IN (SELECT id FROM escrows)
   OR sender_id NOT IN (SELECT id FROM profiles);

-- 6. Clean up orphaned receipts (receipts with invalid escrow_id or uploaded_by)
DELETE FROM receipts
WHERE escrow_id NOT IN (SELECT id FROM escrows)
   OR uploaded_by NOT IN (SELECT id FROM profiles);

-- 7. Clean up orphaned status_logs (logs with invalid escrow_id)
DELETE FROM status_logs
WHERE escrow_id NOT IN (SELECT id FROM escrows);

-- Update status_logs with invalid changed_by (set to null as per schema)
UPDATE status_logs
SET changed_by = NULL
WHERE changed_by IS NOT NULL AND changed_by NOT IN (SELECT id FROM profiles);

-- 8. Clean up orphaned disputes (only if disputes table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'disputes') THEN
        -- Clean up orphaned disputes (disputes with invalid escrow_id)
        DELETE FROM disputes
        WHERE escrow_id NOT IN (SELECT id FROM escrows);

        -- Update disputes with invalid raised_by (set to null as per schema) - only if column exists
        IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'disputes' AND column_name = 'raised_by') THEN
            EXECUTE 'UPDATE disputes SET raised_by = NULL WHERE raised_by IS NOT NULL AND raised_by NOT IN (SELECT id FROM profiles)';
        END IF;
    END IF;
END $$;

-- 9. Clean up orphaned one_time_tokens (tokens with invalid user_id)
DELETE FROM one_time_tokens
WHERE user_id NOT IN (SELECT id FROM profiles);

-- 10. Clean up orphaned admin_users (admin entries with invalid user_id)
DELETE FROM admin_users
WHERE user_id NOT IN (SELECT id FROM profiles);

-- Show cleanup summary
SELECT
  'Cleanup completed successfully' as status,
  NOW() as cleanup_timestamp;

-- Commit the transaction
COMMIT;