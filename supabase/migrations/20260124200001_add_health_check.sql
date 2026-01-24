-- =============================================
-- Threads 健康檢測器 - 資料表
-- =============================================

-- 健康檢測記錄表
CREATE TABLE health_check_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- 輸入數據
  followers INTEGER NOT NULL,
  post_count INTEGER NOT NULL,
  total_views BIGINT NOT NULL,

  -- 計算結果
  cumulative_vfr INTEGER NOT NULL,  -- 累計觸及倍數 (Views / Followers Ratio)
  cumulative_status TEXT NOT NULL,   -- 'normal' | 'warning' | 'danger'
  max_vfr INTEGER NOT NULL,          -- 最高單篇觸及倍數
  max_status TEXT NOT NULL,
  latest_vfr INTEGER NOT NULL,       -- 最近貼文觸及倍數
  latest_status TEXT NOT NULL,
  in_cooldown BOOLEAN NOT NULL DEFAULT FALSE,  -- 是否處於冷卻期

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_health_check_user_id ON health_check_submissions(user_id);
CREATE INDEX idx_health_check_created_at ON health_check_submissions(created_at DESC);

-- RLS
ALTER TABLE health_check_submissions ENABLE ROW LEVEL SECURITY;

-- 使用者只能查看自己的記錄
CREATE POLICY "users_select_own_health_check"
  ON health_check_submissions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- 不允許 anon 存取
-- INSERT/UPDATE/DELETE 只由 service_role 透過 Edge Function 執行

COMMENT ON TABLE health_check_submissions IS 'Threads 健康檢測記錄';
COMMENT ON COLUMN health_check_submissions.cumulative_vfr IS '累計觸及倍數 = total_views / followers';
COMMENT ON COLUMN health_check_submissions.in_cooldown IS '是否處於冷卻期（有爆發但最近下降）';
