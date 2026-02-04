-- Migration: Add ordering and pinning support to folders
-- This allows dynamic folder ordering in the sidebar instead of hardcoded logic

-- Add display_order column (lower number = higher priority)
ALTER TABLE folders ADD display_order NUMBER(10) DEFAULT 999;

-- Add is_pinned column (pinned folders appear at the top)
ALTER TABLE folders ADD is_pinned NUMBER(1) DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN folders.display_order IS 'Display order in sidebar (lower = higher priority, default 999)';
COMMENT ON COLUMN folders.is_pinned IS 'Whether folder is pinned to top of sidebar (1=yes, 0=no)';

-- Set default ordering based on creation date for existing folders
UPDATE folders SET display_order = ROWNUM WHERE display_order = 999;

COMMIT;
