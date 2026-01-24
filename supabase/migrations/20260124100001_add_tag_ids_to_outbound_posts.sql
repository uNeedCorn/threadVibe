-- =============================================================================
-- Migration: 新增 tag_ids 欄位到 outbound_posts
-- Description: 發文時儲存標籤 ID，同步時複製到 post_tags
-- =============================================================================

-- Step 1: 新增 tag_ids 欄位
ALTER TABLE workspace_threads_outbound_posts
ADD COLUMN tag_ids UUID[] DEFAULT '{}';

COMMENT ON COLUMN workspace_threads_outbound_posts.tag_ids IS '發文時選擇的標籤 ID 陣列';

-- Step 2: 新增 threads_post_id 索引（用於 sync-posts 比對）
CREATE INDEX idx_outbound_posts_threads_post_id
ON workspace_threads_outbound_posts(threads_post_id)
WHERE threads_post_id IS NOT NULL;
