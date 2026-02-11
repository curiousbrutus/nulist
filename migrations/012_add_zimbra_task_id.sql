-- Migration to add zimbra_task_id to task_assignees
-- This allows two-way sync mapping between NeoList assignments and Zimbra tasks

BEGIN
    BEGIN
        EXECUTE IMMEDIATE 'ALTER TABLE task_assignees ADD zimbra_task_id VARCHAR2(255)';
    EXCEPTION WHEN OTHERS THEN
        IF SQLCODE != -1430 THEN RAISE; END IF;
    END;
END;

