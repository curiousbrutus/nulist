--------------------------------------------------------------------------------
-- PROFILE ONBOARDING FIELDS
-- Kullanıcı ilk giriş yaptığında doldurması gereken ek bilgiler
--------------------------------------------------------------------------------

SET SERVEROUTPUT ON;

BEGIN
    -- Manager ID (yönetici referansı)
    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE profiles ADD manager_id VARCHAR2(36)';
        DBMS_OUTPUT.PUT_LINE('✓ manager_id kolonu eklendi');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -1430 THEN
                DBMS_OUTPUT.PUT_LINE('⚠ manager_id kolonu zaten var');
            ELSE
                RAISE;
            END IF;
    END;
    
    -- Foreign key constraint for manager
    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE profiles ADD CONSTRAINT fk_profiles_manager 
                          FOREIGN KEY (manager_id) REFERENCES profiles(id)';
        DBMS_OUTPUT.PUT_LINE('✓ manager foreign key eklendi');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -2275 THEN
                DBMS_OUTPUT.PUT_LINE('⚠ manager foreign key zaten var');
            ELSE
                RAISE;
            END IF;
    END;
    
    -- Profile completion flag
    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE profiles ADD is_profile_complete NUMBER(1) DEFAULT 0 NOT NULL';
        DBMS_OUTPUT.PUT_LINE('✓ is_profile_complete kolonu eklendi');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -1430 THEN
                DBMS_OUTPUT.PUT_LINE('⚠ is_profile_complete kolonu zaten var');
            ELSE
                RAISE;
            END IF;
    END;
    
    -- Job title
    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE profiles ADD job_title VARCHAR2(100)';
        DBMS_OUTPUT.PUT_LINE('✓ job_title kolonu eklendi');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -1430 THEN
                DBMS_OUTPUT.PUT_LINE('⚠ job_title kolonu zaten var');
            ELSE
                RAISE;
            END IF;
    END;
    
    -- Phone number
    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE profiles ADD phone VARCHAR2(20)';
        DBMS_OUTPUT.PUT_LINE('✓ phone kolonu eklendi');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -1430 THEN
                DBMS_OUTPUT.PUT_LINE('⚠ phone kolonu zaten var');
            ELSE
                RAISE;
            END IF;
    END;
    
    DBMS_OUTPUT.PUT_LINE('✅ Profile onboarding migration tamamlandı!');
END;
/
