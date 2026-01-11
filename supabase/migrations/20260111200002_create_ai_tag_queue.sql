-- ============================================================================
-- Migration: AI Tag Queue
-- Description: Job queue for AI tagging tasks
-- ============================================================================

-- 1. 建立 ai_tag_queue 表
CREATE TABLE ai_tag_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_account_id UUID NOT NULL
    REFERENCES workspace_threads_accounts(id) ON DELETE CASCADE,
  post_id UUID NOT NULL
    REFERENCES workspace_threads_posts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- 同一貼文只能有一個 job
  UNIQUE (post_id)
);

-- 2. 建立索引
CREATE INDEX idx_ai_tag_queue_status
  ON ai_tag_queue(status, created_at);

CREATE INDEX idx_ai_tag_queue_account
  ON ai_tag_queue(workspace_threads_account_id);

-- 3. 狀態檢查約束
ALTER TABLE ai_tag_queue
  ADD CONSTRAINT chk_ai_tag_queue_status
  CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

-- 4. RLS 政策
ALTER TABLE ai_tag_queue ENABLE ROW LEVEL SECURITY;

-- SELECT：工作區成員可查詢
CREATE POLICY "Members can view ai_tag_queue"
  ON ai_tag_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_threads_accounts a
      WHERE a.id = ai_tag_queue.workspace_threads_account_id
        AND is_workspace_member(a.workspace_id)
    )
  );

-- INSERT/UPDATE/DELETE 由 service_role 操作，不設定 RLS

-- 5. 註解
COMMENT ON TABLE ai_tag_queue IS 'AI Tagging Job Queue - 管理待處理的 AI 標籤分析任務';
COMMENT ON COLUMN ai_tag_queue.status IS 'pending: 等待處理, processing: 處理中, completed: 完成, failed: 失敗';
COMMENT ON COLUMN ai_tag_queue.attempts IS '已嘗試次數';
COMMENT ON COLUMN ai_tag_queue.max_attempts IS '最大重試次數，預設 3';
