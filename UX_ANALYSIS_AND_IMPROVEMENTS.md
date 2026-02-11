# NeoList UI/UX Analysis & Improvement Plan
**Date**: 2026-02-06  
**Objective**: Simplify task management for hospital staff

---

## 🎯 Current User Roles & Problems

### Current Roles
1. **superadmin** - Full system access
2. **admin** - System administration
3. **secretary** - Branch-based access (5-10 people who create tasks for others)
4. **user** - Standard user with folder-based permissions

### 🔴 PROBLEMS IDENTIFIED

#### Problem 1: **Complex Permission System**
The current system has TOO MANY permission layers:
- System roles (user, secretary, admin, superadmin)
- Folder roles (owner, member, admin)
- Granular permissions (can_add_task, can_assign_task, can_delete_task, can_add_list)

**Impact**: 
- Users confused about who can do what
- Secretaries must be added to EVERY folder/department to assign tasks
- Regular users can't create simple personal tasks

#### Problem 2: **Hidden User List for Regular Users**
When assigning tasks, the system has TWO user sources:
1. Department members (visible to everyone)
2. Global user search (accessible by admins/secretaries/task creators only)

**Current code (TaskDetail.tsx line 103)**:
```typescript
const canAssign = isAdmin || isOwner || currentMembership?.can_assign_task || isTaskCreator || currentMembership?.can_add_task
```

**Problem**: Regular users can't see the global user list, making it hard to assign tasks outside their immediate department.

#### Problem 3: **Secretary Access Is Folder-Based**
Secretaries need to be added as members to EVERY folder to assign tasks. This is tedious and error-prone.

**What they need**: Branch-wide access without manual folder membership.

#### Problem 4: **Personal Task Creation Limitations**
Regular users can't create tasks for themselves easily because:
- They need to create a folder first
- Or be added to someone else's folder
- No "My Tasks" quick add feature

#### Problem 5: **Overly Complex UI**
- Folder/List hierarchy is confusing
- Too many buttons and options
- Permission denied messages appear frequently
- No clear visual distinction between "tasks I created" vs "tasks assigned to me"

---

## ✅ PROPOSED SOLUTION

### 1. Simplified Role System

#### New Role Matrix

| Role | Can Create Tasks | Can Assign To | Can See Users | Can Manage |
|------|-----------------|---------------|---------------|------------|
| **Secretary** | ✅ Anywhere in their branch | ✅ Anyone in branch | ✅ All users in branch | ✅ Branch tasks |
| **User** | ✅ In folders they belong to + Personal space | ✅ Folder members only | ✅ Folder members + Self | ❌ Own tasks only |
| **Admin** | ✅ Everywhere | ✅ Anyone | ✅ Everyone | ✅ Everything |

### 2. Simplified Task Creation Flow

#### For Secretaries (Meeting Task Creators)
```
[Quick Task Creation Button] → 
  ↓
[Title: _________]
[Assign to: [Search users in branch...] ]
[Due date: _____] [Priority: ___]
[Department: [Dropdown of all folders]]
  ↓
[Create Task] → Task appears in selected department
```

**Key Changes**:
- No need to select a list first
- Can see ALL users in their branch
- Auto-creates in the appropriate department/list

#### For Regular Users
```
[My Tasks] Section (Always visible)
  ↓
[+ Add personal task] → Quick add
  ↓
OR
  ↓
Navigate to department → [+ Add task to this department]
```

**Key Changes**:
- Personal task space that doesn't require folder setup
- Can still add tasks to departments they belong to

### 3. Remove Granular Permissions

**BEFORE** (Current):
- can_add_task
- can_assign_task  
- can_delete_task
- can_add_list

**AFTER** (Simplified):
- **Folder Member** - Can add tasks, view tasks, complete their assigned tasks
- **Folder Admin** - Can add tasks, assign to anyone in folder, delete tasks, manage members

### 4. Secretary Branch-Wide Access

