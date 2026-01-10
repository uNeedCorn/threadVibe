-- ============================================
-- 新增轉發率與引用率到 Layer 1 Snapshot
-- Migration: 20260111000006_add_repost_quote_rate_to_snapshots.sql
-- ============================================

ALTER TABLE workspace_threads_post_metrics
ADD COLUMN IF NOT EXISTS repost_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS quote_rate NUMERIC(8,4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN workspace_threads_post_metrics.repost_rate IS '轉發率 = reposts / views * 100';
COMMENT ON COLUMN workspace_threads_post_metrics.quote_rate IS '引用率 = quotes / views * 100';
