--------------------------------------------------------------------------------
-- WUNDERLIST CLONE - ORACLE FULL MIGRATION SCRIPT
-- Tüm tablolar, foreign key'ler, VPD policy'ler, trigger'lar ve test kullanıcıları
-- Son güncelleme: 2026-01-26
--------------------------------------------------------------------------------

SET SERVEROUTPUT ON;
SET DEFINE OFF;

--------------------------------------------------------------------------------
-- 1. BÖLÜM: TEMİZLİK (Eski nesneleri kaldır)
--------------------------------------------------------------------------------
BEGIN
    -- Önce VPD Policy'leri kaldır
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'folders', 'policy_folders_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'lists', 'policy_lists_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'tasks', 'policy_tasks_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'comments', 'policy_comments_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'task_attachments', 'policy_attachments_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'task_assignees', 'policy_assignees_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'folder_members', 'policy_members_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN DBMS_RLS.DROP_POLICY(USER, 'profiles', 'policy_profiles_access'); EXCEPTION WHEN OTHERS THEN NULL; END;
    
    DBMS_OUTPUT.PUT_LINE('✓ Eski VPD policy''ler temizlendi');
    
    -- Trigger'ları kaldır
    BEGIN EXECUTE IMMEDIATE 'DROP TRIGGER trg_folders_updated_at'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'DROP TRIGGER trg_lists_updated_at'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'DROP TRIGGER trg_profiles_updated_at'; EXCEPTION WHEN OTHERS THEN NULL; END;
    
    DBMS_OUTPUT.PUT_LINE('✓ Eski trigger''lar temizlendi');
    
    -- Tabloları kaldır (Child -> Parent sırası)
    BEGIN EXECUTE IMMEDIATE 'DROP TABLE task_attachments CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'DROP TABLE comments CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'DROP TABLE task_assignees CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'DROP TABLE tasks CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'DROP TABLE lists CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'DROP TABLE folder_members CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'DROP TABLE folders CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'DROP TABLE profiles CASCADE CONSTRAINTS'; EXCEPTION WHEN OTHERS THEN NULL; END;
    
    DBMS_OUTPUT.PUT_LINE('✓ Eski tablolar temizlendi');
    
    -- Package ve Context kaldır
    BEGIN EXECUTE IMMEDIATE 'DROP PACKAGE pkg_session_mgr'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'DROP CONTEXT ctx_app'; EXCEPTION WHEN OTHERS THEN NULL; END;
    
    -- Yardımcı fonksiyonları kaldır
    BEGIN EXECUTE IMMEDIATE 'DROP FUNCTION fn_security_folders'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'DROP FUNCTION fn_security_lists'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'DROP FUNCTION fn_security_tasks'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'DROP FUNCTION fn_security_comments'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'DROP FUNCTION fn_security_attachments'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'DROP FUNCTION fn_security_assignees'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'DROP FUNCTION fn_security_members'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'DROP FUNCTION fn_security_profiles'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'DROP FUNCTION fn_can_access_task'; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN EXECUTE IMMEDIATE 'DROP FUNCTION fn_can_access_folder'; EXCEPTION WHEN OTHERS THEN NULL; END;
    
    DBMS_OUTPUT.PUT_LINE('✓ Eski paket ve fonksiyonlar temizlendi');
END;
/

--------------------------------------------------------------------------------
-- 2. BÖLÜM: TABLOLARIN OLUŞTURULMASI
--------------------------------------------------------------------------------

-- PROFILES (Ana kullanıcı tablosu)
CREATE TABLE profiles (
    id VARCHAR2(36) NOT NULL,           -- UUID
    email VARCHAR2(255),
    full_name VARCHAR2(255),
    avatar_url VARCHAR2(1000),
    password_hash VARCHAR2(255),        -- bcrypt hash
    role VARCHAR2(20) DEFAULT 'user' NOT NULL,  -- user, admin, secretary, superadmin
    branch VARCHAR2(50),                 -- Hospital branch (Site 1, Site 2, Site 3)
    meeting_type VARCHAR2(100),          -- For secretaries: Kalite Kurulu, Yönetim Kurulu, etc.
    department VARCHAR2(100),            -- User department
    telegram_user_id VARCHAR2(50),       -- Telegram user ID for bot integration
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_profiles PRIMARY KEY (id),
    CONSTRAINT uq_profiles_email UNIQUE (email),
    CONSTRAINT chk_profile_role CHECK (role IN ('user', 'admin', 'secretary', 'superadmin'))
);