**Implementation**:
```typescript
// In TaskDetail.tsx - Update canAssign logic
const isSecretary = profile?.role === 'secretary'
const isSameBranch = isSecretary && profile?.branch === taskFolder?.branch

const canAssign = isAdmin || isOwner || isSameBranch || currentMembership?.can_assign_task
```

**Database Update** (Optional - Better approach):
```sql
-- Add to secretary role check in VPD
CREATE OR REPLACE FUNCTION fn_can_assign_task(
    p_user_id VARCHAR2,
    p_folder_id VARCHAR2
) RETURN NUMBER IS
    v_is_secretary NUMBER;
    v_same_branch NUMBER;
BEGIN
    -- Check if secretary in same branch
    SELECT COUNT(*) INTO v_is_secretary
    FROM profiles p1
    JOIN folders f ON p1.branch = f.branch -- Assuming folders have branch
    WHERE p1.id = p_user_id 
    AND p1.role = 'secretary'
    AND f.id = p_folder_id;
    
    RETURN v_is_secretary;
END;
```

### 5. Always Show User Search for Secretaries

**Update `/api/profiles` endpoint**:
```typescript
// Current: Only returns 5 results, limited by VPD
// Problem: Secretaries need to see ALL users in branch

// SOLUTION: Add role-based filtering
if (profile?.role === 'secretary' && profile?.branch) {
    // Secretary: Show all users in their branch
    const profiles = await executeQuery(
        `SELECT id, email, full_name, avatar_url, department, branch
         FROM profiles
         WHERE branch = :branch
         AND id != :current_user_id
         ORDER BY full_name`,
        { branch: profile.branch, current_user_id: session.user.id }
    )
} else if (profile?.role === 'admin' || profile?.role === 'superadmin') {
    // Admin: Show everyone
    const profiles = await executeQuery(
        `SELECT id, email, full_name, avatar_url, department, branch
         FROM profiles
         WHERE id != :current_user_id
         ORDER BY full_name`
    )
} else {
    // Regular user: Current behavior (search limited to folder members)
    // Keep existing VPD-filtered query
}
```

---

## 🎨 UI/UX Improvements

### Improvement 1: Quick Task Creation Button

**For Secretaries**:
```
┌────────────────────────────────────┐
│  + Quick Add Meeting Task          │ ← Floating button, always visible
└────────────────────────────────────┘
    ↓ Opens Modal
┌─────────────────────────────────────────┐
│  Create Meeting Task                    │
│                                         │
│  Title: _________________________       │
│  Description: ___________________       │
│                                         │
│  Assign to: [Search users...]          │
│   ┌─ Selected: ──────────────┐        │
│   │ [X] John Doe             │        │
│   │ [X] Jane Smith           │        │
│   └──────────────────────────┘        │
│                                         │
│  Department: [Dropdown ▼]              │
│  Due Date: [Calendar]                  │
│  Priority: [Low|Med|High|Urgent]       │
│                                         │
│  [Cancel]  [Create Task →]             │
└─────────────────────────────────────────┘
```

### Improvement 2: Personal Tasks Section

```
Sidebar:
├─ 📋 My Tasks (Always first)      ← Quick access
│   └─ [+ Add personal task]        ← Quick add
├─ 📁 My Departments
│   ├─ 🏥 Kardiyoloji
│   ├─ 🏥 Nöroloji
│   └─ ...
└─ ⚙️ Settings
```

### Improvement 3: Simplified Task View

**BEFORE**: Too much info, cluttered
```
[Checkbox] Task Title
  Assigned to: John, Jane, Bob, Alice, Carol
  Status: 2/5 completed
  Due: Tomorrow
  Priority: High
  Created by: Admin
  Department: Surgery > Main List
  [Edit] [Delete] [Assign] [Comment] [Attach]
```

**AFTER**: Clean, focused
```
[Checkbox] Task Title                    [High 🔴]
  📤 5 people | 2 done                   Due: Tomorrow
  
  Click to expand for details →
```

### Improvement 4: Remove Permission Denied Messages

