-- =============================================================================
-- Migration: Refactor Outbound Posts Architecture
-- Description: 重構貼文發布架構，分離貼文內容與排程管理
--
-- 變更內容：
-- 1. 重命名 workspace_threads_scheduled_posts → workspace_threads_outbound_posts
-- 2. 添加 publish_type 欄位區分即時發布與排程發布
-- 3. 重命名 status → publish_status
-- 4. 建立獨立的 workspace_threads_publish_schedules 表管理排程
-- 5. 遷移現有排程資料
-- =============================================================================

-- Step 1: 建立 publish_type enum
CREATE TYPE publish_type AS ENUM ('immediate', 'scheduled');

-- Step 2: 重命名表
ALTER TABLE workspace_threads_scheduled_posts
RENAME TO workspace_threads_outbound_posts;

-- Step 3: 重命名 status 欄位為 publish_status
ALTER TABLE workspace_threads_outbound_posts
RENAME COLUMN status TO publish_status;

-- Step 4: 添加 publish_type 欄位
ALTER TABLE workspace_threads_outbound_posts
ADD COLUMN publish_type publish_type NOT NULL DEFAULT 'scheduled';

-- Step 5: 更新表註解
COMMENT ON TABLE workspace_threads_outbound_posts IS '平台發出的所有 Threads 貼文（即時發布 + 排程發布）';
COMMENT ON COLUMN workspace_threads_outbound_posts.publish_type IS '發布類型：immediate（即時發布）、scheduled（排程發布）';
COMMENT ON COLUMN workspace_threads_outbound_posts.publish_status IS '發布狀態：draft, scheduled, publishing, published, failed';

-- Step 6: 建立排程管理表
CREATE TABLE workspace_threads_publish_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outbound_post_id UUID NOT NULL REFERENCES workspace_threads_outbound_posts(id) ON DELETE CASCADE,

  -- 排程資訊
  scheduled_at TIMESTAMPTZ NOT NULL,

  -- 執行狀態
  executed_at TIMESTAMPTZ,
  is_cancelled BOOLEAN DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES auth.users(id),

  -- 審計
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 表註解
COMMENT ON TABLE workspace_threads_publish_schedules IS '貼文排程管理表，管理排程發布的時間與執行狀態';
COMMENT ON COLUMN workspace_threads_publish_schedules.outbound_post_id IS '關聯的外發貼文 ID';
COMMENT ON COLUMN workspace_threads_publish_schedules.scheduled_at IS '排程發布時間';
COMMENT ON COLUMN workspace_threads_publish_schedules.executed_at IS '實際執行時間';
COMMENT ON COLUMN workspace_threads_publish_schedules.is_cancelled IS '是否已取消';

-- Step 7: 啟用 RLS
ALTER TABLE workspace_threads_publish_schedules ENABLE ROW LEVEL SECURITY;

-- Step 8: 建立 RLS policies（透過 outbound_posts 關聯驗證權限）
CREATE POLICY "Users can view schedules for their workspaces"
ON workspace_threads_publish_schedules
FOR SELECT
USING (
  outbound_post_id IN (
    SELECT op.id FROM workspace_threads_outbound_posts op
    WHERE op.workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  )
);

CREATE POLICY "Users can insert schedules for their workspaces"
ON workspace_threads_publish_schedules
FOR INSERT
WITH CHECK (
  outbound_post_id IN (
    SELECT op.id FROM workspace_threads_outbound_posts op
    WHERE op.workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'editor')
    )
  )
);

CREATE POLICY "Users can update schedules for their workspaces"
ON workspace_threads_publish_schedules
FOR UPDATE
USING (
  outbound_post_id IN (
    SELECT op.id FROM workspace_threads_outbound_posts op
    WHERE op.workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'editor')
    )
  )
);

CREATE POLICY "Users can delete schedules for their workspaces"
ON workspace_threads_publish_schedules
FOR DELETE
USING (
  outbound_post_id IN (
    SELECT op.id FROM workspace_threads_outbound_posts op
    WHERE op.workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'editor')
    )
  )
);

-- Step 9: 建立索引
CREATE INDEX idx_publish_schedules_post ON workspace_threads_publish_schedules(outbound_post_id);
CREATE INDEX idx_publish_schedules_scheduled_at ON workspace_threads_publish_schedules(scheduled_at)
  WHERE is_cancelled = FALSE AND executed_at IS NULL;
CREATE INDEX idx_outbound_posts_publish_type ON workspace_threads_outbound_posts(publish_type);

-- Step 10: 遷移現有排程資料到新表
-- 將 scheduled_at 有值的記錄，建立對應的 schedule 記錄
INSERT INTO workspace_threads_publish_schedules (
  outbound_post_id,
  scheduled_at,
  executed_at,
  created_by,
  created_at
)
SELECT
  id AS outbound_post_id,
  scheduled_at,
  CASE
    WHEN publish_status = 'published' THEN published_at
    ELSE NULL
  END AS executed_at,
  created_by,
  created_at
FROM workspace_threads_outbound_posts
WHERE scheduled_at IS NOT NULL;

-- Step 11: 更新觸發器名稱以匹配新表名
DROP TRIGGER IF EXISTS update_scheduled_posts_updated_at ON workspace_threads_outbound_posts;

CREATE TRIGGER update_outbound_posts_updated_at
  BEFORE UPDATE ON workspace_threads_outbound_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_publish_schedules_updated_at
  BEFORE UPDATE ON workspace_threads_publish_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Step 12: 重命名舊有索引（可選，保持向後相容）
-- PostgreSQL 不支援直接重命名索引，保留原有索引名稱

-- Step 13: 更新 RLS policy 名稱（刪除舊 policy 並建立新的）
-- 注意：PostgreSQL 不支援重命名 policy，需要重新建立
DROP POLICY IF EXISTS "Users can view scheduled posts in their workspaces" ON workspace_threads_outbound_posts;
DROP POLICY IF EXISTS "Users can insert scheduled posts in their workspaces" ON workspace_threads_outbound_posts;
DROP POLICY IF EXISTS "Users can update scheduled posts in their workspaces" ON workspace_threads_outbound_posts;
DROP POLICY IF EXISTS "Users can delete scheduled posts in their workspaces" ON workspace_threads_outbound_posts;

CREATE POLICY "Users can view outbound posts in their workspaces"
ON workspace_threads_outbound_posts
FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert outbound posts in their workspaces"
ON workspace_threads_outbound_posts
FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'editor')
  )
);

CREATE POLICY "Users can update outbound posts in their workspaces"
ON workspace_threads_outbound_posts
FOR UPDATE
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'editor')
  )
);

CREATE POLICY "Users can delete outbound posts in their workspaces"
ON workspace_threads_outbound_posts
FOR DELETE
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'editor')
  )
);

-- =============================================================================
-- 遷移完成後的資料結構：
--
-- workspace_threads_outbound_posts（貼文內容表）
--   - id, workspace_id, workspace_threads_account_id
--   - text, media_type, media_urls, topic_tag, link_attachment
--   - publish_type (NEW): immediate / scheduled
--   - publish_status (RENAMED from status): draft / scheduled / publishing / published / failed
--   - scheduled_at (保留，未來可移除)
--   - threads_post_id, published_at, error_message
--   - deleted_at, deletion_source
--   - created_by, created_at, updated_at
--
-- workspace_threads_publish_schedules（排程管理表）
--   - id, outbound_post_id
--   - scheduled_at, executed_at
--   - is_cancelled, cancelled_at, cancelled_by
--   - created_by, created_at, updated_at
-- =============================================================================
