-- ============================================
-- Add Token Refresh Tracking Columns
-- Migration: 00003_add_token_refresh_tracking.sql
-- ============================================

-- 新增 token refresh 追蹤欄位
ALTER TABLE workspace_threads_tokens
  ADD COLUMN refreshed_at TIMESTAMPTZ,
  ADD COLUMN refresh_error TEXT,
  ADD COLUMN refresh_error_at TIMESTAMPTZ;

-- 新增索引：追蹤需要刷新的 token
CREATE INDEX idx_tokens_refreshed ON workspace_threads_tokens(refreshed_at DESC)
  WHERE revoked_at IS NULL;

COMMENT ON COLUMN workspace_threads_tokens.refreshed_at IS 'Token 最後刷新時間';
COMMENT ON COLUMN workspace_threads_tokens.refresh_error IS '刷新失敗的錯誤訊息';
COMMENT ON COLUMN workspace_threads_tokens.refresh_error_at IS '刷新失敗的時間';
