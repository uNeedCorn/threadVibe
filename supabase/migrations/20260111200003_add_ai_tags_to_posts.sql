-- ============================================================================
-- Migration: Add AI Tags Columns to Posts
-- Description: Add columns for AI-suggested and user-selected tags
-- ============================================================================

-- 1. 新增 AI 標籤欄位
ALTER TABLE workspace_threads_posts
  ADD COLUMN IF NOT EXISTS ai_suggested_tags JSONB,
  ADD COLUMN IF NOT EXISTS ai_selected_tags JSONB;

-- 2. 建立索引（用於查詢尚未分析的貼文）
CREATE INDEX IF NOT EXISTS idx_posts_ai_suggested_tags_null
  ON workspace_threads_posts(workspace_threads_account_id)
  WHERE ai_suggested_tags IS NULL;

-- 3. 註解
COMMENT ON COLUMN workspace_threads_posts.ai_suggested_tags IS 'AI 建議標籤（含信心度），5 維度各 3 個標籤';
COMMENT ON COLUMN workspace_threads_posts.ai_selected_tags IS '用戶選定的 AI 標籤，用於成效分析';
