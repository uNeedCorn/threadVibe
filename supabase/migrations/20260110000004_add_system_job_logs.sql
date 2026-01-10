-- ============================================
-- Add System Job Logs Table
-- Migration: 00004_add_system_job_logs.sql
-- ============================================

-- 系統級任務日誌（不綁定特定帳號）
CREATE TABLE system_job_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB
);

CREATE INDEX idx_system_job_logs_type ON system_job_logs(job_type);
CREATE INDEX idx_system_job_logs_started ON system_job_logs(started_at DESC);
CREATE INDEX idx_system_job_logs_status ON system_job_logs(status) WHERE status = 'failed';

-- RLS
ALTER TABLE system_job_logs ENABLE ROW LEVEL SECURITY;

-- 只有系統管理員可查看系統任務日誌
CREATE POLICY "system_job_logs_select" ON system_job_logs
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM system_admins WHERE user_id = auth.uid()
  )
);

COMMENT ON TABLE system_job_logs IS '系統級排程任務日誌（scheduled-sync, token-refresh 等）';
COMMENT ON COLUMN system_job_logs.job_type IS '任務類型：scheduled_sync, token_refresh, token_auto_revoke, workspace_cleanup';
COMMENT ON COLUMN system_job_logs.status IS '狀態：pending, running, completed, partial, failed';
