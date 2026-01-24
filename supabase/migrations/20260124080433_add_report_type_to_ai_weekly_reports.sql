-- 新增報告類型欄位
ALTER TABLE ai_weekly_reports
ADD COLUMN IF NOT EXISTS report_type TEXT NOT NULL DEFAULT 'insights';

-- 建立索引
CREATE INDEX IF NOT EXISTS idx_ai_weekly_reports_type
ON ai_weekly_reports (report_type);

COMMENT ON COLUMN ai_weekly_reports.report_type IS '報告類型：insights(AI洞察報告), content(內容分析報告)';
