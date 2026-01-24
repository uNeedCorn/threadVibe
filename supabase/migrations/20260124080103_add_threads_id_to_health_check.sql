-- 添加 Threads ID 欄位到健康檢測記錄
ALTER TABLE health_check_submissions
ADD COLUMN threads_id TEXT;

COMMENT ON COLUMN health_check_submissions.threads_id IS '使用者輸入的 Threads 帳號 ID（選填）';
