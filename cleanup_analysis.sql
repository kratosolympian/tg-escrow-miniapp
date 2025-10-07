-- Comprehensive Database Cleanup Analysis Script
-- This script shows what orphaned data exists WITHOUT deleting anything
-- Run this first to see what would be cleaned up

-- Function to safely count disputes with raised_by issues
CREATE OR REPLACE FUNCTION safe_count_disputes_raised_by()
RETURNS bigint AS $$
DECLARE
    result bigint := 0;
BEGIN
    -- Only execute if both table and column exist
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'disputes')
       AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'disputes' AND column_name = 'raised_by') THEN
        EXECUTE 'SELECT COUNT(*) FROM disputes WHERE raised_by IS NOT NULL AND raised_by NOT IN (SELECT id FROM profiles)' INTO result;
    END IF;
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Comprehensive Database Cleanup Analysis Script
-- This script shows what orphaned data exists WITHOUT deleting anything
-- Run this first to see what would be cleaned up

-- Run the analysis
SELECT
  'profiles' as table_name,
  COUNT(*) as orphaned_records,
  'Profiles without corresponding auth.users' as description
FROM profiles
WHERE id NOT IN (SELECT id FROM auth.users)

UNION ALL

SELECT
  'escrows' as table_name,
  COUNT(*) as orphaned_records,
  'Escrows with invalid buyer_id references' as description
FROM escrows
WHERE buyer_id IS NOT NULL AND buyer_id NOT IN (SELECT id FROM profiles)

UNION ALL

SELECT
  'user_notifications' as table_name,
  COUNT(*) as orphaned_records,
  'Notifications with invalid user_id or escrow_id' as description
FROM user_notifications
WHERE user_id NOT IN (SELECT id FROM profiles)
   OR escrow_id NOT IN (SELECT id FROM escrows)

UNION ALL

SELECT
  'chat_participants' as table_name,
  COUNT(*) as orphaned_records,
  'Chat participants with invalid escrow_id or user_id' as description
FROM chat_participants
WHERE escrow_id NOT IN (SELECT id FROM escrows)
   OR user_id NOT IN (SELECT id FROM profiles)

UNION ALL

SELECT
  'chat_messages' as table_name,
  COUNT(*) as orphaned_records,
  'Chat messages with invalid escrow_id or sender_id' as description
FROM chat_messages
WHERE escrow_id NOT IN (SELECT id FROM escrows)
   OR sender_id NOT IN (SELECT id FROM profiles)

UNION ALL

SELECT
  'receipts' as table_name,
  COUNT(*) as orphaned_records,
  'Receipts with invalid escrow_id or uploaded_by' as description
FROM receipts
WHERE escrow_id NOT IN (SELECT id FROM escrows)
   OR uploaded_by NOT IN (SELECT id FROM profiles)

UNION ALL

SELECT
  'status_logs' as table_name,
  COUNT(*) as orphaned_records,
  'Status logs with invalid escrow_id' as description
FROM status_logs
WHERE escrow_id NOT IN (SELECT id FROM escrows)

UNION ALL

SELECT
  'status_logs_changed_by' as table_name,
  COUNT(*) as orphaned_records,
  'Status logs with invalid changed_by (will be set to NULL)' as description
FROM status_logs
WHERE changed_by IS NOT NULL AND changed_by NOT IN (SELECT id FROM profiles)

UNION ALL

-- Disputes analysis (only if table exists and has expected columns)
SELECT
  'disputes' as table_name,
  CASE
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'disputes') THEN
      (SELECT COUNT(*) FROM disputes WHERE escrow_id NOT IN (SELECT id FROM escrows))
    ELSE 0
  END as orphaned_records,
  'Disputes with invalid escrow_id' as description

UNION ALL

SELECT
  'disputes_raised_by' as table_name,
  safe_count_disputes_raised_by() as orphaned_records,
  'Disputes with invalid raised_by (will be set to NULL)' as description

UNION ALL

SELECT
  'one_time_tokens' as table_name,
  COUNT(*) as orphaned_records,
  'One-time tokens with invalid user_id' as description
FROM one_time_tokens
WHERE user_id NOT IN (SELECT id FROM profiles)

UNION ALL

SELECT
  'admin_users' as table_name,
  COUNT(*) as orphaned_records,
  'Admin users with invalid user_id' as description
FROM admin_users
WHERE user_id NOT IN (SELECT id FROM profiles)

ORDER BY orphaned_records DESC;

-- Clean up the temporary functions
DROP FUNCTION IF EXISTS safe_count_orphaned(text, text);
DROP FUNCTION IF EXISTS safe_count_disputes_raised_by();