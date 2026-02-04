-- Migration to add selective sync columns for Zimbra integration
-- Add columns to PROFILES table to control and track Zimbra synchronization

SET SERVEROUTPUT ON;

BEGIN
    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE profiles ADD zimbra_sync_enabled NUMBER(1) DEFAULT 0';
        DBMS_OUTPUT.PUT_LINE('✓ zimbra_sync_enabled added');
    EXCEPTION WHEN OTHERS THEN
        IF SQLCODE = -1430 THEN DBMS_OUTPUT.PUT_LINE('⚠ zimbra_sync_enabled already exists');
        ELSE RAISE; END IF;
    END;
    
    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE profiles ADD zimbra_last_sync TIMESTAMP WITH TIME ZONE';
        DBMS_OUTPUT.PUT_LINE('✓ zimbra_last_sync added');
    EXCEPTION WHEN OTHERS THEN
        IF SQLCODE = -1430 THEN DBMS_OUTPUT.PUT_LINE('⚠ zimbra_last_sync already exists');
        ELSE RAISE; END IF;
    END;
    
    DBMS_OUTPUT.PUT_LINE('✅ Migration 003 completed');
END;
/
