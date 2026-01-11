-- ============================================================================
-- Migration: LLM Usage Logs
-- Description: Track LLM API usage for cost monitoring
-- ============================================================================

-- 1. 建立 llm_usage_logs 表
CREATE TABLE llm_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  workspace_threads_account_id UUID REFERENCES workspace_threads_accounts(id) ON DELETE SET NULL,
  model_name TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,
  purpose TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. 建立索引
CREATE INDEX idx_llm_usage_logs_workspace
  ON llm_usage_logs(workspace_id, created_at DESC);

CREATE INDEX idx_llm_usage_logs_purpose
  ON llm_usage_logs(purpose, created_at DESC);

-- 3. RLS 政策
ALTER TABLE llm_usage_logs ENABLE ROW LEVEL SECURITY;

-- SELECT：工作區成員可查詢
CREATE POLICY "Members can view llm_usage_logs"
  ON llm_usage_logs FOR SELECT
  USING (is_workspace_member(workspace_id));

-- INSERT/UPDATE/DELETE：僅 service_role

-- 4. 註解
COMMENT ON TABLE llm_usage_logs IS 'LLM API 使用記錄，用於成本追蹤';
COMMENT ON COLUMN llm_usage_logs.purpose IS '用途：post_tagging, summarization, etc.';
