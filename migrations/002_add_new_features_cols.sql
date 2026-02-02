-- Migration to add columns for new features: Telegram, Zimbra, and Secretary Export
-- This script adds the missing columns to PROFILES and TASKS without dropping existing data.

-- 1. Update PROFILES table
ALTER TABLE profiles ADD (
    branch VARCHAR2(50),
    meeting_type VARCHAR2(100),
    telegram_user_id VARCHAR2(50)
);

-- Update profile role constraint to include superadmin
ALTER TABLE profiles DROP CONSTRAINT chk_profile_role;
ALTER TABLE profiles ADD CONSTRAINT chk_profile_role CHECK (role IN ('user', 'admin', 'secretary', 'superadmin'));

-- 2. Update TASKS table
ALTER TABLE tasks ADD (
    is_private NUMBER(1) DEFAULT 1,
    branch VARCHAR2(50),
    meeting_type VARCHAR2(100)
);

-- Verify changes
PROMPT '✓ Columns added successfully to PROFILES and TASKS';
