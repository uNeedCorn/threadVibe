-- 添加來源欄位
ALTER TABLE health_check_submissions
ADD COLUMN source TEXT DEFAULT 'Threads 限流測試器';

COMMENT ON COLUMN health_check_submissions.source IS '活動來源名稱';

-- 讓管理員可以查看健康檢測記錄（活動名單）
CREATE POLICY "admins_select_health_check_submissions" ON health_check_submissions
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM system_admins WHERE user_id = auth.uid())
  );
