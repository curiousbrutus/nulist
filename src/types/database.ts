export interface Profile {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
    department?: string;
    role?: 'user' | 'admin' | 'secretary' | 'superadmin';
    branch?: string;
    meeting_type?: string;
    telegram_user_id?: string;
    job_title?: string;
    phone?: string;
    manager_id?: string;
    is_profile_complete?: number;
    zimbra_sync_enabled?: number;
    zimbra_last_sync?: string;
    created_at?: string;
    updated_at?: string;
}

export interface Folder {
    id: string;
    title: string;
    user_id: string;
    parent_id?: string; // Parent folder ID for hierarchy
    display_order?: number; // Display order in sidebar (lower = higher priority)
    is_pinned?: boolean; // Whether folder is pinned to top of sidebar
    branch?: string; // Hospital branch for secretary filtering
    created_at?: string;
}

export interface FolderMember {
    id: string;
    folder_id: string;
    user_id: string;
    role: 'admin' | 'member';
    can_add_task: boolean;
    can_assign_task: boolean;
    can_delete_task: boolean;
    can_add_list: boolean;
    created_at?: string;
    profile?: Profile; // Join'ler için opsiyonel
}

export interface List {
    id: string;
    folder_id: string;
    title: string;
    type: 'list' | 'kanban';
    created_at?: string;
}

export interface TaskAssignee {
    task_id: string;
    user_id: string;
    is_completed: boolean;
    assigned_at?: string;
    profile?: Profile; // Join'ler için opsiyonel
    full_name?: string; // Admin view shortcut
    zimbra_task_id?: string;
}

export interface TaskAttachment {
    id: string;
    task_id: string;
    user_id: string;
    file_name: string;
    file_size: number;
    file_type: string;
    storage_path: string;
    storage_type: 'local' | 'supabase';
    created_at: string;
    profile?: Profile; // Join'ler için opsiyonel
}

export interface Task {
    id: string;
    list_id: string;
    title: string;
    notes?: string;
    is_completed: boolean;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    due_date?: string;
    created_at?: string;
    created_by?: string; // Görevi oluşturan kullanıcı ID'si
    is_private?: boolean; // Privacy flag - only assignees/creator see task
    branch?: string; // Hospital branch for filtering
    meeting_type?: string; // Meeting type for secretary exports
    task_assignees?: TaskAssignee[]; // Çoklu atama desteği
    comments?: Comment[];
    attachments?: TaskAttachment[]; // Dosya ekleri
}

export interface Subtask {
    id: string;
    task_id: string;
    title: string;
    is_completed: boolean;
    created_at?: string;
}

export interface Comment {
    id: string;
    task_id: string;
    user_id: string;
    content: string;
    created_at: string;
    profile?: Profile;
}

export interface Database {
    public: {
        Tables: {
            profiles: Profile;
            folders: Folder;
            folder_members: FolderMember;
            lists: List;
            tasks: Task;
            task_assignees: TaskAssignee;
            task_attachments: TaskAttachment;
            subtasks: Subtask;
            comments: Comment;
        };
    };
}

