-- Phase 1 Organization Foundation
-- Adds normalized facility/department model and permission matrix
-- Compatible with EBG_* table naming by creating synonyms

CREATE TABLE EBG_FACILITIES (
    id VARCHAR2(36) PRIMARY KEY,
    code VARCHAR2(30) UNIQUE,
    name VARCHAR2(120) NOT NULL UNIQUE,
    timezone VARCHAR2(64) DEFAULT 'Europe/Istanbul',
    address VARCHAR2(500),
    is_active NUMBER(1) DEFAULT 1 NOT NULL CHECK (is_active IN (0, 1)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP
);

CREATE TABLE EBG_DEPARTMENTS (
    id VARCHAR2(36) PRIMARY KEY,
    facility_id VARCHAR2(36) NOT NULL,
    parent_id VARCHAR2(36),
    name VARCHAR2(150) NOT NULL,
    category VARCHAR2(80),
    is_active NUMBER(1) DEFAULT 1 NOT NULL CHECK (is_active IN (0, 1)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP,
    CONSTRAINT fk_ebg_dept_fac FOREIGN KEY (facility_id) REFERENCES EBG_FACILITIES(id) ON DELETE CASCADE,
    CONSTRAINT fk_ebg_dept_parent FOREIGN KEY (parent_id) REFERENCES EBG_DEPARTMENTS(id) ON DELETE SET NULL,
    CONSTRAINT uq_ebg_dept_fac_name UNIQUE (facility_id, name)
);

CREATE TABLE EBG_USER_FACILITIES (
    id VARCHAR2(36) PRIMARY KEY,
    user_id VARCHAR2(36) NOT NULL,
    facility_id VARCHAR2(36) NOT NULL,
    is_primary NUMBER(1) DEFAULT 0 NOT NULL CHECK (is_primary IN (0, 1)),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP,
    assigned_by VARCHAR2(36),
    CONSTRAINT fk_ebg_usr_fac_fac FOREIGN KEY (facility_id) REFERENCES EBG_FACILITIES(id) ON DELETE CASCADE,
    CONSTRAINT uq_ebg_user_facilities UNIQUE (user_id, facility_id)
);

CREATE TABLE EBG_USER_DEPARTMENTS (
    id VARCHAR2(36) PRIMARY KEY,
    user_id VARCHAR2(36) NOT NULL,
    department_id VARCHAR2(36) NOT NULL,
    is_primary NUMBER(1) DEFAULT 0 NOT NULL CHECK (is_primary IN (0, 1)),
    assigned_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP,
    assigned_by VARCHAR2(36),
    CONSTRAINT fk_ebg_usr_dept_dept FOREIGN KEY (department_id) REFERENCES EBG_DEPARTMENTS(id) ON DELETE CASCADE,
    CONSTRAINT uq_ebg_user_departments UNIQUE (user_id, department_id)
);

CREATE TABLE EBG_ROLE_PERMISSIONS (
    id VARCHAR2(36) PRIMARY KEY,
    role_name VARCHAR2(50) NOT NULL,
    permission_key VARCHAR2(100) NOT NULL,
    is_allowed NUMBER(1) DEFAULT 1 NOT NULL CHECK (is_allowed IN (0, 1)),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT SYSTIMESTAMP,
    CONSTRAINT uq_ebg_role_permissions UNIQUE (role_name, permission_key)
);

CREATE OR REPLACE SYNONYM facilities FOR EBG_FACILITIES;
CREATE OR REPLACE SYNONYM departments FOR EBG_DEPARTMENTS;
CREATE OR REPLACE SYNONYM user_facilities FOR EBG_USER_FACILITIES;
CREATE OR REPLACE SYNONYM user_departments FOR EBG_USER_DEPARTMENTS;
CREATE OR REPLACE SYNONYM role_permissions FOR EBG_ROLE_PERMISSIONS;

ALTER TABLE EBG_PROFILES ADD primary_facility_id VARCHAR2(36);
ALTER TABLE EBG_PROFILES ADD user_status VARCHAR2(20) DEFAULT 'active' NOT NULL;

CREATE INDEX idx_ebg_departments_facility ON EBG_DEPARTMENTS(facility_id);
CREATE INDEX idx_ebg_departments_parent ON EBG_DEPARTMENTS(parent_id);
CREATE INDEX idx_ebg_user_facilities_user ON EBG_USER_FACILITIES(user_id);
CREATE INDEX idx_ebg_user_departments_user ON EBG_USER_DEPARTMENTS(user_id);
CREATE INDEX idx_profiles_primary_facility ON EBG_PROFILES(primary_facility_id);
CREATE INDEX idx_profiles_user_status ON EBG_PROFILES(user_status);

INSERT INTO facilities (id, code, name)
SELECT SYS_GUID(), UPPER(REPLACE(TRIM(src.branch), ' ', '_')), TRIM(src.branch)
FROM (
    SELECT DISTINCT branch FROM EBG_PROFILES WHERE branch IS NOT NULL
) src
WHERE TRIM(src.branch) IS NOT NULL
  AND TRIM(src.branch) <> ''
  AND TRIM(src.branch) NOT IN ('Tüm Şubeler', 'TUM_SUBELER', 'ALL')
  AND NOT EXISTS (
      SELECT 1 FROM facilities f WHERE f.name = TRIM(src.branch)
  );

UPDATE EBG_PROFILES p
SET primary_facility_id = (
    SELECT f.id
    FROM facilities f
    WHERE f.name = p.branch
      AND ROWNUM = 1
)
WHERE p.primary_facility_id IS NULL
  AND p.branch IS NOT NULL
  AND TRIM(p.branch) NOT IN ('', 'Tüm Şubeler', 'TUM_SUBELER', 'ALL')
  AND EXISTS (
      SELECT 1 FROM facilities f WHERE f.name = p.branch
  );

INSERT INTO role_permissions (id, role_name, permission_key, is_allowed)
SELECT SYS_GUID(), x.role_name, x.permission_key, 1
FROM (
    SELECT 'user' AS role_name, 'task.view' AS permission_key FROM dual
    UNION ALL SELECT 'user', 'task.comment' FROM dual
    UNION ALL SELECT 'user', 'task.update_own' FROM dual
    UNION ALL SELECT 'secretary', 'task.assign_branch' FROM dual
    UNION ALL SELECT 'secretary', 'task.view_branch' FROM dual
    UNION ALL SELECT 'secretary', 'profile.manage_branch' FROM dual
    UNION ALL SELECT 'admin', 'task.assign_all' FROM dual
    UNION ALL SELECT 'admin', 'folder.delete_department' FROM dual
    UNION ALL SELECT 'admin', 'reports.view_all' FROM dual
    UNION ALL SELECT 'superadmin', 'system.manage' FROM dual
    UNION ALL SELECT 'superadmin', 'security.manage_rbac' FROM dual
) x
WHERE NOT EXISTS (
    SELECT 1
    FROM role_permissions rp
    WHERE rp.role_name = x.role_name
      AND rp.permission_key = x.permission_key
);
