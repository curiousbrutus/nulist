-- Add parent_id to folders for hierarchy support
ALTER TABLE folders ADD (
    parent_id VARCHAR2(36)
);

-- Add completed_at to tasks for reporting accuracy
ALTER TABLE tasks ADD (
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Add foreign key for folder hierarchy
ALTER TABLE folders ADD CONSTRAINT fk_folders_parent 
    FOREIGN KEY (parent_id) REFERENCES folders(id) ON DELETE CASCADE;

-- Update existing tasks to have completed_at if is_completed is 1
UPDATE tasks SET completed_at = updated_at WHERE is_completed = 1 AND completed_at IS NULL;

COMMIT;
