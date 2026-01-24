-- 移除 unique constraint，允許同一週產生多份報告
ALTER TABLE ai_weekly_reports 
DROP CONSTRAINT IF EXISTS ai_weekly_reports_workspace_threads_account_id_week_start_key;

-- 新增索引以加速查詢（保留原本的查詢效率）
CREATE INDEX IF NOT EXISTS idx_ai_weekly_reports_account_week 
ON ai_weekly_reports (workspace_threads_account_id, week_start);

-- 新增月份限制檢查用的索引
CREATE INDEX IF NOT EXISTS idx_ai_weekly_reports_account_created 
ON ai_weekly_reports (workspace_threads_account_id, created_at);

COMMENT ON TABLE ai_weekly_reports IS '每次產生報告都是獨立記錄，每帳號每月限 5 份';
