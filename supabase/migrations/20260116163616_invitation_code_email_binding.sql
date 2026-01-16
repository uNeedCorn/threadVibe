-- ============================================================================
-- Migration: Invitation code email binding
-- Description: 邀請碼改為綁定特定 email，而非一次性使用
-- ============================================================================

-- 1. 新增 email 欄位
ALTER TABLE invitation_codes ADD COLUMN email TEXT;

-- 2. 建立 email 索引（加速查詢）
CREATE INDEX idx_invitation_codes_email ON invitation_codes(email);

-- 3. 新增唯一約束：同一 email 只能有一個邀請碼
-- 注意：允許 email 為 NULL（向後相容舊的邀請碼）
-- 過期檢查在應用層面（generate_invitation_code 函數）進行
CREATE UNIQUE INDEX idx_invitation_codes_email_unique
ON invitation_codes(email)
WHERE email IS NOT NULL;

-- 4. 更新欄位註解
COMMENT ON COLUMN invitation_codes.email IS '綁定的 Email（只有此 email 可使用此邀請碼）';
COMMENT ON COLUMN invitation_codes.is_used IS '是否已首次使用（記錄用，不阻擋後續登入）';
COMMENT ON COLUMN invitation_codes.used_by IS '首次使用此邀請碼的用戶';
COMMENT ON COLUMN invitation_codes.used_at IS '首次使用時間';

-- 5. 更新驗證函數：改為用 email 匹配
CREATE OR REPLACE FUNCTION validate_invitation_code_by_email(p_email TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation invitation_codes%ROWTYPE;
BEGIN
  -- 查詢該 email 對應的邀請碼
  SELECT * INTO v_invitation
  FROM invitation_codes
  WHERE email = lower(trim(p_email));

  -- 檢查是否存在
  IF v_invitation.id IS NULL THEN
    RETURN jsonb_build_object('valid', false, 'error', 'EMAIL_NOT_INVITED');
  END IF;

  -- 檢查是否過期
  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'EXPIRED');
  END IF;

  -- 有效（不檢查 is_used，允許重複登入）
  RETURN jsonb_build_object(
    'valid', true,
    'invitation_id', v_invitation.id,
    'code', v_invitation.code,
    'is_first_use', NOT v_invitation.is_used
  );
END;
$$;

-- 6. 更新使用函數：記錄首次使用，但不阻擋後續登入
CREATE OR REPLACE FUNCTION use_invitation_code_by_email(p_email TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_invitation_id UUID;
BEGIN
  -- 先驗證
  v_result := validate_invitation_code_by_email(p_email);

  IF NOT (v_result->>'valid')::boolean THEN
    RETURN FALSE;
  END IF;

  v_invitation_id := (v_result->>'invitation_id')::uuid;

  -- 只在首次使用時更新（is_used = false 時）
  UPDATE invitation_codes
  SET is_used = TRUE,
      used_by = p_user_id,
      used_at = now()
  WHERE id = v_invitation_id
    AND is_used = FALSE;

  -- 無論是否為首次使用，都返回 true（允許登入）
  RETURN TRUE;
END;
$$;

-- 7. 新增管理員產生邀請碼時可指定 email
CREATE OR REPLACE FUNCTION generate_invitation_code(
  p_email TEXT DEFAULT NULL,
  p_note TEXT DEFAULT NULL,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_user_id UUID;
  v_email TEXT;
BEGIN
  -- 檢查是否為管理員
  v_user_id := auth.uid();
  IF NOT EXISTS (SELECT 1 FROM system_admins WHERE user_id = v_user_id) THEN
    RAISE EXCEPTION 'Only administrators can generate invitation codes';
  END IF;

  -- 正規化 email
  v_email := lower(trim(p_email));

  -- 檢查 email 是否已有邀請碼
  IF v_email IS NOT NULL AND EXISTS (
    SELECT 1 FROM invitation_codes
    WHERE email = v_email
    AND (expires_at IS NULL OR expires_at > now())
  ) THEN
    RAISE EXCEPTION 'This email already has an active invitation code';
  END IF;

  -- 產生 8 碼大寫英數字邀請碼
  v_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));

  -- 確保唯一性（如果衝突則重新產生）
  WHILE EXISTS (SELECT 1 FROM invitation_codes WHERE code = v_code) LOOP
    v_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
  END LOOP;

  -- 插入邀請碼
  INSERT INTO invitation_codes (code, email, created_by, note, expires_at)
  VALUES (v_code, v_email, v_user_id, p_note, p_expires_at);

  RETURN v_code;
END;
$$;

-- 8. 更新 code 驗證函數：移除 is_used 檢查，因為邀請碼現在綁定 email 後可重複使用
CREATE OR REPLACE FUNCTION validate_invitation_code(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- 不再檢查 is_used，email 綁定檢查在 OAuth callback 中進行

  -- 檢查是否過期
  IF v_invitation.expires_at IS NOT NULL AND v_invitation.expires_at < now() THEN
    RETURN jsonb_build_object('valid', false, 'error', 'EXPIRED');
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'invitation_id', v_invitation.id,
    'email', v_invitation.email,
    'is_bound', v_invitation.email IS NOT NULL
  );
END;
$$;

-- 9. 保留原本的 use_invitation_code 函數（向後相容），但加上 search_path
CREATE OR REPLACE FUNCTION use_invitation_code(p_code TEXT, p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
