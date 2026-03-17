-- Fix task visibility VPD to include folder owners/members and org department assignments
-- Date: 2026-03-05

CREATE OR REPLACE FUNCTION fn_security_tasks (
    p_schema IN VARCHAR2,
    p_object IN VARCHAR2
) RETURN VARCHAR2 IS
    v_uid VARCHAR2(36);
    v_is_superadmin NUMBER;
    v_user_role VARCHAR2(20);
    v_user_branch VARCHAR2(100);
BEGIN
    v_uid := pkg_session_mgr.get_user();
    IF v_uid IS NULL THEN RETURN '1=2'; END IF;

    v_is_superadmin := fn_is_superadmin(v_uid);
    IF v_is_superadmin = 1 THEN RETURN '1=1'; END IF;

    SELECT role, branch INTO v_user_role, v_user_branch FROM profiles WHERE id = v_uid;

    -- Secretary sees all tasks in their branch
    IF v_user_role = 'secretary' AND v_user_branch IS NOT NULL THEN
        RETURN 'branch = ''' || v_user_branch || '''';
    END IF;

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
            JOIN user_departments ud ON ud.user_id = ''' || v_uid || '''
            JOIN departments d ON d.id = ud.department_id
            JOIN facilities fac ON fac.id = d.facility_id
            WHERE (
                UPPER(TRIM(f.title)) = UPPER(TRIM(d.name))
                OR UPPER(TRIM(NVL((SELECT pf.title FROM folders pf WHERE pf.id = f.parent_id), ''''))) = UPPER(TRIM(d.name))
            )
            AND (
                f.branch IS NULL
                OR UPPER(TRIM(f.branch)) = UPPER(TRIM(fac.name))
            )
        )
    )';
EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN '1=2';
END;
/
