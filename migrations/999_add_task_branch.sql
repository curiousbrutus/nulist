-- Migration: Add branch field to tasks for secretary filtering
-- This allows tasks to inherit branch from folders for better access control
-- Date: 2026-02-06

SET SERVEROUTPUT ON;

BEGIN
    -- Step 1: Add branch column to tasks table
    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE tasks ADD branch VARCHAR2(100)';
        DBMS_OUTPUT.PUT_LINE('✓ branch column added to tasks table');
    EXCEPTION WHEN OTHERS THEN
        IF SQLCODE = -1430 THEN 
            DBMS_OUTPUT.PUT_LINE('⚠ branch column already exists');
        ELSE 
            RAISE; 
        END IF;
    END;
    
    -- Step 2: Add branch column to folders table (if not exists)
    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE folders ADD branch VARCHAR2(100)';
        DBMS_OUTPUT.PUT_LINE('✓ branch column added to folders table');
    EXCEPTION WHEN OTHERS THEN
        IF SQLCODE = -1430 THEN 
            DBMS_OUTPUT.PUT_LINE('⚠ branch column already exists in folders');
        ELSE 
            RAISE; 
        END IF;
    END;
    
    -- Step 3: Backfill task branch from folder (via list)
    -- Set task.branch = folder.branch by joining through lists
    DECLARE
        v_updated NUMBER := 0;
    BEGIN
        UPDATE tasks t
        SET branch = (
            SELECT f.branch 
            FROM lists l
            JOIN folders f ON l.folder_id = f.id
            WHERE l.id = t.list_id
            AND f.branch IS NOT NULL
        )
        WHERE branch IS NULL
        AND EXISTS (
            SELECT 1 
            FROM lists l
            JOIN folders f ON l.folder_id = f.id
            WHERE l.id = t.list_id
            AND f.branch IS NOT NULL
        );
        
        v_updated := SQL%ROWCOUNT;
        COMMIT;
        
        IF v_updated > 0 THEN
            DBMS_OUTPUT.PUT_LINE('✓ Backfilled branch for ' || v_updated || ' tasks');
        ELSE
            DBMS_OUTPUT.PUT_LINE('ℹ No tasks needed branch backfill (folders may not have branch set)');
        END IF;
    END;
    
    -- Step 4: Create index on tasks.branch for faster filtering
    BEGIN
        EXECUTE IMMEDIATE 'CREATE INDEX idx_tasks_branch ON tasks(branch)';
        DBMS_OUTPUT.PUT_LINE('✓ Index created on tasks.branch');
    EXCEPTION WHEN OTHERS THEN
        IF SQLCODE = -955 THEN 
            DBMS_OUTPUT.PUT_LINE('⚠ Index idx_tasks_branch already exists');
        ELSE 
            RAISE; 
        END IF;
    END;
    
    -- Step 5: Create trigger to auto-set task branch from folder
    BEGIN
        EXECUTE IMMEDIATE '
        CREATE OR REPLACE TRIGGER trg_task_set_branch
        BEFORE INSERT ON tasks
        FOR EACH ROW
        DECLARE
            v_branch VARCHAR2(100);
        BEGIN
            -- If branch not provided, get it from folder
            IF :NEW.branch IS NULL THEN
                SELECT f.branch INTO v_branch
                FROM lists l
                JOIN folders f ON l.folder_id = f.id
                WHERE l.id = :NEW.list_id
                AND ROWNUM = 1;
                
                :NEW.branch := v_branch;
            END IF;
        EXCEPTION
            WHEN NO_DATA_FOUND THEN
                NULL; -- Keep branch as NULL if folder has no branch
            WHEN OTHERS THEN
                NULL; -- Don''t block insert if trigger fails
        END;
        ';
        DBMS_OUTPUT.PUT_LINE('✓ Trigger trg_task_set_branch created');
    EXCEPTION WHEN OTHERS THEN
        DBMS_OUTPUT.PUT_LINE('⚠ Trigger creation warning: ' || SQLERRM);
    END;
    
    DBMS_OUTPUT.PUT_LINE('');
    DBMS_OUTPUT.PUT_LINE('✅ Migration 999_add_task_branch completed successfully');
    DBMS_OUTPUT.PUT_LINE('');
    DBMS_OUTPUT.PUT_LINE('Next steps:');
    DBMS_OUTPUT.PUT_LINE('1. Ensure folders have branch field populated');
    DBMS_OUTPUT.PUT_LINE('2. Secretary users can now filter tasks by branch');
    DBMS_OUTPUT.PUT_LINE('3. New tasks will auto-inherit branch from folder');
END;
/
