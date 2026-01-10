-- ============================================
-- Add OAuth State Usage Tracking
-- Migration: 00005_add_oauth_state_usage.sql
-- ============================================

-- 用於防止 OAuth state 重放攻擊（單次使用）
CREATE TABLE oauth_state_usage (
  state_hash TEXT PRIMARY KEY,
  workspace_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_oauth_state_usage_expires_at ON oauth_state_usage(expires_at);
CREATE INDEX idx_oauth_state_usage_used_at ON oauth_state_usage(used_at DESC);

-- RLS
ALTER TABLE oauth_state_usage ENABLE ROW LEVEL SECURITY;

-- 只有系統管理員可查看（debug/監控用）
CREATE POLICY "oauth_state_usage_select" ON oauth_state_usage
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM system_admins WHERE user_id = auth.uid()
  )
);

COMMENT ON TABLE oauth_state_usage IS 'OAuth state 單次使用追蹤（防重放攻擊）';
COMMENT ON COLUMN oauth_state_usage.state_hash IS 'SHA-256(state) hex';
COMMENT ON COLUMN oauth_state_usage.expires_at IS 'state 過期時間（用於清理）';
