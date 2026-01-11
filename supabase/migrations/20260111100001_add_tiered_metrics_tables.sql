-- ============================================
-- ADR-002: 資料保留與 Rollup 策略
-- Phase 1: 建立分層資料表
-- ============================================
-- 建立 15m / hourly / daily 三層儲存架構
-- 用於貼文成效 (Post Metrics) 和帳號 Insights (Account Insights)
-- ============================================

-- ============================================
-- POST METRICS: 15 分鐘粒度
-- 保留期：貼文發布後 72 小時內
-- ============================================

CREATE TABLE workspace_threads_post_metrics_15m (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_post_id UUID NOT NULL REFERENCES workspace_threads_posts(id) ON DELETE CASCADE,
  views                     INTEGER NOT NULL DEFAULT 0,
  likes                     INTEGER NOT NULL DEFAULT 0,
  replies                   INTEGER NOT NULL DEFAULT 0,
  reposts                   INTEGER NOT NULL DEFAULT 0,
  quotes                    INTEGER NOT NULL DEFAULT 0,
  shares                    INTEGER NOT NULL DEFAULT 0,
  bucket_ts                 TIMESTAMPTZ NOT NULL,  -- 對齊到 15 分鐘
  captured_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE workspace_threads_post_metrics_15m IS '貼文成效 15 分鐘快照，保留貼文發布後 72 小時內的資料';
COMMENT ON COLUMN workspace_threads_post_metrics_15m.bucket_ts IS '時間桶（對齊到 15 分鐘），等同於 sync_batch_at';

-- 索引
CREATE INDEX idx_post_metrics_15m_post_bucket
ON workspace_threads_post_metrics_15m(workspace_threads_post_id, bucket_ts DESC);

CREATE INDEX idx_post_metrics_15m_bucket
ON workspace_threads_post_metrics_15m(bucket_ts DESC);

-- ============================================
-- POST METRICS: 小時粒度
-- 保留期：貼文發布後 3 個月內
-- ============================================

CREATE TABLE workspace_threads_post_metrics_hourly (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_post_id UUID NOT NULL REFERENCES workspace_threads_posts(id) ON DELETE CASCADE,
  views                     INTEGER NOT NULL DEFAULT 0,
  likes                     INTEGER NOT NULL DEFAULT 0,
  replies                   INTEGER NOT NULL DEFAULT 0,
  reposts                   INTEGER NOT NULL DEFAULT 0,
  quotes                    INTEGER NOT NULL DEFAULT 0,
  shares                    INTEGER NOT NULL DEFAULT 0,
  bucket_ts                 TIMESTAMPTZ NOT NULL,  -- 對齊到小時
  captured_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE workspace_threads_post_metrics_hourly IS '貼文成效小時快照，保留貼文發布後 3 個月內的資料';
COMMENT ON COLUMN workspace_threads_post_metrics_hourly.bucket_ts IS '時間桶（對齊到小時）';

-- 索引
CREATE INDEX idx_post_metrics_hourly_post_bucket
ON workspace_threads_post_metrics_hourly(workspace_threads_post_id, bucket_ts DESC);

CREATE INDEX idx_post_metrics_hourly_bucket
ON workspace_threads_post_metrics_hourly(bucket_ts DESC);

-- ============================================
-- POST METRICS: 日粒度
-- 保留期：貼文發布後 365 天內
-- ============================================

CREATE TABLE workspace_threads_post_metrics_daily (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_post_id UUID NOT NULL REFERENCES workspace_threads_posts(id) ON DELETE CASCADE,
  views                     INTEGER NOT NULL DEFAULT 0,
  likes                     INTEGER NOT NULL DEFAULT 0,
  replies                   INTEGER NOT NULL DEFAULT 0,
  reposts                   INTEGER NOT NULL DEFAULT 0,
  quotes                    INTEGER NOT NULL DEFAULT 0,
  shares                    INTEGER NOT NULL DEFAULT 0,
  bucket_date               DATE NOT NULL,  -- 日期
  captured_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE workspace_threads_post_metrics_daily IS '貼文成效日快照，保留貼文發布後 365 天內的資料';
COMMENT ON COLUMN workspace_threads_post_metrics_daily.bucket_date IS '日期桶';

-- 索引
CREATE INDEX idx_post_metrics_daily_post_bucket
ON workspace_threads_post_metrics_daily(workspace_threads_post_id, bucket_date DESC);

CREATE INDEX idx_post_metrics_daily_bucket
ON workspace_threads_post_metrics_daily(bucket_date DESC);

-- ============================================
-- ACCOUNT INSIGHTS: 15 分鐘粒度
-- 保留期：最近 7 天
-- ============================================

CREATE TABLE workspace_threads_account_insights_15m (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_account_id  UUID NOT NULL REFERENCES workspace_threads_accounts(id) ON DELETE CASCADE,
  followers_count               INTEGER NOT NULL DEFAULT 0,
  profile_views                 INTEGER NOT NULL DEFAULT 0,
  likes_count_7d                INTEGER NOT NULL DEFAULT 0,
  views_count_7d                INTEGER NOT NULL DEFAULT 0,
  demographics                  JSONB,
  bucket_ts                     TIMESTAMPTZ NOT NULL,  -- 對齊到 15 分鐘
  captured_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE workspace_threads_account_insights_15m IS '帳號 Insights 15 分鐘快照，保留最近 7 天的資料';
COMMENT ON COLUMN workspace_threads_account_insights_15m.bucket_ts IS '時間桶（對齊到 15 分鐘），等同於 sync_batch_at';

-- 索引
CREATE INDEX idx_account_insights_15m_account_bucket
ON workspace_threads_account_insights_15m(workspace_threads_account_id, bucket_ts DESC);

CREATE INDEX idx_account_insights_15m_bucket
ON workspace_threads_account_insights_15m(bucket_ts DESC);

-- ============================================
-- ACCOUNT INSIGHTS: 小時粒度
-- 保留期：最近 30 天
-- ============================================

CREATE TABLE workspace_threads_account_insights_hourly (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_account_id  UUID NOT NULL REFERENCES workspace_threads_accounts(id) ON DELETE CASCADE,
  followers_count               INTEGER NOT NULL DEFAULT 0,
  profile_views                 INTEGER NOT NULL DEFAULT 0,
  likes_count_7d                INTEGER NOT NULL DEFAULT 0,
  views_count_7d                INTEGER NOT NULL DEFAULT 0,
  demographics                  JSONB,
  bucket_ts                     TIMESTAMPTZ NOT NULL,  -- 對齊到小時
  captured_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE workspace_threads_account_insights_hourly IS '帳號 Insights 小時快照，保留最近 30 天的資料';
COMMENT ON COLUMN workspace_threads_account_insights_hourly.bucket_ts IS '時間桶（對齊到小時）';

-- 索引
CREATE INDEX idx_account_insights_hourly_account_bucket
ON workspace_threads_account_insights_hourly(workspace_threads_account_id, bucket_ts DESC);

CREATE INDEX idx_account_insights_hourly_bucket
ON workspace_threads_account_insights_hourly(bucket_ts DESC);

-- ============================================
-- ACCOUNT INSIGHTS: 日粒度
-- 保留期：最近 365 天
-- ============================================

CREATE TABLE workspace_threads_account_insights_daily (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_account_id  UUID NOT NULL REFERENCES workspace_threads_accounts(id) ON DELETE CASCADE,
  followers_count               INTEGER NOT NULL DEFAULT 0,
  profile_views                 INTEGER NOT NULL DEFAULT 0,
  likes_count_7d                INTEGER NOT NULL DEFAULT 0,
  views_count_7d                INTEGER NOT NULL DEFAULT 0,
  demographics                  JSONB,
  bucket_date                   DATE NOT NULL,  -- 日期
  captured_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE workspace_threads_account_insights_daily IS '帳號 Insights 日快照，保留最近 365 天的資料';
COMMENT ON COLUMN workspace_threads_account_insights_daily.bucket_date IS '日期桶';

-- 索引
CREATE INDEX idx_account_insights_daily_account_bucket
ON workspace_threads_account_insights_daily(workspace_threads_account_id, bucket_date DESC);

CREATE INDEX idx_account_insights_daily_bucket
ON workspace_threads_account_insights_daily(bucket_date DESC);

-- ============================================
-- 啟用 RLS
-- ============================================

ALTER TABLE workspace_threads_post_metrics_15m ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_threads_post_metrics_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_threads_post_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_threads_account_insights_15m ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_threads_account_insights_hourly ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_threads_account_insights_daily ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS 政策：POST METRICS (使用 is_workspace_member 函數避免遞歸)
-- ============================================

-- 15m
CREATE POLICY "post_metrics_15m_select" ON workspace_threads_post_metrics_15m
FOR SELECT USING (
  workspace_threads_post_id IN (
    SELECT wtp.id FROM workspace_threads_posts wtp
    JOIN workspace_threads_accounts wta ON wtp.workspace_threads_account_id = wta.id
    WHERE is_workspace_member(wta.workspace_id)
  )
);

CREATE POLICY "post_metrics_15m_insert" ON workspace_threads_post_metrics_15m
FOR INSERT WITH CHECK (
  workspace_threads_post_id IN (
    SELECT wtp.id FROM workspace_threads_posts wtp
    JOIN workspace_threads_accounts wta ON wtp.workspace_threads_account_id = wta.id
    WHERE is_workspace_member(wta.workspace_id)
  )
);

-- hourly
CREATE POLICY "post_metrics_hourly_select" ON workspace_threads_post_metrics_hourly
FOR SELECT USING (
  workspace_threads_post_id IN (
    SELECT wtp.id FROM workspace_threads_posts wtp
    JOIN workspace_threads_accounts wta ON wtp.workspace_threads_account_id = wta.id
    WHERE is_workspace_member(wta.workspace_id)
  )
);

CREATE POLICY "post_metrics_hourly_insert" ON workspace_threads_post_metrics_hourly
FOR INSERT WITH CHECK (
  workspace_threads_post_id IN (
    SELECT wtp.id FROM workspace_threads_posts wtp
    JOIN workspace_threads_accounts wta ON wtp.workspace_threads_account_id = wta.id
    WHERE is_workspace_member(wta.workspace_id)
  )
);

-- daily
CREATE POLICY "post_metrics_daily_select" ON workspace_threads_post_metrics_daily
FOR SELECT USING (
  workspace_threads_post_id IN (
    SELECT wtp.id FROM workspace_threads_posts wtp
    JOIN workspace_threads_accounts wta ON wtp.workspace_threads_account_id = wta.id
    WHERE is_workspace_member(wta.workspace_id)
  )
);

CREATE POLICY "post_metrics_daily_insert" ON workspace_threads_post_metrics_daily
FOR INSERT WITH CHECK (
  workspace_threads_post_id IN (
    SELECT wtp.id FROM workspace_threads_posts wtp
    JOIN workspace_threads_accounts wta ON wtp.workspace_threads_account_id = wta.id
    WHERE is_workspace_member(wta.workspace_id)
  )
);

-- ============================================
-- RLS 政策：ACCOUNT INSIGHTS
-- ============================================

-- 15m
CREATE POLICY "account_insights_15m_select" ON workspace_threads_account_insights_15m
FOR SELECT USING (
  workspace_threads_account_id IN (
    SELECT wta.id FROM workspace_threads_accounts wta
    WHERE is_workspace_member(wta.workspace_id)
  )
);

CREATE POLICY "account_insights_15m_insert" ON workspace_threads_account_insights_15m
FOR INSERT WITH CHECK (
  workspace_threads_account_id IN (
    SELECT wta.id FROM workspace_threads_accounts wta
    WHERE is_workspace_member(wta.workspace_id)
  )
);

-- hourly
CREATE POLICY "account_insights_hourly_select" ON workspace_threads_account_insights_hourly
FOR SELECT USING (
  workspace_threads_account_id IN (
    SELECT wta.id FROM workspace_threads_accounts wta
    WHERE is_workspace_member(wta.workspace_id)
  )
);

CREATE POLICY "account_insights_hourly_insert" ON workspace_threads_account_insights_hourly
FOR INSERT WITH CHECK (
  workspace_threads_account_id IN (
    SELECT wta.id FROM workspace_threads_accounts wta
    WHERE is_workspace_member(wta.workspace_id)
  )
);

-- daily
CREATE POLICY "account_insights_daily_select" ON workspace_threads_account_insights_daily
FOR SELECT USING (
  workspace_threads_account_id IN (
    SELECT wta.id FROM workspace_threads_accounts wta
    WHERE is_workspace_member(wta.workspace_id)
  )
);

CREATE POLICY "account_insights_daily_insert" ON workspace_threads_account_insights_daily
FOR INSERT WITH CHECK (
  workspace_threads_account_id IN (
    SELECT wta.id FROM workspace_threads_accounts wta
    WHERE is_workspace_member(wta.workspace_id)
  )
);

-- ============================================
-- 唯一約束（防止重複寫入同一時間桶）
-- ============================================

-- Post Metrics
CREATE UNIQUE INDEX idx_post_metrics_15m_unique
ON workspace_threads_post_metrics_15m(workspace_threads_post_id, bucket_ts);

CREATE UNIQUE INDEX idx_post_metrics_hourly_unique
ON workspace_threads_post_metrics_hourly(workspace_threads_post_id, bucket_ts);

CREATE UNIQUE INDEX idx_post_metrics_daily_unique
ON workspace_threads_post_metrics_daily(workspace_threads_post_id, bucket_date);

-- Account Insights
CREATE UNIQUE INDEX idx_account_insights_15m_unique
ON workspace_threads_account_insights_15m(workspace_threads_account_id, bucket_ts);

CREATE UNIQUE INDEX idx_account_insights_hourly_unique
ON workspace_threads_account_insights_hourly(workspace_threads_account_id, bucket_ts);

CREATE UNIQUE INDEX idx_account_insights_daily_unique
ON workspace_threads_account_insights_daily(workspace_threads_account_id, bucket_date);
