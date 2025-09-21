-- Insert default admin settings if none exist
INSERT INTO admin_settings (id, bank_name, account_number, account_holder, updated_at)
VALUES (1, 'Default Bank', '1234567890', 'Escrow Admin', NOW())
ON CONFLICT (id) DO NOTHING;