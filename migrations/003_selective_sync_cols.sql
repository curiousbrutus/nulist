-- Migration to add selective sync columns for Zimbra integration
-- Add columns to PROFILES table to control and track Zimbra synchronization

ALTER TABLE profiles ADD (
    zimbra_sync_enabled NUMBER(1) DEFAULT 0,
    zimbra_last_sync TIMESTAMP WITH TIME ZONE
);

PROMPT '✓ Selective sync columns added to PROFILES';
