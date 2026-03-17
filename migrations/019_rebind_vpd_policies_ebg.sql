-- Rebind VPD policies to EBG_* tables (post-prefix schema)
-- Date: 2026-03-06

BEGIN
    -- Drop old policy bindings if present
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'EBG_FOLDERS', 'policy_folders_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'EBG_LISTS', 'policy_lists_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'EBG_TASKS', 'policy_tasks_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'EBG_COMMENTS', 'policy_comments_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'EBG_TASK_ATTACHMENTS', 'policy_attachments_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'EBG_TASK_ASSIGNEES', 'policy_assignees_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'EBG_FOLDER_MEMBERS', 'policy_members_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'EBG_PROFILES', 'policy_profiles_access'); EXCEPTION WHEN OTHERS THEN NULL; END;

    -- Also try dropping from synonym names (legacy)
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'folders', 'policy_folders_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'lists', 'policy_lists_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'tasks', 'policy_tasks_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'comments', 'policy_comments_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'task_attachments', 'policy_attachments_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'task_assignees', 'policy_assignees_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'folder_members', 'policy_members_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'profiles', 'policy_profiles_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
END;
/

BEGIN
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
