-- =============================================================================
-- Migration: Add Soft Delete to Scheduled Posts
-- Description: 添加軟刪除支援到排程貼文表
-- =============================================================================

-- 添加 deleted_at 欄位用於軟刪除
ALTER TABLE workspace_threads_scheduled_posts
ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- 添加索引以加速查詢未刪除的貼文
CREATE INDEX IF NOT EXISTS idx_workspace_threads_scheduled_posts_deleted_at
ON workspace_threads_scheduled_posts (deleted_at)
WHERE deleted_at IS NULL;

-- 註解說明
COMMENT ON COLUMN workspace_threads_scheduled_posts.deleted_at IS
'軟刪除時間戳，NULL 表示未刪除';
