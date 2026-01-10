-- ============================================
-- 新增互動率指標欄位
-- Migration: 20260111000004_add_rate_metrics.sql
-- ============================================
-- Layer 3: 預計算的比率指標，在 sync 時更新

ALTER TABLE workspace_threads_posts
ADD COLUMN IF NOT EXISTS engagement_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS reply_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS repost_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS quote_rate NUMERIC(8,4) NOT NULL DEFAULT 0;

-- 計算公式：
-- engagement_rate = (likes + replies + reposts + quotes) / views * 100
-- reply_rate = replies / views * 100
-- repost_rate = reposts / views * 100
-- quote_rate = quotes / views * 100
-- virality_score = 已存在（傳播力加權分數）

COMMENT ON COLUMN workspace_threads_posts.engagement_rate IS '互動率 = (likes + replies + reposts + quotes) / views * 100';
COMMENT ON COLUMN workspace_threads_posts.reply_rate IS '回覆率 = replies / views * 100';
COMMENT ON COLUMN workspace_threads_posts.repost_rate IS '轉發率 = reposts / views * 100';
COMMENT ON COLUMN workspace_threads_posts.quote_rate IS '引用率 = quotes / views * 100';
