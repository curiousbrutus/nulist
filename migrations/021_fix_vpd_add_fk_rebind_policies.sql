-- ============================================================
-- Migration 021: Fix VPD functions, add missing FKs, rebind policies
-- Date: 2026-03-14
-- Purpose:
--   1. Fix f.branch references in VPD functions (EBG_FOLDERS has no BRANCH column)
--   2. Add missing foreign key constraints
--   3. Drop and re-add VPD policies with corrected functions
-- ============================================================

-- ============================================================
-- PART 1: Fix VPD Security Functions (remove f.branch references)
-- ============================================================

CREATE OR REPLACE FUNCTION fn_security_tasks (
    p_schema IN VARCHAR2,
    p_object IN VARCHAR2
) RETURN VARCHAR2 IS
    v_uid VARCHAR2(36);
    v_role VARCHAR2(20);
    v_is_superadmin NUMBER;
BEGIN
    v_uid := pkg_session_mgr.get_user();
    IF v_uid IS NULL THEN RETURN '1=2'; END IF;

    v_is_superadmin := fn_is_superadmin(v_uid);
    IF v_is_superadmin = 1 THEN RETURN '1=1'; END IF;

    SELECT role INTO v_role FROM profiles WHERE id = v_uid;
    IF v_role IN ('admin', 'superadmin') THEN RETURN '1=1'; END IF;

    RETURN '(
        created_by = ''' || v_uid || '''
        OR id IN (SELECT task_id FROM task_assignees WHERE user_id = ''' || v_uid || ''')
        OR list_id IN (
            SELECT l.id
            FROM lists l
            JOIN folders f ON f.id = l.folder_id
            WHERE f.user_id = ''' || v_uid || '''
               OR l.folder_id IN (SELECT folder_id FROM folder_members WHERE user_id = ''' || v_uid || ''')
        )
        OR list_id IN (
            SELECT l.id
            FROM lists l
            JOIN folders f ON f.id = l.folder_id
            LEFT JOIN folders pf ON pf.id = f.parent_id
            JOIN user_departments ud ON ud.user_id = ''' || v_uid || '''
            JOIN departments d ON d.id = ud.department_id
            JOIN facilities fac ON fac.id = d.facility_id
            WHERE (
                UPPER(TRIM(f.title)) = UPPER(TRIM(d.name))
                OR UPPER(TRIM(NVL(pf.title, ''''))) = UPPER(TRIM(d.name))
            )
            AND (
                UPPER(TRIM(NVL(pf.title, f.title))) = UPPER(TRIM(fac.name))
            )
        )
    )';
EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN '1=2';
END;
/

CREATE OR REPLACE FUNCTION fn_security_comments (
    p_schema IN VARCHAR2,
    p_object IN VARCHAR2
) RETURN VARCHAR2 IS
    v_uid VARCHAR2(36);
    v_role VARCHAR2(20);
    v_is_superadmin NUMBER;
BEGIN
    v_uid := pkg_session_mgr.get_user();
    IF v_uid IS NULL THEN RETURN '1=2'; END IF;

    v_is_superadmin := fn_is_superadmin(v_uid);
    IF v_is_superadmin = 1 THEN RETURN '1=1'; END IF;

    SELECT role INTO v_role FROM profiles WHERE id = v_uid;
    IF v_role IN ('admin', 'superadmin') THEN RETURN '1=1'; END IF;

    RETURN 'task_id IN (
        SELECT t.id
        FROM tasks t
        JOIN lists l ON l.id = t.list_id
        JOIN folders f ON f.id = l.folder_id
        LEFT JOIN folders pf ON pf.id = f.parent_id
        WHERE
            t.created_by = ''' || v_uid || '''
            OR t.id IN (SELECT task_id FROM task_assignees WHERE user_id = ''' || v_uid || ''')
            OR f.user_id = ''' || v_uid || '''
            OR l.folder_id IN (SELECT folder_id FROM folder_members WHERE user_id = ''' || v_uid || ''')
            OR EXISTS (
                SELECT 1
                FROM user_departments ud
                JOIN departments d ON d.id = ud.department_id
                JOIN facilities fac ON fac.id = d.facility_id
                WHERE ud.user_id = ''' || v_uid || '''
                  AND (
                      UPPER(TRIM(f.title)) = UPPER(TRIM(d.name))
                      OR UPPER(TRIM(NVL(pf.title, ''''))) = UPPER(TRIM(d.name))
                  )
                  AND UPPER(TRIM(NVL(pf.title, f.title))) = UPPER(TRIM(fac.name))
            )
    )';
EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN '1=2';
END;
/

CREATE OR REPLACE FUNCTION fn_security_attachments (
    p_schema IN VARCHAR2,
    p_object IN VARCHAR2
) RETURN VARCHAR2 IS
    v_uid VARCHAR2(36);
    v_role VARCHAR2(20);
    v_is_superadmin NUMBER;
BEGIN
    v_uid := pkg_session_mgr.get_user();
    IF v_uid IS NULL THEN RETURN '1=2'; END IF;

    v_is_superadmin := fn_is_superadmin(v_uid);
    IF v_is_superadmin = 1 THEN RETURN '1=1'; END IF;

    SELECT role INTO v_role FROM profiles WHERE id = v_uid;
    IF v_role IN ('admin', 'superadmin') THEN RETURN '1=1'; END IF;

    RETURN 'task_id IN (
        SELECT t.id
        FROM tasks t
        JOIN lists l ON l.id = t.list_id
        JOIN folders f ON f.id = l.folder_id
        LEFT JOIN folders pf ON pf.id = f.parent_id
        WHERE
            t.created_by = ''' || v_uid || '''
            OR t.id IN (SELECT task_id FROM task_assignees WHERE user_id = ''' || v_uid || ''')
            OR f.user_id = ''' || v_uid || '''
            OR l.folder_id IN (SELECT folder_id FROM folder_members WHERE user_id = ''' || v_uid || ''')
            OR EXISTS (
                SELECT 1
                FROM user_departments ud
                JOIN departments d ON d.id = ud.department_id
                JOIN facilities fac ON fac.id = d.facility_id
                WHERE ud.user_id = ''' || v_uid || '''
                  AND (
                      UPPER(TRIM(f.title)) = UPPER(TRIM(d.name))
                      OR UPPER(TRIM(NVL(pf.title, ''''))) = UPPER(TRIM(d.name))
                  )
                  AND UPPER(TRIM(NVL(pf.title, f.title))) = UPPER(TRIM(fac.name))
            )
    )';
EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN '1=2';
END;
/

CREATE OR REPLACE FUNCTION fn_security_assignees (
    p_schema IN VARCHAR2,
    p_object IN VARCHAR2
) RETURN VARCHAR2 IS
    v_uid VARCHAR2(36);
    v_role VARCHAR2(20);
    v_is_superadmin NUMBER;
BEGIN
    v_uid := pkg_session_mgr.get_user();
    IF v_uid IS NULL THEN RETURN '1=2'; END IF;

    v_is_superadmin := fn_is_superadmin(v_uid);
    IF v_is_superadmin = 1 THEN RETURN '1=1'; END IF;

    SELECT role INTO v_role FROM profiles WHERE id = v_uid;
    IF v_role IN ('admin', 'superadmin') THEN RETURN '1=1'; END IF;

    RETURN 'task_id IN (
        SELECT t.id
        FROM tasks t
        JOIN lists l ON l.id = t.list_id
        JOIN folders f ON f.id = l.folder_id
        LEFT JOIN folders pf ON pf.id = f.parent_id
        WHERE
            t.created_by = ''' || v_uid || '''
            OR t.id IN (SELECT task_id FROM task_assignees WHERE user_id = ''' || v_uid || ''')
            OR f.user_id = ''' || v_uid || '''
            OR l.folder_id IN (SELECT folder_id FROM folder_members WHERE user_id = ''' || v_uid || ''')
            OR EXISTS (
                SELECT 1
                FROM user_departments ud
                JOIN departments d ON d.id = ud.department_id
                JOIN facilities fac ON fac.id = d.facility_id
                WHERE ud.user_id = ''' || v_uid || '''
                  AND (
                      UPPER(TRIM(f.title)) = UPPER(TRIM(d.name))
                      OR UPPER(TRIM(NVL(pf.title, ''''))) = UPPER(TRIM(d.name))
                  )
                  AND UPPER(TRIM(NVL(pf.title, f.title))) = UPPER(TRIM(fac.name))
            )
    )';
EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN '1=2';
END;
/

CREATE OR REPLACE FUNCTION fn_security_members (
    p_schema IN VARCHAR2,
    p_object IN VARCHAR2
) RETURN VARCHAR2 IS
    v_uid VARCHAR2(36);
    v_role VARCHAR2(20);
    v_is_superadmin NUMBER;
BEGIN
    v_uid := pkg_session_mgr.get_user();
    IF v_uid IS NULL THEN RETURN '1=2'; END IF;

    v_is_superadmin := fn_is_superadmin(v_uid);
    IF v_is_superadmin = 1 THEN RETURN '1=1'; END IF;

    SELECT role INTO v_role FROM profiles WHERE id = v_uid;
    IF v_role IN ('admin', 'superadmin') THEN RETURN '1=1'; END IF;

    RETURN 'folder_id IN (
        SELECT f.id
        FROM folders f
        LEFT JOIN folders pf ON pf.id = f.parent_id
        WHERE
            f.user_id = ''' || v_uid || '''
            OR f.id IN (SELECT folder_id FROM folder_members WHERE user_id = ''' || v_uid || ''')
            OR EXISTS (
                SELECT 1
                FROM user_departments ud
                JOIN departments d ON d.id = ud.department_id
                JOIN facilities fac ON fac.id = d.facility_id
                WHERE ud.user_id = ''' || v_uid || '''
                  AND (
                      UPPER(TRIM(f.title)) = UPPER(TRIM(d.name))
                      OR UPPER(TRIM(NVL(pf.title, ''''))) = UPPER(TRIM(d.name))
                  )
                  AND UPPER(TRIM(NVL(pf.title, f.title))) = UPPER(TRIM(fac.name))
            )
    )';
EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN '1=2';
END;
/


-- ============================================================
-- PART 2: Add missing foreign key constraints (safe - skip if exists)
-- ============================================================

-- USER_FACILITIES.USER_ID -> PROFILES.ID
BEGIN
    EXECUTE IMMEDIATE 'ALTER TABLE EBG_USER_FACILITIES ADD CONSTRAINT FK_EBG_USR_FAC_USER
        FOREIGN KEY (USER_ID) REFERENCES EBG_PROFILES(ID)';
EXCEPTION WHEN OTHERS THEN
    IF SQLCODE = -2275 OR SQLCODE = -2264 THEN NULL; -- already exists
    ELSE RAISE;
    END IF;
END;
/

-- USER_DEPARTMENTS.USER_ID -> PROFILES.ID
BEGIN
    EXECUTE IMMEDIATE 'ALTER TABLE EBG_USER_DEPARTMENTS ADD CONSTRAINT FK_EBG_USR_DEPT_USER
        FOREIGN KEY (USER_ID) REFERENCES EBG_PROFILES(ID)';
EXCEPTION WHEN OTHERS THEN
    IF SQLCODE = -2275 OR SQLCODE = -2264 THEN NULL;
    ELSE RAISE;
    END IF;
END;
/

-- PROFILES.PRIMARY_FACILITY_ID -> FACILITIES.ID
BEGIN
    EXECUTE IMMEDIATE 'ALTER TABLE EBG_PROFILES ADD CONSTRAINT FK_PROFILES_PRIMARY_FAC
        FOREIGN KEY (PRIMARY_FACILITY_ID) REFERENCES EBG_FACILITIES(ID)';
EXCEPTION WHEN OTHERS THEN
    IF SQLCODE = -2275 OR SQLCODE = -2264 THEN NULL;
    ELSE RAISE;
    END IF;
END;
/

-- EBG_SYNC_QUEUE.TASK_ID -> EBG_TASKS.ID  (optional, may fail if orphan data)
BEGIN
    EXECUTE IMMEDIATE 'ALTER TABLE EBG_SYNC_QUEUE ADD CONSTRAINT FK_SYNC_QUEUE_TASK
        FOREIGN KEY (TASK_ID) REFERENCES EBG_TASKS(ID) ON DELETE CASCADE';
EXCEPTION WHEN OTHERS THEN
    IF SQLCODE IN (-2275, -2264, -2298) THEN NULL; -- exists or orphan data
    ELSE RAISE;
    END IF;
END;
/

-- INAPP_NOTIFICATIONS.USER_ID -> EBG_PROFILES.ID  (cross-schema, may fail)
BEGIN
    EXECUTE IMMEDIATE 'ALTER TABLE INAPP_NOTIFICATIONS ADD CONSTRAINT FK_INAPP_NOTIF_USER
        FOREIGN KEY (USER_ID) REFERENCES EBG_PROFILES(ID)';
EXCEPTION WHEN OTHERS THEN
    IF SQLCODE IN (-2275, -2264, -2298, -2270) THEN NULL;
    ELSE RAISE;
    END IF;
END;
/

-- Add index for EBG_TASKS.LIST_ID (performance: joins on this column heavily)
BEGIN
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_TASKS_LIST_ID ON EBG_TASKS(LIST_ID)';
EXCEPTION WHEN OTHERS THEN
    IF SQLCODE = -1408 THEN NULL; -- already exists
    ELSE RAISE;
    END IF;
END;
/

-- Add index for EBG_TASKS.CREATED_BY
BEGIN
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_TASKS_CREATED_BY ON EBG_TASKS(CREATED_BY)';
EXCEPTION WHEN OTHERS THEN
    IF SQLCODE = -1408 THEN NULL;
    ELSE RAISE;
    END IF;
END;
/

-- Add index for EBG_COMMENTS.TASK_ID
BEGIN
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_COMMENTS_TASK_ID ON EBG_COMMENTS(TASK_ID)';
EXCEPTION WHEN OTHERS THEN
    IF SQLCODE = -1408 THEN NULL;
    ELSE RAISE;
    END IF;
END;
/

-- Add index for EBG_TASK_ATTACHMENTS.TASK_ID
BEGIN
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_ATTACHMENTS_TASK_ID ON EBG_TASK_ATTACHMENTS(TASK_ID)';
EXCEPTION WHEN OTHERS THEN
    IF SQLCODE = -1408 THEN NULL;
    ELSE RAISE;
    END IF;
END;
/

-- Add index for EBG_LISTS.FOLDER_ID
BEGIN
    EXECUTE IMMEDIATE 'CREATE INDEX IDX_LISTS_FOLDER_ID ON EBG_LISTS(FOLDER_ID)';
EXCEPTION WHEN OTHERS THEN
    IF SQLCODE = -1408 THEN NULL;
    ELSE RAISE;
    END IF;
END;
/


-- ============================================================
-- PART 3: Drop and re-add VPD policies (corrected functions)
-- ============================================================

BEGIN
    -- Drop all existing policies
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'EBG_FOLDERS',          'policy_folders_access');     EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'EBG_LISTS',            'policy_lists_access');       EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'EBG_TASKS',            'policy_tasks_access');       EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'EBG_COMMENTS',         'policy_comments_access');    EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'EBG_TASK_ATTACHMENTS', 'policy_attachments_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'EBG_TASK_ASSIGNEES',   'policy_assignees_access');   EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'EBG_FOLDER_MEMBERS',   'policy_members_access');     EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'EBG_PROFILES',         'policy_profiles_access');    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- Re-add with corrected functions
    DBMS_RLS.ADD_POLICY(
        object_schema   => USER,
        object_name     => 'EBG_FOLDERS',
        policy_name     => 'policy_folders_access',
        function_schema => USER,
        policy_function => 'fn_security_folders',
        statement_types => 'SELECT,INSERT,UPDATE,DELETE',
        update_check    => TRUE
    );

    DBMS_RLS.ADD_POLICY(
        object_schema   => USER,
        object_name     => 'EBG_LISTS',
        policy_name     => 'policy_lists_access',
        function_schema => USER,
        policy_function => 'fn_security_lists',
        statement_types => 'SELECT,INSERT,UPDATE,DELETE',
        update_check    => TRUE
    );

    DBMS_RLS.ADD_POLICY(
        object_schema   => USER,
        object_name     => 'EBG_TASKS',
        policy_name     => 'policy_tasks_access',
        function_schema => USER,
        policy_function => 'fn_security_tasks',
        statement_types => 'SELECT,INSERT,UPDATE,DELETE',
        update_check    => TRUE
    );

    DBMS_RLS.ADD_POLICY(
        object_schema   => USER,
        object_name     => 'EBG_COMMENTS',
        policy_name     => 'policy_comments_access',
        function_schema => USER,
        policy_function => 'fn_security_comments',
        statement_types => 'SELECT,INSERT,UPDATE,DELETE',
        update_check    => TRUE
    );

    DBMS_RLS.ADD_POLICY(
        object_schema   => USER,
        object_name     => 'EBG_TASK_ATTACHMENTS',
        policy_name     => 'policy_attachments_access',
        function_schema => USER,
        policy_function => 'fn_security_attachments',
        statement_types => 'SELECT,INSERT,UPDATE,DELETE',
        update_check    => TRUE
    );

    DBMS_RLS.ADD_POLICY(
        object_schema   => USER,
        object_name     => 'EBG_TASK_ASSIGNEES',
        policy_name     => 'policy_assignees_access',
        function_schema => USER,
        policy_function => 'fn_security_assignees',
        statement_types => 'SELECT,INSERT,UPDATE,DELETE',
        update_check    => TRUE
    );

    DBMS_RLS.ADD_POLICY(
        object_schema   => USER,
        object_name     => 'EBG_FOLDER_MEMBERS',
        policy_name     => 'policy_members_access',
        function_schema => USER,
        policy_function => 'fn_security_members',
        statement_types => 'SELECT,INSERT,UPDATE,DELETE',
        update_check    => TRUE
    );

    DBMS_RLS.ADD_POLICY(
        object_schema   => USER,
        object_name     => 'EBG_PROFILES',
        policy_name     => 'policy_profiles_access',
        function_schema => USER,
        policy_function => 'fn_security_profiles',
        statement_types => 'SELECT,UPDATE',
        update_check    => TRUE
    );
END;
/

-- Record migration
INSERT INTO EBG_SCHEMA_MIGRATIONS (VERSION, NAME, APPLIED_AT)
VALUES (21, '021_fix_vpd_add_fk_rebind_policies', SYSTIMESTAMP);
COMMIT;
