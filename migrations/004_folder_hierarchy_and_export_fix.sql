-- Add parent_id to folders for hierarchy support
-- Add completed_at to tasks for reporting accuracy

SET SERVEROUTPUT ON;

BEGIN
    -- Add parent_id to folders
    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE folders ADD parent_id VARCHAR2(36)';
        DBMS_OUTPUT.PUT_LINE('✓ folders.parent_id added');
    EXCEPTION WHEN OTHERS THEN
        IF SQLCODE = -1430 THEN DBMS_OUTPUT.PUT_LINE('⚠ folders.parent_id already exists');
        ELSE RAISE; END IF;
    END;
    
    -- Add completed_at to tasks
    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE tasks ADD completed_at TIMESTAMP WITH TIME ZONE';
        DBMS_OUTPUT.PUT_LINE('✓ tasks.completed_at added');
    EXCEPTION WHEN OTHERS THEN
        IF SQLCODE = -1430 THEN DBMS_OUTPUT.PUT_LINE('⚠ tasks.completed_at already exists');
        ELSE RAISE; END IF;
    END;
    
    -- Add foreign key for folder hierarchy (safe)
    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE folders ADD CONSTRAINT fk_folders_parent 
            FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE';
        DBMS_OUTPUT.PUT_LINE('✓ fk_folders_parent added');
    EXCEPTION WHEN OTHERS THEN
        IF SQLCODE IN (-2275, -2264) THEN DBMS_OUTPUT.PUT_LINE('⚠ fk_folders_parent already exists');
        ELSE RAISE; END IF;
    END;
    
    -- Update existing tasks to have completed_at if is_completed is 1
    EXECUTE IMMEDIATE 'UPDATE tasks SET completed_at = updated_at WHERE is_completed = 1 AND completed_at IS NULL';
    
    COMMIT;
    DBMS_OUTPUT.PUT_LINE('✅ Migration 004 completed');
END;
/
