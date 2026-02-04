# RBAC Permission Matrix - NeoList

## User Roles

### System Roles (in `profiles.role`)
1. **superadmin** - Full system access, hardcoded email bypass in VPD
2. **admin** - System administration, can bypass VPD for management tasks
3. **secretary** - Branch-filtered access, can see all tasks in their branch
4. **user** - Standard user with folder-based permissions

### Folder Roles (in `folder_members.role`)
1. **admin** - Folder administrator
2. **member** - Regular folder member

## Permission Matrix

### Task Operations

| Action | Superadmin | Admin | Folder Owner | Folder Member (can_assign_task) | Task Creator | Standard User |
|--------|-----------|-------|--------------|--------------------------------|--------------|---------------|
| **View Task** | ✅ All | ✅ All | ✅ Own folders | ✅ Member folders | ✅ Created tasks | ✅ Assigned tasks |
| **Create Task** | ✅ | ✅ | ✅ | ✅ (if can_add_task) | ✅ | ❌ |
| **Edit Task** | ✅ | ✅ | ✅ Own folders | ✅ Member folders | ✅ Created tasks | ✅ Assigned tasks |
| **Delete Task** | ✅ | ✅ | ✅ Own folders | ✅ Own tasks (if can_delete_task) | ✅ Own tasks (if permitted) | ❌ |
| **Assign Task** | ✅ | ✅ | ✅ Own folders | ✅ (if can_assign_task) | ✅ Own tasks | ❌ |
| **Complete Task** | ✅ | ✅ | ✅ Own folders | ✅ Member folders | ✅ Created tasks | ✅ Assigned tasks |
| **Add Comment** | ✅ | ✅ | ✅ Own folders | ✅ Member folders | ✅ Created tasks | ✅ Assigned tasks |
| **Add Attachment** | ✅ | ✅ | ✅ Own folders | ✅ Member folders | ✅ Created tasks | ✅ Assigned tasks |

### Folder Operations

| Action | Superadmin | Admin | Folder Owner | Folder Admin | Folder Member | Standard User |
|--------|-----------|-------|--------------|--------------|---------------|---------------|
| **View Folder** | ✅ All | ✅ All | ✅ Own | ✅ Member folders | ✅ Member folders | ❌ |
| **Create Folder** | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ Own |
| **Edit Folder** | ✅ All | ✅ All | ✅ Own | ✅ Member folders | ❌ | ❌ |
| **Delete Folder** | ✅ All | ✅ All | ✅ Own | ❌ | ❌ | ❌ |
| **Add Members** | ✅ All | ✅ All | ✅ Own | ✅ Member folders | ❌ | ❌ |
| **Remove Members** | ✅ All | ✅ All | ✅ Own | ✅ Member folders | ❌ | ❌ |
| **Change Permissions** | ✅ All | ✅ All | ✅ Own | ✅ Member folders | ❌ | ❌ |

### List Operations

| Action | Superadmin | Admin | Folder Owner | Folder Member (can_add_list) | Standard User |
|--------|-----------|-------|--------------|------------------------------|---------------|
| **View List** | ✅ All | ✅ All | ✅ Own folders | ✅ Member folders | ✅ Assigned tasks |
| **Create List** | ✅ | ✅ | ✅ Own folders | ✅ (if can_add_list) | ❌ |
| **Edit List** | ✅ | ✅ | ✅ Own folders | ✅ Member folders | ❌ |
| **Delete List** | ✅ | ✅ | ✅ Own folders | ❌ | ❌ |

### Admin Operations

| Action | Superadmin | Admin | Secretary | User |
|--------|-----------|-------|-----------|------|
| **View All Users** | ✅ | ✅ | ❌ | ❌ |
| **Edit User Roles** | ✅ Only | ❌ | ❌ | ❌ |
| **Delete Users** | ✅ | ✅ | ❌ | ❌ |
| **View All Tasks** | ✅ | ✅ | ✅ Branch only | ❌ |
| **View Statistics** | ✅ | ✅ | ❌ | ❌ |
| **Import Tasks** | ✅ | ✅ | ❌ | ❌ |
| **Manage Sync** | ✅ | ❌ | ✅ | ❌ |

## Folder Member Permissions

Granular permissions that can be set per folder member:

| Permission | Default | Description |
|-----------|---------|-------------|
| **can_add_task** | ✅ (1) | Can create tasks in the folder |
| **can_assign_task** | ✅ (1) | Can assign tasks to other users |
| **can_delete_task** | ❌ (0) | Can delete tasks (only own tasks) |
| **can_add_list** | ❌ (0) | Can create new lists in the folder |

