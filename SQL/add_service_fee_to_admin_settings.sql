-- Migration: Add service_fee column to admin_settings table
-- Run this in Supabase SQL Editor to add the service fee configuration

-- Add the service_fee column with default value of 300
ALTER TABLE admin_settings
ADD COLUMN IF NOT EXISTS service_fee numeric(12,2) NOT NULL DEFAULT 300;

-- Update the comment to reflect the new field
COMMENT ON COLUMN admin_settings.service_fee IS 'Platform service fee in Naira (default: 300)';