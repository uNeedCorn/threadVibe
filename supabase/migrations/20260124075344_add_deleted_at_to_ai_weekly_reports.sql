-- 新增軟刪除欄位
ALTER TABLE ai_weekly_reports
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 建立索引加速查詢未刪除的報告
CREATE INDEX IF NOT EXISTS idx_ai_weekly_reports_deleted_at
ON ai_weekly_reports (deleted_at)
WHERE deleted_at IS NULL;

COMMENT ON COLUMN ai_weekly_reports.deleted_at IS '軟刪除時間，NULL 表示未刪除';
