-- ============================================================================
-- Migration: Add invitation_codes table
-- Description: Beta 階段邀請碼系統，控制新用戶註冊
-- ============================================================================

-- 1. 建立邀請碼表
CREATE TABLE invitation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) UNIQUE NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_by UUID REFERENCES auth.users(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  note TEXT
);

-- 2. 建立索引
CREATE INDEX idx_invitation_codes_code ON invitation_codes(code);
CREATE INDEX idx_invitation_codes_is_used ON invitation_codes(is_used);

-- 3. 啟用 RLS
ALTER TABLE invitation_codes ENABLE ROW LEVEL SECURITY;

-- 4. RLS 政策：只有管理員可以查看和管理邀請碼
CREATE POLICY "admins_select_invitation_codes" ON invitation_codes
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM system_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "admins_insert_invitation_codes" ON invitation_codes
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM system_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "admins_update_invitation_codes" ON invitation_codes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM system_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "admins_delete_invitation_codes" ON invitation_codes
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM system_admins WHERE user_id = auth.uid())
  );

-- 5. 註解
COMMENT ON TABLE invitation_codes IS 'Beta 階段邀請碼，控制新用戶註冊';
COMMENT ON COLUMN invitation_codes.code IS '邀請碼（唯一）';
COMMENT ON COLUMN invitation_codes.is_used IS '是否已使用';
COMMENT ON COLUMN invitation_codes.used_by IS '使用此邀請碼的用戶';
COMMENT ON COLUMN invitation_codes.used_at IS '使用時間';
COMMENT ON COLUMN invitation_codes.expires_at IS '過期時間（NULL 表示永不過期）';
COMMENT ON COLUMN invitation_codes.created_by IS '建立者（管理員）';
COMMENT ON COLUMN invitation_codes.note IS '備註（例如：給誰用的）';

-- 6. 建立產生邀請碼的 function（給管理員使用）
CREATE OR REPLACE FUNCTION generate_invitation_code(
  p_note TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_code TEXT;
  v_user_id UUID;
BEGIN
  -- 檢查是否為管理員
  v_user_id := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM system_admins WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'Only administrators can generate invitation codes';
  END IF;

  -- 產生 8 碼大寫英數字邀請碼
  v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));

  -- 確保唯一性（如果衝突則重新產生）
  WHILE EXISTS (SELECT 1 FROM invitation_codes WHERE code = v_code) LOOP
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
  END LOOP;

  -- 插入邀請碼
  INSERT INTO invitation_codes (code, created_by, note, expires_at)
  VALUES (v_code, v_user_id, p_note, p_expires_at);

  RETURN v_code;
END;
$$;

-- 7. 建立驗證邀請碼的 function（給 service role 使用）
CREATE OR REPLACE FUNCTION validate_invitation_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_invitation invitation_codes%ROWTYPE;
BEGIN
  -- 查詢邀請碼
  SELECT * INTO v_invitation
  FROM invitation_codes
  WHERE code = upper(trim(p_code));

  -- 檢查是否存在
  IF v_invitation.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'INVALID_CODE');
  END IF;

  -- 檢查是否已使用
  IF v_invitation.is_used THEN
    RETURN jsonb_build_object('valid', false, 'error', 'ALREADY_USED');
  END IF;

  -- 檢查是否過期
  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'EXPIRED');
  END IF;

  RETURN jsonb_build_object('valid', true, 'invitation_id', v_invitation.id);
END;
$$;

-- 8. 建立使用邀請碼的 function（給 service role 使用）
CREATE OR REPLACE FUNCTION use_invitation_code(p_code TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- 先驗證
  v_result := validate_invitation_code(p_code);

  IF NOT (v_result->>'valid')::boolean THEN
    RETURN FALSE;
  END IF;

  -- 標記為已使用
  UPDATE invitation_codes
  SET is_used = TRUE,
      used_by = p_user_id,
      used_at = now()
  WHERE code = upper(trim(p_code))
    AND is_used = FALSE;

  RETURN FOUND;
END;
$$;

-- ============================================================================
-- Waitlist 功能
-- ============================================================================

-- 9. 建立 waitlist 表
CREATE TABLE beta_waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  threads_username TEXT,
  reason TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  notes TEXT
);

-- 10. 建立索引
CREATE INDEX idx_beta_waitlist_status ON beta_waitlist(status);
CREATE INDEX idx_beta_waitlist_email ON beta_waitlist(email);

-- 11. 啟用 RLS
ALTER TABLE beta_waitlist ENABLE ROW LEVEL SECURITY;

-- 12. RLS 政策：用戶可以新增自己的 waitlist 記錄
CREATE POLICY "users_insert_own_waitlist" ON beta_waitlist
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- 13. RLS 政策：用戶可以查看自己的 waitlist 狀態
CREATE POLICY "users_select_own_waitlist" ON beta_waitlist
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 14. RLS 政策：管理員可以查看和管理所有 waitlist
CREATE POLICY "admins_all_waitlist" ON beta_waitlist
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM system_admins WHERE user_id = auth.uid())
  );

-- 15. 註解
COMMENT ON TABLE beta_waitlist IS 'Beta 測試等待名單';
COMMENT ON COLUMN beta_waitlist.user_id IS '關聯的用戶（已登入但未完成註冊）';
COMMENT ON COLUMN beta_waitlist.email IS '用戶 Email';
COMMENT ON COLUMN beta_waitlist.name IS '用戶名稱';
COMMENT ON COLUMN beta_waitlist.threads_username IS 'Threads 帳號名稱（供審核用）';
COMMENT ON COLUMN beta_waitlist.reason IS '想要使用的原因';
COMMENT ON COLUMN beta_waitlist.status IS '狀態：pending/approved/rejected';
COMMENT ON COLUMN beta_waitlist.reviewed_by IS '審核者（管理員）';
COMMENT ON COLUMN beta_waitlist.notes IS '管理員備註';
