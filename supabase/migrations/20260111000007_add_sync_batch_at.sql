-- ============================================
-- ADR-001: 同步批次時間戳 (sync_batch_at)
-- ============================================
-- 新增 sync_batch_at 欄位，記錄排程的邏輯時間
-- 解決同一批次資料因 API 延遲造成的時間抖動問題
-- ============================================

-- ============================================
-- Layer 1: Snapshot 快照表
-- ============================================

-- 1.1 workspace_threads_post_metrics
ALTER TABLE workspace_threads_post_metrics
ADD COLUMN IF NOT EXISTS sync_batch_at TIMESTAMPTZ;

-- 1.2 workspace_threads_account_insights
ALTER TABLE workspace_threads_account_insights
ADD COLUMN IF NOT EXISTS sync_batch_at TIMESTAMPTZ;

-- ============================================
-- Layer 2: Delta 增量表
-- ============================================

-- 2.1 workspace_threads_post_metrics_deltas
ALTER TABLE workspace_threads_post_metrics_deltas
ADD COLUMN IF NOT EXISTS sync_batch_at TIMESTAMPTZ;

-- 2.2 workspace_threads_account_insights_deltas
ALTER TABLE workspace_threads_account_insights_deltas
ADD COLUMN IF NOT EXISTS sync_batch_at TIMESTAMPTZ;

-- ============================================
-- Layer 3: Current 當前表
-- ============================================

-- 3.1 workspace_threads_posts
ALTER TABLE workspace_threads_posts
ADD COLUMN IF NOT EXISTS last_sync_batch_at TIMESTAMPTZ;

-- 3.2 workspace_threads_accounts
ALTER TABLE workspace_threads_accounts
ADD COLUMN IF NOT EXISTS last_sync_batch_at TIMESTAMPTZ;

-- ============================================
-- 回填現有資料（對齊到 15 分鐘區間）
-- ============================================

-- L1: workspace_threads_post_metrics
UPDATE workspace_threads_post_metrics
SET sync_batch_at = date_trunc('hour', captured_at)
                    + (FLOOR(EXTRACT(MINUTE FROM captured_at) / 15) * INTERVAL '15 minutes')
WHERE sync_batch_at IS NULL;

-- L1: workspace_threads_account_insights
UPDATE workspace_threads_account_insights
SET sync_batch_at = date_trunc('hour', captured_at)
                    + (FLOOR(EXTRACT(MINUTE FROM captured_at) / 15) * INTERVAL '15 minutes')
WHERE sync_batch_at IS NULL;

-- L2: workspace_threads_post_metrics_deltas (使用 period_end 作為基準)
UPDATE workspace_threads_post_metrics_deltas
SET sync_batch_at = date_trunc('hour', period_end)
                    + (FLOOR(EXTRACT(MINUTE FROM period_end) / 15) * INTERVAL '15 minutes')
WHERE sync_batch_at IS NULL;

-- L2: workspace_threads_account_insights_deltas (使用 period_end 作為基準)
UPDATE workspace_threads_account_insights_deltas
SET sync_batch_at = date_trunc('hour', period_end)
                    + (FLOOR(EXTRACT(MINUTE FROM period_end) / 15) * INTERVAL '15 minutes')
WHERE sync_batch_at IS NULL;

-- L3: workspace_threads_posts (使用 last_metrics_sync_at 作為基準)
UPDATE workspace_threads_posts
SET last_sync_batch_at = date_trunc('hour', last_metrics_sync_at)
                         + (FLOOR(EXTRACT(MINUTE FROM last_metrics_sync_at) / 15) * INTERVAL '15 minutes')
WHERE last_sync_batch_at IS NULL AND last_metrics_sync_at IS NOT NULL;

-- L3: workspace_threads_accounts (使用 last_insights_sync_at 作為基準)
UPDATE workspace_threads_accounts
SET last_sync_batch_at = date_trunc('hour', last_insights_sync_at)
                         + (FLOOR(EXTRACT(MINUTE FROM last_insights_sync_at) / 15) * INTERVAL '15 minutes')
WHERE last_sync_batch_at IS NULL AND last_insights_sync_at IS NOT NULL;

-- ============================================
-- 設定 NOT NULL 約束（L1, L2）
-- ============================================

-- L1
ALTER TABLE workspace_threads_post_metrics
ALTER COLUMN sync_batch_at SET NOT NULL,
ALTER COLUMN sync_batch_at SET DEFAULT NOW();

ALTER TABLE workspace_threads_account_insights
ALTER COLUMN sync_batch_at SET NOT NULL,
ALTER COLUMN sync_batch_at SET DEFAULT NOW();

-- L2
ALTER TABLE workspace_threads_post_metrics_deltas
ALTER COLUMN sync_batch_at SET NOT NULL,
ALTER COLUMN sync_batch_at SET DEFAULT NOW();

ALTER TABLE workspace_threads_account_insights_deltas
ALTER COLUMN sync_batch_at SET NOT NULL,
ALTER COLUMN sync_batch_at SET DEFAULT NOW();

-- L3 保持 NULLABLE（首次建立時可能還沒同步過）

-- ============================================
-- 建立索引
-- ============================================

-- L1 索引
CREATE INDEX IF NOT EXISTS idx_post_metrics_sync_batch
ON workspace_threads_post_metrics(workspace_threads_post_id, sync_batch_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_insights_sync_batch
ON workspace_threads_account_insights(workspace_threads_account_id, sync_batch_at DESC);

-- L2 索引
CREATE INDEX IF NOT EXISTS idx_post_metrics_deltas_sync_batch
ON workspace_threads_post_metrics_deltas(workspace_threads_post_id, sync_batch_at DESC);

CREATE INDEX IF NOT EXISTS idx_account_insights_deltas_sync_batch
ON workspace_threads_account_insights_deltas(workspace_threads_account_id, sync_batch_at DESC);

-- L3 索引
CREATE INDEX IF NOT EXISTS idx_posts_last_sync_batch
ON workspace_threads_posts(last_sync_batch_at DESC)
WHERE last_sync_batch_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_last_sync_batch
ON workspace_threads_accounts(last_sync_batch_at DESC)
WHERE last_sync_batch_at IS NOT NULL;

-- ============================================
-- 欄位註解
-- ============================================

-- L1
COMMENT ON COLUMN workspace_threads_post_metrics.sync_batch_at IS '排程批次時間（對齊到 15 分鐘），用於趨勢查詢和資料分組';
COMMENT ON COLUMN workspace_threads_account_insights.sync_batch_at IS '排程批次時間（對齊到 15 分鐘），用於趨勢查詢和資料分組';

-- L2
COMMENT ON COLUMN workspace_threads_post_metrics_deltas.sync_batch_at IS '排程批次時間（對齊到 15 分鐘），用於增量統計分組';
COMMENT ON COLUMN workspace_threads_account_insights_deltas.sync_batch_at IS '排程批次時間（對齊到 15 分鐘），用於增量統計分組';

-- L3
COMMENT ON COLUMN workspace_threads_posts.last_sync_batch_at IS '最後同步批次時間（對齊到 15 分鐘），用於 UI 顯示統一同步時間';
COMMENT ON COLUMN workspace_threads_accounts.last_sync_batch_at IS '最後同步批次時間（對齊到 15 分鐘），用於 UI 顯示統一同步時間';
