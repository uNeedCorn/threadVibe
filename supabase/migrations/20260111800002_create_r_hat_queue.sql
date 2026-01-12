-- ============================================================================
-- Migration: R̂_t Calculation Queue
-- Description: Job queue for R̂_t (reproduction number) calculation tasks
-- ADR: diffusion-model-recommendations.md
-- ============================================================================

-- 1. 建立 r_hat_queue 表
CREATE TABLE r_hat_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_post_id UUID NOT NULL
    REFERENCES workspace_threads_posts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- 計算結果快取（避免重複寫入）
  calculated_r_hat NUMERIC,
  calculated_r_hat_status TEXT
);

-- 同一貼文同時只能有一個 pending/processing job（使用 partial unique index）
CREATE UNIQUE INDEX idx_r_hat_queue_unique_pending
  ON r_hat_queue(workspace_threads_post_id)
  WHERE status IN ('pending', 'processing');

-- 2. 建立索引
-- 主要查詢：找 pending 任務，按優先級和建立時間排序
CREATE INDEX idx_r_hat_queue_pending
  ON r_hat_queue(status, priority DESC, created_at)
  WHERE status = 'pending';

-- 按貼文查詢歷史
CREATE INDEX idx_r_hat_queue_post
  ON r_hat_queue(workspace_threads_post_id, created_at DESC);

-- 3. 狀態檢查約束
ALTER TABLE r_hat_queue
  ADD CONSTRAINT chk_r_hat_queue_status
  CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'skipped'));

-- 4. 優先級說明（較高數字 = 較高優先）
-- 0: 正常同步後入隊
-- 10: 新貼文（發布後 48 小時內）
-- 20: 熱門貼文（engagement 高）

-- 5. RLS 政策
ALTER TABLE r_hat_queue ENABLE ROW LEVEL SECURITY;

-- SELECT：工作區成員可查詢
CREATE POLICY "Members can view r_hat_queue"
  ON r_hat_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_threads_posts p
      JOIN workspace_threads_accounts a ON a.id = p.workspace_threads_account_id
      WHERE p.id = r_hat_queue.workspace_threads_post_id
        AND is_workspace_member(a.workspace_id)
    )
  );

-- INSERT/UPDATE/DELETE 由 service_role 操作，不設定 RLS

-- 6. 註解
COMMENT ON TABLE r_hat_queue IS 'R̂_t 計算 Job Queue - 管理待處理的再生數計算任務';
COMMENT ON COLUMN r_hat_queue.status IS 'pending: 等待處理, processing: 處理中, completed: 完成, failed: 失敗, skipped: 資料不足跳過';
COMMENT ON COLUMN r_hat_queue.priority IS '優先級：0=正常, 10=新貼文, 20=熱門貼文';
COMMENT ON COLUMN r_hat_queue.calculated_r_hat IS '計算結果：R̂_t 值';
COMMENT ON COLUMN r_hat_queue.calculated_r_hat_status IS '計算結果：viral/accelerating/stable/decaying/fading/insufficient';
