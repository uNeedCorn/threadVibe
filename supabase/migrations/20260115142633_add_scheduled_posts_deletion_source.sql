-- =============================================================================
-- Migration: Add Deletion Source to Scheduled Posts
-- Description: 添加刪除來源欄位，記錄貼文是如何被標記為刪除的
-- =============================================================================

-- 建立刪除來源的 enum 類型
CREATE TYPE deletion_source_type AS ENUM (
  'sync_detected',    -- 同步偵測：同步時發現貼文已不存在
  'platform_deleted'  -- 平台刪除：用戶從平台主動刪除
);

-- 添加 deletion_source 欄位
ALTER TABLE workspace_threads_scheduled_posts
ADD COLUMN IF NOT EXISTS deletion_source deletion_source_type;

-- 註解說明
COMMENT ON COLUMN workspace_threads_scheduled_posts.deletion_source IS
'刪除來源：sync_detected（同步偵測）、platform_deleted（平台刪除）';
