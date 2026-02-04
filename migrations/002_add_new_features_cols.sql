-- Migration to add columns for new features: Telegram, Zimbra, and Secretary Export
-- This script adds the missing columns to PROFILES and TASKS without dropping existing data.
-- NOTE: Uses safe column addition that ignores errors if column already exists

SET SERVEROUTPUT ON;

BEGIN
    -- 1. Update PROFILES table (safe adds)
    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE profiles ADD branch VARCHAR2(50)';
        DBMS_OUTPUT.PUT_LINE('✓ profiles.branch added');
    EXCEPTION WHEN OTHERS THEN
        IF SQLCODE = -1430 THEN DBMS_OUTPUT.PUT_LINE('⚠ profiles.branch already exists');
        ELSE RAISE; END IF;
    END;
    
    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE profiles ADD meeting_type VARCHAR2(100)';
        DBMS_OUTPUT.PUT_LINE('✓ profiles.meeting_type added');
    EXCEPTION WHEN OTHERS THEN
        IF SQLCODE = -1430 THEN DBMS_OUTPUT.PUT_LINE('⚠ profiles.meeting_type already exists');
        ELSE RAISE; END IF;
    END;
    
    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE profiles ADD telegram_user_id VARCHAR2(50)';
        DBMS_OUTPUT.PUT_LINE('✓ profiles.telegram_user_id added');
    EXCEPTION WHEN OTHERS THEN
        IF SQLCODE = -1430 THEN DBMS_OUTPUT.PUT_LINE('⚠ profiles.telegram_user_id already exists');
        ELSE RAISE; END IF;
    END;

    -- 2. Update TASKS table (safe adds)
    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE tasks ADD is_private NUMBER(1) DEFAULT 1';
        DBMS_OUTPUT.PUT_LINE('✓ tasks.is_private added');
    EXCEPTION WHEN OTHERS THEN
        IF SQLCODE = -1430 THEN DBMS_OUTPUT.PUT_LINE('⚠ tasks.is_private already exists');
        ELSE RAISE; END IF;
    END;
    
    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE tasks ADD branch VARCHAR2(50)';
        DBMS_OUTPUT.PUT_LINE('✓ tasks.branch added');
    EXCEPTION WHEN OTHERS THEN
        IF SQLCODE = -1430 THEN DBMS_OUTPUT.PUT_LINE('⚠ tasks.branch already exists');
        ELSE RAISE; END IF;
    END;
    
    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE tasks ADD meeting_type VARCHAR2(100)';
        DBMS_OUTPUT.PUT_LINE('✓ tasks.meeting_type added');
    EXCEPTION WHEN OTHERS THEN
        IF SQLCODE = -1430 THEN DBMS_OUTPUT.PUT_LINE('⚠ tasks.meeting_type already exists');
        ELSE RAISE; END IF;
    END;

    DBMS_OUTPUT.PUT_LINE('✅ Migration 002 completed');
END;
/