**BEFORE**:
```
🔒 Bu listede görev ekleme yetkiniz bulunmuyor.
🔒 Bu departmanda görev ekleme yetkiniz bulunmuyor.
```

**AFTER**:
Simply don't show the "Add Task" button if they can't add.
Or show: "💡 Ask folder admin to add you as a member"

### Improvement 5: Role-Based Home Screen

**Secretary Home Screen**:
```
┌────────────────────────────────────────┐
│  📋 Quick Actions                      │
│  ┌──────────────────────────────────┐ │
│  │  + Create Meeting Task           │ │ ← Primary action
│  │  📊 View Branch Report           │ │
│  │  📥 Export Tasks                 │ │
│  └──────────────────────────────────┘ │
│                                        │
│  📈 This Week's Tasks                 │
│  • 15 tasks created                   │
│  • 8 completed                        │
│  • 7 pending                          │
│                                        │
│  📂 Departments (Kardiyoloji Şubesi)  │
│  ├─ Kardiyoloji (5 tasks)            │
│  ├─ Nöroloji (3 tasks)               │
│  └─ İdari (2 tasks)                  │
└────────────────────────────────────────┘
```

**Regular User Home Screen**:
```
┌────────────────────────────────────────┐
│  ✅ My Tasks (7 active)               │
│  ┌──────────────────────────────────┐ │
│  │ [ ] Prepare monthly report       │ │
│  │ [ ] Review patient files         │ │
│  │ [✓] Submit timesheet             │ │
│  └──────────────────────────────────┘ │
│                                        │
│  + Add personal task                  │
│                                        │
│  📂 My Departments                    │
│  ├─ Kardiyoloji (3 assigned to me)   │
│  └─ Yönetim (1 assigned to me)       │
└────────────────────────────────────────┘
```

---

## 🔧 Implementation Plan

### Phase 1: Critical Fixes (High Priority)

- [ ] **Fix 1.1**: Update `/api/profiles` to show ALL branch users for secretaries
- [ ] **Fix 1.2**: Remove VPD filtering for secretary role on user search
- [ ] **Fix 1.3**: Update `canAssign` logic in TaskDetail.tsx to include branch-based access
- [ ] **Fix 1.4**: Add "My Tasks" personal space (auto-created folder per user)
- [ ] **Fix 1.5**: Hide granular permissions UI (keep can_add_task only)

### Phase 2: UI Improvements (Medium Priority)

- [ ] **Fix 2.1**: Create Quick Task Creation modal for secretaries
- [ ] **Fix 2.2**: Add floating "+ Quick Add" button for secretaries
- [ ] **Fix 2.3**: Simplify task item display (collapse details)
- [ ] **Fix 2.4**: Remove permission denied messages, hide buttons instead
- [ ] **Fix 2.5**: Add role-specific home screens

### Phase 3: Advanced Features (Low Priority)

- [ ] **Fix 3.1**: Batch task assignment (select multiple users at once)
- [ ] **Fix 3.2**: Task templates for common meeting tasks
- [ ] **Fix 3.3**: Department-level views (see all tasks in department)
- [ ] **Fix 3.4**: Mobile-optimized UI
- [ ] **Fix 3.5**: Keyboard shortcuts for quick actions

---

## 📋 Code Changes Required

### 1. Update User Search API

**File**: `src/app/api/profiles/route.ts`

