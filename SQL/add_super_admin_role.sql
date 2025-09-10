-- Add super_admin to the role constraint
-- First remove the old constraint
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Add the new constraint with super_admin included
ALTER TABLE profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('buyer', 'seller', 'admin', 'super_admin'));