DBMS_OUTPUT.PUT_LINE('✓ profiles tablosu oluşturuldu');

-- FOLDERS (Departman/Klasörler)
CREATE TABLE folders (
    id VARCHAR2(36) DEFAULT SYS_GUID() NOT NULL,
    user_id VARCHAR2(36) NOT NULL,      -- Klasör sahibi
    title VARCHAR2(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT pk_folders PRIMARY KEY (id)
);

-- FOLDER MEMBERS (Klasör üyelikleri ve izinler)
CREATE TABLE folder_members (
    id VARCHAR2(36) DEFAULT SYS_GUID() NOT NULL,
    folder_id VARCHAR2(36) NOT NULL,
    user_id VARCHAR2(36) NOT NULL,
    role VARCHAR2(20) DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    can_add_task NUMBER(1) DEFAULT 1,
    can_delete_task NUMBER(1) DEFAULT 0,
    can_add_list NUMBER(1) DEFAULT 0,
    can_assign_task NUMBER(1) DEFAULT 1,
    CONSTRAINT pk_folder_members PRIMARY KEY (id),
    CONSTRAINT chk_fm_role CHECK (role IN ('admin', 'member')),
    CONSTRAINT uq_fm_folder_user UNIQUE (folder_id, user_id)
);

-- LISTS (Listeler)
CREATE TABLE lists (
    id VARCHAR2(36) DEFAULT SYS_GUID() NOT NULL,
    folder_id VARCHAR2(36) NOT NULL,
    title VARCHAR2(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    type VARCHAR2(50) DEFAULT 'list',
    CONSTRAINT pk_lists PRIMARY KEY (id)
);

-- TASKS (Görevler)
CREATE TABLE tasks (
    id VARCHAR2(36) DEFAULT SYS_GUID() NOT NULL,
    list_id VARCHAR2(36) NOT NULL,
    title VARCHAR2(255) NOT NULL,
    description CLOB,                   -- Ek açıklama
    is_completed NUMBER(1) DEFAULT 0,
    due_date TIMESTAMP WITH TIME ZONE,
    notes CLOB,
    priority VARCHAR2(50) DEFAULT 'Orta',
    status VARCHAR2(50) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by VARCHAR2(36),
    is_private NUMBER(1) DEFAULT 1,     -- Private tasks visible only to assignees
    branch VARCHAR2(50),                 -- Hospital branch for filtering
    meeting_type VARCHAR2(100),          -- Related meeting type for secretary exports
    CONSTRAINT pk_tasks PRIMARY KEY (id),
    CONSTRAINT chk_task_priority CHECK (priority IN ('Düşük', 'Orta', 'Yüksek', 'Acil'))
);

-- TASK ASSIGNEES (Görev atamaları)
CREATE TABLE task_assignees (
    task_id VARCHAR2(36) NOT NULL,
    user_id VARCHAR2(36) NOT NULL,
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    is_completed NUMBER(1) DEFAULT 0,
    CONSTRAINT pk_task_assignees PRIMARY KEY (task_id, user_id)
);

-- COMMENTS (Görev yorumları)
CREATE TABLE comments (
    id VARCHAR2(36) DEFAULT SYS_GUID() NOT NULL,
    task_id VARCHAR2(36) NOT NULL,
    user_id VARCHAR2(36) NOT NULL,
    content CLOB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_comments PRIMARY KEY (id)
);

-- TASK ATTACHMENTS (Görev ekleri)
CREATE TABLE task_attachments (
    id VARCHAR2(36) DEFAULT SYS_GUID() NOT NULL,
    task_id VARCHAR2(36) NOT NULL,
    user_id VARCHAR2(36) NOT NULL,
    file_name VARCHAR2(255) NOT NULL,
    file_size NUMBER NOT NULL,
    file_type VARCHAR2(100) NOT NULL,
    storage_path VARCHAR2(1000) NOT NULL,
    storage_type VARCHAR2(50) DEFAULT 'local' NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT pk_task_attachments PRIMARY KEY (id)
);

PROMPT '✓ Tüm tablolar oluşturuldu'

--------------------------------------------------------------------------------
-- 3. BÖLÜM: FOREIGN KEY İLİŞKİLERİ
--------------------------------------------------------------------------------

ALTER TABLE folders ADD CONSTRAINT fk_folders_user 
    FOREIGN KEY (user_id) REFERENCES profiles(id);

ALTER TABLE folder_members ADD CONSTRAINT fk_fm_folder 
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE;
    
ALTER TABLE folder_members ADD CONSTRAINT fk_fm_user 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE lists ADD CONSTRAINT fk_lists_folder 
    FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE CASCADE;

ALTER TABLE tasks ADD CONSTRAINT fk_tasks_list 
    FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE;
    
ALTER TABLE tasks ADD CONSTRAINT fk_tasks_creator 
    FOREIGN KEY (created_by) REFERENCES profiles(id);

ALTER TABLE task_assignees ADD CONSTRAINT fk_ta_task 
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
    
ALTER TABLE task_assignees ADD CONSTRAINT fk_ta_user 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE comments ADD CONSTRAINT fk_comments_task 
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
    
ALTER TABLE comments ADD CONSTRAINT fk_comments_user 
    FOREIGN KEY (user_id) REFERENCES profiles(id);

ALTER TABLE task_attachments ADD CONSTRAINT fk_att_task 
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE;
    
ALTER TABLE task_attachments ADD CONSTRAINT fk_att_user 
    FOREIGN KEY (user_id) REFERENCES profiles(id);

PROMPT '✓ Foreign key ilişkileri oluşturuldu'

--------------------------------------------------------------------------------
-- 4. BÖLÜM: TRIGGER'LAR (updated_at otomatik güncelleme)
--------------------------------------------------------------------------------

-- Folders updated_at trigger
CREATE OR REPLACE TRIGGER trg_folders_updated_at
BEFORE UPDATE ON folders
FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

-- Lists updated_at trigger
CREATE OR REPLACE TRIGGER trg_lists_updated_at
BEFORE UPDATE ON lists
FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

-- Profiles updated_at trigger
CREATE OR REPLACE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON profiles
FOR EACH ROW
BEGIN
    :NEW.updated_at := CURRENT_TIMESTAMP;
END;
/

PROMPT '✓ Trigger''lar oluşturuldu'

--------------------------------------------------------------------------------
-- 5. BÖLÜM: RLS ALTYAPISI (CONTEXT & SESSION PACKAGE)
--------------------------------------------------------------------------------

-- Oturum Context'i
CREATE OR REPLACE CONTEXT ctx_app USING pkg_session_mgr;
/

-- Session Management Package - Header
CREATE OR REPLACE PACKAGE pkg_session_mgr IS
    PROCEDURE set_user(p_user_id IN VARCHAR2);
    FUNCTION get_user RETURN VARCHAR2;
END;
/

-- Session Management Package - Body
CREATE OR REPLACE PACKAGE BODY pkg_session_mgr IS
    PROCEDURE set_user(p_user_id IN VARCHAR2) IS
    BEGIN
        DBMS_SESSION.SET_CONTEXT('ctx_app', 'user_id', p_user_id);
    END;

    FUNCTION get_user RETURN VARCHAR2 IS
    BEGIN
        RETURN SYS_CONTEXT('ctx_app', 'user_id');
    END;
END;
/

PROMPT '✓ Session management package oluşturuldu'

--------------------------------------------------------------------------------
-- 6. BÖLÜM: YARDIMCI GÜVENLİK FONKSİYONLARI
--------------------------------------------------------------------------------

-- fn_can_access_folder: Bir folder'a erişim var mı?
CREATE OR REPLACE FUNCTION fn_can_access_folder (
    p_folder_id IN VARCHAR2
) RETURN NUMBER IS
    v_uid VARCHAR2(36);
    v_has_access NUMBER := 0;
BEGIN
    v_uid := pkg_session_mgr.get_user();
    IF v_uid IS NULL THEN RETURN 0; END IF;
    
    SELECT COUNT(*) INTO v_has_access
    FROM DUAL
    WHERE EXISTS (
        SELECT 1 FROM folders WHERE id = p_folder_id AND user_id = v_uid
    ) OR EXISTS (
        SELECT 1 FROM folder_members WHERE folder_id = p_folder_id AND user_id = v_uid
    );
    
    RETURN v_has_access;
END;
/

-- fn_can_access_task: Bir task'a erişim var mı?
CREATE OR REPLACE FUNCTION fn_can_access_task (
    p_task_id IN VARCHAR2
) RETURN NUMBER IS
    v_uid VARCHAR2(36);
    v_has_access NUMBER := 0;
BEGIN
    v_uid := pkg_session_mgr.get_user();
    IF v_uid IS NULL THEN RETURN 0; END IF;
    
    SELECT COUNT(*) INTO v_has_access
    FROM DUAL
    WHERE EXISTS (
        -- Folder sahibi
        SELECT 1 FROM tasks t
        JOIN lists l ON t.list_id = l.id
        JOIN folders f ON l.folder_id = f.id
        WHERE t.id = p_task_id AND f.user_id = v_uid
    ) OR EXISTS (
        -- Folder üyesi
        SELECT 1 FROM tasks t
        JOIN lists l ON t.list_id = l.id
        JOIN folder_members fm ON l.folder_id = fm.folder_id
        WHERE t.id = p_task_id AND fm.user_id = v_uid
    ) OR EXISTS (
        -- Task'a atanmış
        SELECT 1 FROM task_assignees ta
        WHERE ta.task_id = p_task_id AND ta.user_id = v_uid
    );
    
    RETURN v_has_access;
END;
/

PROMPT '✓ Yardımcı güvenlik fonksiyonları oluşturuldu'

--------------------------------------------------------------------------------
-- 7. BÖLÜM: VPD POLICY FONKSİYONLARI
--------------------------------------------------------------------------------

-- Helper function: Check if user is superadmin
CREATE OR REPLACE FUNCTION fn_is_superadmin(p_user_id VARCHAR2) RETURN NUMBER IS
    v_role VARCHAR2(20);
    v_email VARCHAR2(255);
BEGIN
    SELECT role, email INTO v_role, v_email FROM profiles WHERE id = p_user_id;
    
    -- Check role or hardcoded email list
    IF v_role = 'superadmin' 
       OR v_email IN ('eyyubuguven@optimedhastanetakip.com', 'fatihsak@optimedhastanetakip.com') THEN
        RETURN 1;
    END IF;
    
    RETURN 0;
EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN 0;
END;
/

-- FOLDERS: Sahibi veya üyesi olmalısın (superadmin tüm klasörleri görür)
CREATE OR REPLACE FUNCTION fn_security_folders (
    p_schema IN VARCHAR2, 
    p_object IN VARCHAR2
) RETURN VARCHAR2 IS
    v_uid VARCHAR2(36);
    v_is_superadmin NUMBER;
BEGIN
    v_uid := pkg_session_mgr.get_user();
    IF v_uid IS NULL THEN RETURN '1=2'; END IF;
    
    v_is_superadmin := fn_is_superadmin(v_uid);
    IF v_is_superadmin = 1 THEN RETURN '1=1'; END IF;

    RETURN 'user_id = ''' || v_uid || ''' 
            OR id IN (SELECT folder_id FROM folder_members WHERE user_id = ''' || v_uid || ''')';
END;
/

-- LISTS: Klasörüne erişimin varsa listeyi görürsün (superadmin tümünü görür)
CREATE OR REPLACE FUNCTION fn_security_lists (
    p_schema IN VARCHAR2, 
    p_object IN VARCHAR2
) RETURN VARCHAR2 IS
    v_uid VARCHAR2(36);
    v_is_superadmin NUMBER;
BEGIN
    v_uid := pkg_session_mgr.get_user();
    IF v_uid IS NULL THEN RETURN '1=2'; END IF;
    
    v_is_superadmin := fn_is_superadmin(v_uid);
    IF v_is_superadmin = 1 THEN RETURN '1=1'; END IF;

    RETURN 'folder_id IN (
                SELECT id FROM folders WHERE user_id = ''' || v_uid || '''
                UNION 
                SELECT folder_id FROM folder_members WHERE user_id = ''' || v_uid || '''
            )';
END;
/

-- TASKS: Strict privacy - only see tasks you created, are assigned to, or if superadmin
CREATE OR REPLACE FUNCTION fn_security_tasks (
    p_schema IN VARCHAR2, 
    p_object IN VARCHAR2
) RETURN VARCHAR2 IS
    v_uid VARCHAR2(36);
    v_is_superadmin NUMBER;
    v_user_role VARCHAR2(20);
    v_user_branch VARCHAR2(50);
BEGIN
    v_uid := pkg_session_mgr.get_user();
    IF v_uid IS NULL THEN RETURN '1=2'; END IF;
    
    v_is_superadmin := fn_is_superadmin(v_uid);
    IF v_is_superadmin = 1 THEN RETURN '1=1'; END IF;
    
    -- Get user role and branch for secretary filtering
    SELECT role, branch INTO v_user_role, v_user_branch FROM profiles WHERE id = v_uid;
    
    -- Secretary sees all tasks in their branch
    IF v_user_role = 'secretary' AND v_user_branch IS NOT NULL THEN
        RETURN 'branch = ''' || v_user_branch || '''';
    END IF;
    
    -- Regular users and admins: only see tasks they created or are assigned to
    RETURN '(created_by = ''' || v_uid || ''' 
            OR id IN (SELECT task_id FROM task_assignees WHERE user_id = ''' || v_uid || '''))';
EXCEPTION
    WHEN NO_DATA_FOUND THEN RETURN '1=2';
END;
/

-- COMMENTS: Task'a erişim varsa görebilir (superadmin tümünü görür)
CREATE OR REPLACE FUNCTION fn_security_comments (
    p_schema IN VARCHAR2, 
    p_object IN VARCHAR2
) RETURN VARCHAR2 IS
    v_uid VARCHAR2(36);
    v_is_superadmin NUMBER;
BEGIN
    v_uid := pkg_session_mgr.get_user();
    IF v_uid IS NULL THEN RETURN '1=2'; END IF;
    
    v_is_superadmin := fn_is_superadmin(v_uid);
    IF v_is_superadmin = 1 THEN RETURN '1=1'; END IF;
    
    RETURN 'task_id IN (
        SELECT t.id FROM tasks t
        WHERE t.created_by = ''' || v_uid || '''
        OR t.id IN (SELECT task_id FROM task_assignees WHERE user_id = ''' || v_uid || ''')
    )';
END;
/

-- TASK_ATTACHMENTS: Task'a erişim varsa görebilir (superadmin tümünü görür)
CREATE OR REPLACE FUNCTION fn_security_attachments (
    p_schema IN VARCHAR2, 
    p_object IN VARCHAR2
) RETURN VARCHAR2 IS
    v_uid VARCHAR2(36);
    v_is_superadmin NUMBER;
BEGIN
    v_uid := pkg_session_mgr.get_user();
    IF v_uid IS NULL THEN RETURN '1=2'; END IF;
    
    v_is_superadmin := fn_is_superadmin(v_uid);
    IF v_is_superadmin = 1 THEN RETURN '1=1'; END IF;
    
    RETURN 'task_id IN (
        SELECT t.id FROM tasks t
        WHERE t.created_by = ''' || v_uid || '''
        OR t.id IN (SELECT task_id FROM task_assignees WHERE user_id = ''' || v_uid || ''')
    )';
END;
/

-- TASK_ASSIGNEES: Task'a erişim varsa görebilir (superadmin tümünü görür)
CREATE OR REPLACE FUNCTION fn_security_assignees (
    p_schema IN VARCHAR2, 
    p_object IN VARCHAR2
) RETURN VARCHAR2 IS
    v_uid VARCHAR2(36);
    v_is_superadmin NUMBER;
BEGIN
    v_uid := pkg_session_mgr.get_user();
    IF v_uid IS NULL THEN RETURN '1=2'; END IF;
    
    v_is_superadmin := fn_is_superadmin(v_uid);
    IF v_is_superadmin = 1 THEN RETURN '1=1'; END IF;
    
    RETURN 'task_id IN (
        SELECT t.id FROM tasks t
        WHERE t.created_by = ''' || v_uid || '''
        OR t.id IN (SELECT task_id FROM task_assignees ta WHERE ta.user_id = ''' || v_uid || ''')
    )';
END;
/

-- FOLDER_MEMBERS: Folder'a erişimi olan görebilir
CREATE OR REPLACE FUNCTION fn_security_members (
    p_schema IN VARCHAR2, 
    p_object IN VARCHAR2
) RETURN VARCHAR2 IS
    v_uid VARCHAR2(36);
BEGIN
    v_uid := pkg_session_mgr.get_user();
    IF v_uid IS NULL THEN RETURN '1=2'; END IF;
    
    RETURN 'folder_id IN (
        SELECT id FROM folders WHERE user_id = ''' || v_uid || '''
        UNION
        SELECT folder_id FROM folder_members WHERE user_id = ''' || v_uid || '''
    )';
END;
/

-- PROFILES: Login olan herkes görebilir
CREATE OR REPLACE FUNCTION fn_security_profiles (
    p_schema IN VARCHAR2, 
    p_object IN VARCHAR2
) RETURN VARCHAR2 IS
    v_uid VARCHAR2(36);
BEGIN
    v_uid := pkg_session_mgr.get_user();
    IF v_uid IS NULL THEN RETURN '1=2'; END IF;
    RETURN '1=1';
END;
/

PROMPT '✓ VPD policy fonksiyonları oluşturuldu'

--------------------------------------------------------------------------------
-- 8. BÖLÜM: VPD POLİTİKALARININ UYGULANMASI
--------------------------------------------------------------------------------
BEGIN
    -- FOLDERS Güvenliği
    DBMS_RLS.ADD_POLICY (
        object_schema    => USER,
        object_name      => 'folders',
        policy_name      => 'policy_folders_access',
        function_schema  => USER,
        policy_function  => 'fn_security_folders',
        statement_types  => 'SELECT,INSERT,UPDATE,DELETE',
        update_check     => TRUE
    );
    DBMS_OUTPUT.PUT_LINE('✓ folders policy eklendi');
    
    -- LISTS Güvenliği
    DBMS_RLS.ADD_POLICY (
        object_schema    => USER,
        object_name      => 'lists',
        policy_name      => 'policy_lists_access',
        function_schema  => USER,
        policy_function  => 'fn_security_lists',
        statement_types  => 'SELECT,INSERT,UPDATE,DELETE',
        update_check     => TRUE
    );
    DBMS_OUTPUT.PUT_LINE('✓ lists policy eklendi');

    -- TASKS Güvenliği
    DBMS_RLS.ADD_POLICY (
        object_schema    => USER,
        object_name      => 'tasks',
        policy_name      => 'policy_tasks_access',
        function_schema  => USER,
        policy_function  => 'fn_security_tasks',
        statement_types  => 'SELECT,INSERT,UPDATE,DELETE',
        update_check     => TRUE
    );
    DBMS_OUTPUT.PUT_LINE('✓ tasks policy eklendi');
    
    COMMIT;
END;
/

PROMPT '✓ Ana VPD policy''ler eklendi (folders, lists, tasks)'

--------------------------------------------------------------------------------
-- 9. BÖLÜM: TEST KULLANICILARI
--------------------------------------------------------------------------------

-- Admin kullanıcı (şifre: admin123)
MERGE INTO profiles p
USING (SELECT 'test-admin-id' as id FROM DUAL) t
ON (p.id = t.id)
WHEN NOT MATCHED THEN
    INSERT (id, email, full_name, password_hash)
    VALUES (
        'test-admin-id',
        'admin@example.com',
        'Admin User',
        '$2a$10$rOZxQ8qVzB5yH5K5N5N5J.oY5G5K5K5K5K5K5K5K5K5K5K5K5K5K5.'
    );

-- Test üye kullanıcı (şifre: test123)
MERGE INTO profiles p
USING (SELECT 'test-user-id' as id FROM DUAL) t
ON (p.id = t.id)
WHEN NOT MATCHED THEN
    INSERT (id, email, full_name, password_hash)
    VALUES (
        'test-user-id',
        'test@example.com',
        'Test User',
        '$2a$10$test.hash.placeholder.for.password.test123'
    );

COMMIT;

PROMPT '✓ Test kullanıcıları oluşturuldu'

--------------------------------------------------------------------------------
-- 10. BÖLÜM: DOĞRULAMA SORGULARI
--------------------------------------------------------------------------------

PROMPT ''
PROMPT '============================================================'
PROMPT '✅ ORACLE WUNDERLIST SCHEMA KURULUMU TAMAMLANDI!'
PROMPT '============================================================'
PROMPT ''
PROMPT 'Oluşturulan Tablolar:'

SELECT table_name FROM user_tables 
WHERE table_name IN ('PROFILES','FOLDERS','FOLDER_MEMBERS','LISTS','TASKS','TASK_ASSIGNEES','COMMENTS','TASK_ATTACHMENTS')
ORDER BY table_name;

PROMPT ''
PROMPT 'Aktif VPD Policy''ler:'

SELECT object_name, policy_name, enable FROM user_policies ORDER BY object_name;

PROMPT ''
PROMPT 'Test için kullanım:'
PROMPT '  1. BEGIN pkg_session_mgr.set_user(''test-admin-id''); END;'
PROMPT '  2. SELECT * FROM folders;'
PROMPT '  3. INSERT INTO folders (user_id, title) VALUES (''test-admin-id'', ''Test Klasör'');'
PROMPT ''
