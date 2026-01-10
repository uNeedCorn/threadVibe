-- ============================================
-- 新增比率指標到 Layer 1 Snapshot
-- Migration: 20260111000005_add_rate_metrics_to_snapshots.sql
-- ============================================
-- 讓前端能顯示比率指標的 sparkline 趨勢圖

ALTER TABLE workspace_threads_post_metrics
ADD COLUMN IF NOT EXISTS engagement_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS reply_rate NUMERIC(8,4) NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS virality_score NUMERIC(8,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN workspace_threads_post_metrics.engagement_rate IS '互動率 = (likes + replies + reposts + quotes) / views * 100';
COMMENT ON COLUMN workspace_threads_post_metrics.reply_rate IS '回覆率 = replies / views * 100';
COMMENT ON COLUMN workspace_threads_post_metrics.virality_score IS '傳播力分數';
