--------------------------------------------------------------------------------
-- PROFILE MANAGERS + TASK RECURRENCE
-- Multi-manager hierarchy and recurring task metadata
--------------------------------------------------------------------------------

SET SERVEROUTPUT ON;

BEGIN
    -- Multi-manager relationship table
    BEGIN
        EXECUTE IMMEDIATE '
            CREATE TABLE profile_managers (
                profile_id VARCHAR2(36) NOT NULL,
                manager_id VARCHAR2(36) NOT NULL,
                is_primary NUMBER(1) DEFAULT 0 NOT NULL,
                assigned_by VARCHAR2(36),
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
                CONSTRAINT pk_profile_managers PRIMARY KEY (profile_id, manager_id),
                CONSTRAINT fk_pm_profile FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
                CONSTRAINT fk_pm_manager FOREIGN KEY (manager_id) REFERENCES profiles(id) ON DELETE CASCADE,
                CONSTRAINT fk_pm_assigned_by FOREIGN KEY (assigned_by) REFERENCES profiles(id),
                CONSTRAINT chk_pm_not_self CHECK (profile_id <> manager_id),
                CONSTRAINT chk_pm_primary CHECK (is_primary IN (0, 1))
            )
        ';
        DBMS_OUTPUT.PUT_LINE('✓ profile_managers tablosu oluşturuldu');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -955 THEN
                DBMS_OUTPUT.PUT_LINE('⚠ profile_managers tablosu zaten var');
            ELSE
                RAISE;
            END IF;
    END;

    BEGIN
        EXECUTE IMMEDIATE 'CREATE INDEX idx_pm_profile ON profile_managers(profile_id)';
        DBMS_OUTPUT.PUT_LINE('✓ idx_pm_profile index oluşturuldu');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -955 THEN
                DBMS_OUTPUT.PUT_LINE('⚠ idx_pm_profile zaten var');
            ELSE
                RAISE;
            END IF;
    END;

    BEGIN
        EXECUTE IMMEDIATE 'CREATE INDEX idx_pm_manager ON profile_managers(manager_id)';
        DBMS_OUTPUT.PUT_LINE('✓ idx_pm_manager index oluşturuldu');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -955 THEN
                DBMS_OUTPUT.PUT_LINE('⚠ idx_pm_manager zaten var');
            ELSE
                RAISE;
            END IF;
    END;

    -- Backfill from legacy profiles.manager_id
    DECLARE
        v_backfilled NUMBER := 0;
    BEGIN
        INSERT INTO profile_managers (profile_id, manager_id, is_primary, assigned_by)
        SELECT p.id, p.manager_id, 1, p.id
        FROM profiles p
        WHERE p.manager_id IS NOT NULL
          AND p.id <> p.manager_id
          AND NOT EXISTS (
              SELECT 1
              FROM profile_managers pm
              WHERE pm.profile_id = p.id
                AND pm.manager_id = p.manager_id
          );

        v_backfilled := SQL%ROWCOUNT;
        COMMIT;
        DBMS_OUTPUT.PUT_LINE('✓ Legacy manager backfill tamamlandı: ' || v_backfilled || ' kayıt');
    EXCEPTION
        WHEN OTHERS THEN
            DBMS_OUTPUT.PUT_LINE('⚠ Legacy manager backfill atlandı: ' || SQLERRM);
    END;

    -- Task recurrence fields
    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE tasks ADD recurrence_enabled NUMBER(1) DEFAULT 0 NOT NULL';
        DBMS_OUTPUT.PUT_LINE('✓ tasks.recurrence_enabled eklendi');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -1430 THEN
                DBMS_OUTPUT.PUT_LINE('⚠ tasks.recurrence_enabled zaten var');
            ELSE
                RAISE;
            END IF;
    END;

    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE tasks ADD recurrence_mode VARCHAR2(30)';
        DBMS_OUTPUT.PUT_LINE('✓ tasks.recurrence_mode eklendi');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -1430 THEN
                DBMS_OUTPUT.PUT_LINE('⚠ tasks.recurrence_mode zaten var');
            ELSE
                RAISE;
            END IF;
    END;

    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE tasks ADD recurrence_interval_days NUMBER';
        DBMS_OUTPUT.PUT_LINE('✓ tasks.recurrence_interval_days eklendi');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -1430 THEN
                DBMS_OUTPUT.PUT_LINE('⚠ tasks.recurrence_interval_days zaten var');
            ELSE
                RAISE;
            END IF;
    END;

    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE tasks ADD recurrence_parent_task_id VARCHAR2(36)';
        DBMS_OUTPUT.PUT_LINE('✓ tasks.recurrence_parent_task_id eklendi');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -1430 THEN
                DBMS_OUTPUT.PUT_LINE('⚠ tasks.recurrence_parent_task_id zaten var');
            ELSE
                RAISE;
            END IF;
    END;

    BEGIN
        EXECUTE IMMEDIATE '
            ALTER TABLE tasks ADD CONSTRAINT fk_tasks_recurrence_parent
            FOREIGN KEY (recurrence_parent_task_id) REFERENCES tasks(id)
        ';
        DBMS_OUTPUT.PUT_LINE('✓ fk_tasks_recurrence_parent eklendi');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -2275 THEN
                DBMS_OUTPUT.PUT_LINE('⚠ fk_tasks_recurrence_parent zaten var');
            ELSE
                RAISE;
            END IF;
    END;

    BEGIN
        EXECUTE IMMEDIATE '
            ALTER TABLE tasks ADD CONSTRAINT chk_tasks_recurrence_mode
            CHECK (recurrence_mode IN (''fixed_schedule'', ''completion_driven'') OR recurrence_mode IS NULL)
        ';
        DBMS_OUTPUT.PUT_LINE('✓ chk_tasks_recurrence_mode eklendi');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -2261 THEN
                DBMS_OUTPUT.PUT_LINE('⚠ chk_tasks_recurrence_mode zaten var');
            ELSE
                RAISE;
            END IF;
    END;

    BEGIN
        EXECUTE IMMEDIATE '
            ALTER TABLE tasks ADD CONSTRAINT chk_tasks_recurrence_enabled
            CHECK (recurrence_enabled IN (0, 1))
        ';
        DBMS_OUTPUT.PUT_LINE('✓ chk_tasks_recurrence_enabled eklendi');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -2261 THEN
                DBMS_OUTPUT.PUT_LINE('⚠ chk_tasks_recurrence_enabled zaten var');
            ELSE
                RAISE;
            END IF;
    END;

    BEGIN
        EXECUTE IMMEDIATE '
            ALTER TABLE tasks ADD CONSTRAINT chk_tasks_recurrence_interval
            CHECK (recurrence_interval_days IS NULL OR recurrence_interval_days >= 1)
        ';
        DBMS_OUTPUT.PUT_LINE('✓ chk_tasks_recurrence_interval eklendi');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -2261 THEN
                DBMS_OUTPUT.PUT_LINE('⚠ chk_tasks_recurrence_interval zaten var');
            ELSE
                RAISE;
            END IF;
    END;

    BEGIN
        EXECUTE IMMEDIATE 'CREATE INDEX idx_tasks_recurrence_parent ON tasks(recurrence_parent_task_id)';
        DBMS_OUTPUT.PUT_LINE('✓ idx_tasks_recurrence_parent index oluşturuldu');
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLCODE = -955 THEN
                DBMS_OUTPUT.PUT_LINE('⚠ idx_tasks_recurrence_parent zaten var');
            ELSE
                RAISE;
            END IF;
    END;

    DBMS_OUTPUT.PUT_LINE('✅ Migration 014_add_profile_managers_and_task_recurrence tamamlandı');
END;
/