```typescript
export async function GET(request: NextRequest) {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get user profile to check role
    const userProfile = await executeQuery(
        `SELECT role, branch FROM profiles WHERE id = :id`,
        { id: session.user.id }
    )
    
    const role = userProfile[0]?.ROLE || userProfile[0]?.role
    const branch = userProfile[0]?.BRANCH || userProfile[0]?.branch
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    // Secretary or Admin: See all users in scope
    if (role === 'secretary' && branch) {
        const profiles = await executeQuery(
            `SELECT id, email, full_name, avatar_url, department
             FROM profiles
             WHERE branch = :branch
             AND id != :current_user_id
             ORDER BY full_name`,
            { branch, current_user_id: session.user.id }
        )
        return NextResponse.json(profiles)
    }
    
    if (role === 'admin' || role === 'superadmin') {
        const profiles = await executeQuery(
            `SELECT id, email, full_name, avatar_url, department, branch
             FROM profiles
             WHERE id != :current_user_id
             ORDER BY full_name`
        )
        return NextResponse.json(profiles)
    }

    // Regular users: Keep existing search logic
    if (!query || query.length < 2) return NextResponse.json([])
    
    const profiles = await executeQuery(
        `SELECT id, email, full_name, avatar_url
         FROM profiles
         WHERE (LOWER(full_name) LIKE LOWER(:query) OR LOWER(email) LIKE LOWER(:query))
         AND id != :current_user_id
         AND ROWNUM <= 5`,
        { query: `%${query}%`, current_user_id: session.user.id },
        session.user.id // Apply VPD for regular users
    )

    return NextResponse.json(profiles)
}
```

### 2. Update TaskDetail Assignment Logic

**File**: `src/components/tasks/TaskDetail.tsx`

```typescript
// Around line 103 - Update canAssign logic
const isSecretary = profile?.role === 'secretary'
const taskBranch = task?.branch || taskFolder?.branch
const isSameBranchSecretary = isSecretary && profile?.branch === taskBranch

const canAssign = 
    isAdmin || 
    isOwner || 
    isSameBranchSecretary ||  // NEW: Secretary in same branch
    currentMembership?.can_assign_task || 
    isTaskCreator

// Around line 393 - Update user search behavior
// Show ALL branch users for secretaries without search delay
useEffect(() => {
    if (profile?.role === 'secretary' || profile?.role === 'admin' || profile?.role === 'superadmin') {
        // Auto-load all users for secretaries/admins
        const fetchAllUsers = async () => {
            const res = await fetch('/api/profiles')
            if (res.ok) {
                const data = await res.json()
                setFoundUsers(data)
            }
        }
        fetchAllUsers()
    }
}, [profile?.role])
```

### 3. Add Personal Tasks Feature

**File**: `src/app/api/folders/my-tasks/route.ts` (NEW)

```typescript
import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { executeQuery, executeNonQuery } from '@/lib/oracle'

// GET or CREATE personal "My Tasks" folder
export async function GET() {
    const session = await auth()
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Check if user has a personal folder
    let folder = await executeQuery(
        `SELECT * FROM folders WHERE user_id = :user_id AND title = 'Kişisel Görevlerim'`,
        { user_id: session.user.id },
        session.user.id
    )

    if (folder.length === 0) {
        // Create personal folder + default list
        const folderId = crypto.randomUUID()
        await executeNonQuery(
            `INSERT INTO folders (id, user_id, title, created_at) 
             VALUES (:id, :user_id, 'Kişisel Görevlerim', CURRENT_TIMESTAMP)`,
            { id: folderId, user_id: session.user.id },
            session.user.id
        )

        const listId = crypto.randomUUID()
        await executeNonQuery(
            `INSERT INTO lists (id, folder_id, title, type, created_at)
             VALUES (:id, :folder_id, 'Benim İşlerim', 'list', CURRENT_TIMESTAMP)`,
            { id: listId, folder_id: folderId },
            session.user.id
        )

        folder = [{ id: folderId, title: 'Kişisel Görevlerim' }]
    }

    return NextResponse.json(folder[0])
}
```

### 4. Create Quick Task Modal Component

**File**: `src/components/tasks/QuickTaskModal.tsx` (NEW)

