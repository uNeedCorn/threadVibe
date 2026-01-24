-- ============================================================================
-- Migration: AI Weekly Reports
-- Description: 儲存 AI 週報分析結果
-- ============================================================================

-- 1. 建立 ai_weekly_reports 表
CREATE TABLE ai_weekly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_account_id UUID NOT NULL REFERENCES workspace_threads_accounts(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  report_content JSONB NOT NULL DEFAULT '{}',
  data_snapshot JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'completed', 'failed')),
  error_message TEXT,
  model_name TEXT NOT NULL DEFAULT 'claude-sonnet-4-20250514',
  input_tokens INTEGER,
  output_tokens INTEGER,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- 每個帳號每週只能有一份報告
  UNIQUE (workspace_threads_account_id, week_start)
);

-- 2. 建立索引
CREATE INDEX idx_ai_weekly_reports_account
  ON ai_weekly_reports(workspace_threads_account_id, week_start DESC);

CREATE INDEX idx_ai_weekly_reports_status
  ON ai_weekly_reports(status, created_at DESC);

-- 3. RLS 政策
ALTER TABLE ai_weekly_reports ENABLE ROW LEVEL SECURITY;

-- SELECT：工作區成員可查詢
CREATE POLICY "ai_weekly_reports_select" ON ai_weekly_reports
FOR SELECT USING (
  workspace_threads_account_id IN (
    SELECT id FROM workspace_threads_accounts WHERE is_workspace_member(workspace_id)
  )
);

-- INSERT/UPDATE/DELETE：僅 service_role（Edge Function 使用）

-- 4. 自動更新 updated_at
CREATE TRIGGER update_ai_weekly_reports_updated_at
  BEFORE UPDATE ON ai_weekly_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 5. 註解
COMMENT ON TABLE ai_weekly_reports IS 'AI 週報分析結果';
COMMENT ON COLUMN ai_weekly_reports.report_content IS '報告內容（JSON 格式，包含各區塊分析）';
COMMENT ON COLUMN ai_weekly_reports.data_snapshot IS '產生報告時的數據快照';
COMMENT ON COLUMN ai_weekly_reports.status IS '報告狀態：pending, generating, completed, failed';
COMMENT ON COLUMN ai_weekly_reports.model_name IS '使用的 AI 模型名稱';
