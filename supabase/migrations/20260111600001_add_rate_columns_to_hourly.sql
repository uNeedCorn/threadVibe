-- =============================================================================
-- Migration: Add Rate/Score Columns to Hourly Tables
-- 為 hourly 表新增 rate/score 欄位，支援 Sparkline 趨勢顯示
-- =============================================================================

-- Post Metrics Hourly: 新增 rate/score 欄位
ALTER TABLE workspace_threads_post_metrics_hourly
ADD COLUMN IF NOT EXISTS engagement_rate NUMERIC(8,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS reply_rate NUMERIC(8,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS repost_rate NUMERIC(8,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS quote_rate NUMERIC(8,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS virality_score NUMERIC(8,4) DEFAULT 0;

COMMENT ON COLUMN workspace_threads_post_metrics_hourly.engagement_rate IS '互動率 = (likes + replies + reposts + quotes) / views * 100';
COMMENT ON COLUMN workspace_threads_post_metrics_hourly.reply_rate IS '回覆率 = replies / views * 100';
COMMENT ON COLUMN workspace_threads_post_metrics_hourly.repost_rate IS '轉發率 = reposts / views * 100';
COMMENT ON COLUMN workspace_threads_post_metrics_hourly.quote_rate IS '引用率 = quotes / views * 100';
COMMENT ON COLUMN workspace_threads_post_metrics_hourly.virality_score IS '傳播力 = (reposts + quotes) / views * 100';

-- Post Metrics Daily: 同步新增（保持一致性）
ALTER TABLE workspace_threads_post_metrics_daily
ADD COLUMN IF NOT EXISTS engagement_rate NUMERIC(8,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS reply_rate NUMERIC(8,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS repost_rate NUMERIC(8,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS quote_rate NUMERIC(8,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS virality_score NUMERIC(8,4) DEFAULT 0;

COMMENT ON COLUMN workspace_threads_post_metrics_daily.engagement_rate IS '互動率 = (likes + replies + reposts + quotes) / views * 100';
COMMENT ON COLUMN workspace_threads_post_metrics_daily.reply_rate IS '回覆率 = replies / views * 100';
COMMENT ON COLUMN workspace_threads_post_metrics_daily.repost_rate IS '轉發率 = reposts / views * 100';
COMMENT ON COLUMN workspace_threads_post_metrics_daily.quote_rate IS '引用率 = quotes / views * 100';
COMMENT ON COLUMN workspace_threads_post_metrics_daily.virality_score IS '傳播力 = (reposts + quotes) / views * 100';

-- Post Metrics 15m: 同步新增（保持一致性）
ALTER TABLE workspace_threads_post_metrics_15m
ADD COLUMN IF NOT EXISTS engagement_rate NUMERIC(8,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS reply_rate NUMERIC(8,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS repost_rate NUMERIC(8,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS quote_rate NUMERIC(8,4) DEFAULT 0,
ADD COLUMN IF NOT EXISTS virality_score NUMERIC(8,4) DEFAULT 0;

COMMENT ON COLUMN workspace_threads_post_metrics_15m.engagement_rate IS '互動率 = (likes + replies + reposts + quotes) / views * 100';
COMMENT ON COLUMN workspace_threads_post_metrics_15m.reply_rate IS '回覆率 = replies / views * 100';
COMMENT ON COLUMN workspace_threads_post_metrics_15m.repost_rate IS '轉發率 = reposts / views * 100';
COMMENT ON COLUMN workspace_threads_post_metrics_15m.quote_rate IS '引用率 = quotes / views * 100';
COMMENT ON COLUMN workspace_threads_post_metrics_15m.virality_score IS '傳播力 = (reposts + quotes) / views * 100';
