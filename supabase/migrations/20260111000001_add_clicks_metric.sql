-- ============================================
-- 新增 clicks 指標欄位
-- ============================================

-- Layer 3: workspace_threads_posts (Current)
ALTER TABLE workspace_threads_posts
ADD COLUMN IF NOT EXISTS current_clicks INTEGER NOT NULL DEFAULT 0;

-- Layer 1: workspace_threads_post_metrics (Snapshot)
ALTER TABLE workspace_threads_post_metrics
ADD COLUMN IF NOT EXISTS clicks INTEGER NOT NULL DEFAULT 0;

-- Layer 2: workspace_threads_post_metrics_deltas (Delta)
ALTER TABLE workspace_threads_post_metrics_deltas
ADD COLUMN IF NOT EXISTS clicks_delta INTEGER NOT NULL DEFAULT 0;

-- 加入註解
COMMENT ON COLUMN workspace_threads_posts.current_clicks IS '目前連結點擊數';
COMMENT ON COLUMN workspace_threads_post_metrics.clicks IS '連結點擊數快照';
COMMENT ON COLUMN workspace_threads_post_metrics_deltas.clicks_delta IS '連結點擊數增量';