## VPD (Virtual Private Database) Rules

### How VPD Works
- When `userId` is passed to `executeQuery()`, Oracle VPD context is set via `pkg_session_mgr.set_user()`
- VPD policies automatically filter rows based on the user's permissions
- When `userId` is `undefined`, VPD context is NOT set, bypassing row-level security

### VPD Bypass Rules
1. **Admin/Superadmin Routes:**
   - Check user role first
   - Don't pass `userId` to `executeQuery()` OR pass `undefined`
   - Safe because role is verified before queries

2. **Standard User Routes:**
   - Always pass `session.user.id` to `executeQuery()`
   - VPD policies automatically enforce permissions
   - Users only see data they have access to

### VPD Security Functions (Database)
- `fn_is_superadmin()` - Returns 1 if user is superadmin (checks role or email)
- `fn_security_folders()` - Returns '1=1' for superadmin, filters by ownership/membership for others
- `fn_security_tasks()` - Filters tasks by creator, assignee, or branch (for secretary)
- `fn_security_lists()` - Filters lists by folder membership

## Code Examples

### Checking Permissions in Components
```typescript
// TaskDetail.tsx
const isAdmin = profile?.role === 'admin' || profile?.role === 'superadmin'
const isOwner = taskFolder?.user_id === user?.id
const currentMembership = folderMembers.find(m => m.folder_id === taskFolder.id && m.user_id === user?.id)

// Assignment permission
const canAssign = isAdmin || isOwner || currentMembership?.can_assign_task || isTaskCreator

// Delete permission  
const canDelete = isOwner || (currentMembership?.can_delete_task && isTaskCreator) || isAdmin

// Edit permission
const canEdit = isOwner || isAssignee || hasAnyPermission || isAdmin
```

### VPD Bypass in API Routes
```typescript
// Admin route - bypass VPD
const adminProfile = await executeQuery(
    `SELECT role FROM profiles WHERE email = :email`,
    { email: session.user.email }
)
if (adminProfile[0].role !== 'admin' && adminProfile[0].role !== 'superadmin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
// Don't pass userId - this bypasses VPD
const users = await executeQuery(`SELECT * FROM profiles`)

// Standard route - enforce VPD
const folders = await executeQuery(
    `SELECT * FROM folders WHERE id = :id`,
    { id: folderId },
    session.user.id  // VPD context is set, user only sees permitted folders
)
```

### Folder Deletion with VPD Bypass
```typescript
// DELETE /api/folders/[id]
const userProfile = await executeQuery<{ role: string }>(
    `SELECT role FROM profiles WHERE id = :id`,
    { id: session.user.id }
)
const isAdmin = userProfile[0].role === 'admin' || userProfile[0].role === 'superadmin'

// Admins bypass VPD, standard users don't
const vpdUserId = isAdmin ? undefined : session.user.id

await executeNonQuery(
    `DELETE FROM folders WHERE id = :id`,
    { id: folderId },
    vpdUserId  // undefined for admins = bypass VPD
)
```

## Security Best Practices

1. ✅ **Always verify role before bypassing VPD**
2. ✅ **Use VPD for standard user operations**
3. ✅ **Check permissions in both frontend and backend**
4. ✅ **Document VPD bypass with comments**
5. ✅ **Use consistent permission checking patterns**
6. ✅ **Test with different user roles**
7. ✅ **Audit admin operations**

## Common Permission Patterns

### Pattern 1: Admin or Owner
```typescript
const hasPermission = isAdmin || isOwner
```
Use for: Folder management, bulk operations

### Pattern 2: Admin or Specific Permission
```typescript
const canAssign = isAdmin || currentMembership?.can_assign_task
```
Use for: Folder member operations

### Pattern 3: Admin or Self
```typescript
const canEdit = isAdmin || userId === session.user.id
```
Use for: Profile editing, personal settings

### Pattern 4: Creator or Admin
```typescript
const canDelete = isTaskCreator || isAdmin
```
Use for: Task/resource deletion

## Notes

- Superadmin role has hardcoded email bypass in database (see `fn_is_superadmin()`)
- Secretary role can see all tasks in their branch regardless of folder membership
- Task privacy (`is_private` flag) further restricts visibility to assignees and creator only
- Folder hierarchy (parent_id) doesn't currently affect permissions - each folder is independent
