-- ============================================
-- 移除未使用的 clicks 欄位
-- Migration: 20260111000003_remove_clicks_columns.sql
-- ============================================
-- 原因：Threads API 不支援 clicks 指標

ALTER TABLE workspace_threads_posts
DROP COLUMN IF EXISTS current_clicks;

ALTER TABLE workspace_threads_post_metrics
DROP COLUMN IF EXISTS clicks;

ALTER TABLE workspace_threads_post_metrics_deltas
DROP COLUMN IF EXISTS clicks_delta;
