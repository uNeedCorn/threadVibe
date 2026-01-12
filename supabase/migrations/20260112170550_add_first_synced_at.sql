-- ============================================================================
-- Migration: Add first_synced_at to workspace_threads_posts
-- Description: 記錄貼文首次被同步的時間，用於判斷是否有早期追蹤資料
-- ============================================================================

-- 1. 新增 first_synced_at 欄位
-- 使用 DEFAULT now() 讓新插入的資料自動記錄時間
-- 現有資料會是 NULL，表示無法追溯首次同步時間
ALTER TABLE workspace_threads_posts
ADD COLUMN IF NOT EXISTS first_synced_at TIMESTAMPTZ DEFAULT now();

-- 2. 為現有資料設定 first_synced_at（使用 created_at 作為估計值）
-- 這些是舊資料，假設 created_at 約等於首次同步時間
UPDATE workspace_threads_posts
SET first_synced_at = created_at
WHERE first_synced_at IS NULL;

-- 3. 新增註解
COMMENT ON COLUMN workspace_threads_posts.first_synced_at IS '貼文首次被同步的時間（用於判斷是否有早期追蹤資料）';
