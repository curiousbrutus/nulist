-- Align VPD/RBAC for assignment workflow (Phase-2)
-- Date: 2026-03-06

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
                OR UPPER(TRIM(NVL(f.branch, ''''))) = UPPER(TRIM(fac.name))
                OR UPPER(TRIM(NVL(pf.branch, ''''))) = UPPER(TRIM(fac.name))
                OR f.branch IS NULL
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
                  AND (
                      UPPER(TRIM(NVL(pf.title, f.title))) = UPPER(TRIM(fac.name))
                      OR UPPER(TRIM(NVL(f.branch, ''''))) = UPPER(TRIM(fac.name))
                      OR UPPER(TRIM(NVL(pf.branch, ''''))) = UPPER(TRIM(fac.name))
                      OR f.branch IS NULL
                  )
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
                  AND (
                      UPPER(TRIM(NVL(pf.title, f.title))) = UPPER(TRIM(fac.name))
                      OR UPPER(TRIM(NVL(f.branch, ''''))) = UPPER(TRIM(fac.name))
                      OR UPPER(TRIM(NVL(pf.branch, ''''))) = UPPER(TRIM(fac.name))
                      OR f.branch IS NULL
                  )
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
                  AND (
                      UPPER(TRIM(NVL(pf.title, f.title))) = UPPER(TRIM(fac.name))
                      OR UPPER(TRIM(NVL(f.branch, ''''))) = UPPER(TRIM(fac.name))
                      OR UPPER(TRIM(NVL(pf.branch, ''''))) = UPPER(TRIM(fac.name))
                      OR f.branch IS NULL
                  )
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
                  AND (
                      UPPER(TRIM(NVL(pf.title, f.title))) = UPPER(TRIM(fac.name))
                      OR UPPER(TRIM(NVL(f.branch, ''''))) = UPPER(TRIM(fac.name))
                      OR UPPER(TRIM(NVL(pf.branch, ''''))) = UPPER(TRIM(fac.name))
                      OR f.branch IS NULL
                  )
            )
    )';
EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN '1=2';
END;
/
