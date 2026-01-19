-- =============================================================================
-- Migration: Fix Profiles Table RLS Security (SEC-C03, SEC-H05)
-- Description: 限制 profiles 表的 RLS 政策，只允許查看自己和同 workspace 成員
-- Security Issues:
--   - SEC-C03: Profiles 表 RLS 過於寬鬆（USING (true) 允許任何人查看所有 profile）
--   - SEC-H05: handle_new_user() 缺少 SET search_path
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 建立 is_system_admin() helper 函數
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM system_admins WHERE user_id = auth.uid()
  );
$$;

COMMENT ON FUNCTION is_system_admin() IS '檢查當前用戶是否為系統管理員';

-- -----------------------------------------------------------------------------
-- 2. 移除舊的過於寬鬆的 RLS 政策
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;

-- -----------------------------------------------------------------------------
-- 3. 建立新的 RLS 政策
-- -----------------------------------------------------------------------------

-- 政策 1: 用戶可以查看自己的 profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

-- 政策 2: 用戶可以查看同 workspace 成員的 profile
CREATE POLICY "Users can view profiles in shared workspaces"
ON profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm1
    JOIN workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
    WHERE wm1.user_id = profiles.id
    AND wm2.user_id = auth.uid()
    AND wm1.joined_at IS NOT NULL
    AND wm2.joined_at IS NOT NULL
  )
);

-- 政策 3: 系統管理員可以查看所有 profiles
CREATE POLICY "System admins can view all profiles"
ON profiles FOR SELECT
TO authenticated
USING (is_system_admin());

-- -----------------------------------------------------------------------------
-- 4. 修正 handle_new_user() 函數，添加 SET search_path (SEC-H05)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION handle_new_user() IS '新用戶註冊時自動建立 profile（已修正 search_path）';

-- -----------------------------------------------------------------------------
-- 5. 驗證說明
-- -----------------------------------------------------------------------------
-- 驗證方式：
-- 1. 以普通用戶 A 登入，嘗試查詢：
--    SELECT * FROM profiles;
--    應該只能看到自己和同 workspace 成員的 profile
--
-- 2. 以系統管理員登入，嘗試查詢：
--    SELECT * FROM profiles;
--    應該能看到所有 profiles
--
-- 3. 測試排程頁面和快速發文面板，確認能正常顯示發布者名稱