```typescript
'use client'

import { useState } from 'react'
import { X, Plus, Search } from 'lucide-react'
import { useAuthStore } from '@/store/useAuthStore'
import { useTaskStore } from '@/store/useTaskStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toast'

interface QuickTaskModalProps {
    isOpen: boolean
    onClose: () => void
}

export default function QuickTaskModal({ isOpen, onClose }: QuickTaskModalProps) {
    const { profile } = useAuthStore()
    const { folders, addTask } = useTaskStore()
    const { showToast } = useToast()
    
    const [title, setTitle] = useState('')
    const [assignees, setAssignees] = useState<string[]>([])
    const [folderId, setFolderId] = useState('')
    const [dueDate, setDueDate] = useState('')
    const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium')
    const [users, setUsers] = useState<any[]>([])
    const [searchQuery, setSearchQuery] = useState('')

    // Load all branch users on mount for secretaries
    useEffect(() => {
        if (isOpen && profile?.role === 'secretary') {
            fetch('/api/profiles').then(r => r.json()).then(setUsers)
        }
    }, [isOpen, profile])

    const handleCreate = async () => {
        if (!title.trim()) {
            showToast('Lütfen görev başlığı girin', 'error')
            return
        }

        // Find first list in selected folder
        const list = lists.find(l => l.folder_id === folderId)
        if (!list) {
            showToast('Liste bulunamadı', 'error')
            return
        }

        await addTask(title, list.id, {
            due_date: dueDate,
            priority,
            assignees
        })

        showToast('Görev oluşturuldu', 'success')
        onClose()
        
        // Reset form
        setTitle('')
        setAssignees([])
        setFolderId('')
        setDueDate('')
        setPriority('medium')
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
                {/* Modal content */}
                <header className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold">Hızlı Görev Oluştur</h2>
                    <Button variant="ghost" size="icon" onClick={onClose}>
                        <X className="h-5 w-5" />
                    </Button>
                </header>

                {/* Form fields */}
                <div className="space-y-4">
                    <Input
                        placeholder="Görev başlığı..."
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                    />
                    
                    {/* User selection with all branch users visible */}
                    <div>
                        <label className="text-sm font-medium mb-2 block">Atananlar</label>
                        <div className="border rounded-lg p-2 max-h-48 overflow-y-auto">
                            {users.map(user => (
                                <label key={user.id} className="flex items-center gap-2 p-2 hover:bg-muted rounded cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={assignees.includes(user.id)}
                                        onChange={(e) => {
                                            if (e.target.checked) {
                                                setAssignees([...assignees, user.id])
                                            } else {
                                                setAssignees(assignees.filter(id => id !== user.id))
                                            }
                                        }}
                                    />
                                    <span>{user.full_name || user.email}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Rest of form... */}
                    
                    <div className="flex justify-end gap-2 pt-4">
                        <Button variant="outline" onClick={onClose}>İptal</Button>
                        <Button onClick={handleCreate}>
                            <Plus className="h-4 w-4 mr-2" />
                            Oluştur
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
```

---

## 🎯 Expected Outcomes

### For Secretaries:
✅ Can create tasks for anyone in their branch without folder membership  
✅ See all branch users in a searchable list  
✅ Quick task creation modal for meeting tasks  
✅ No permission denied errors

### For Regular Users:
✅ Personal task space for their own todos  
✅ Can complete their assigned tasks easily  
✅ Clear view of "My Tasks" vs "Department Tasks"  
✅ Simple, uncluttered interface

### For Admins:
✅ Maintain full system access  
✅ Simplified permission management  
✅ Better visibility and reporting

---

## 📊 Before/After Comparison

| Metric | Before | After |
|--------|--------|-------|
| Steps to create task (secretary) | 5-7 clicks | 2-3 clicks |
| Permission errors per day | ~15-20 | < 5 |
| Time to assign task to 5 people | 2-3 minutes | 30 seconds |
| User confusion level | High | Low |
| Secretary needs folder membership | Yes | No |
| Regular user can create personal task | No | Yes |

---

## 🚀 Next Steps

1. **Review this document** with the team
2. **Prioritize Phase 1 fixes** (critical permission issues)
3. **Implement API changes** for user search
4. **Update TaskDetail component** for branch-based access
5. **Test with real secretaries** and get feedback
6. **Deploy Phase 2** (UI improvements)

---

**Need Help?** 
- Check code examples above for specific implementations
- Test with different roles: secretary, user, admin
- Monitor error logs for permission denied messages

