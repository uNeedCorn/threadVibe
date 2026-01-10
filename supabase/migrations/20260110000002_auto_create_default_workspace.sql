-- ============================================
-- Auto Create Default Workspace for New Users
-- Migration: 00002_auto_create_default_workspace.sql
-- ============================================

-- ============================================
-- FUNCTION: Create Default Workspace
-- ============================================

CREATE OR REPLACE FUNCTION public.create_default_workspace()
RETURNS TRIGGER AS $$
DECLARE
  new_workspace_id UUID;
  display_name TEXT;
BEGIN
  -- 取得用戶顯示名稱（優先順序：name > full_name > email 前綴）
  display_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- 建立預設 Workspace
  INSERT INTO public.workspaces (name, created_by_user_id)
  VALUES (display_name || ' 的工作區', NEW.id)
  RETURNING id INTO new_workspace_id;

  -- 建立 Owner 成員關係
  INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_at)
  VALUES (new_workspace_id, NEW.id, 'owner', NOW());

  -- 建立預設訂閱方案（Free）
  INSERT INTO public.user_subscriptions (user_id, plan_type)
  VALUES (NEW.id, 'free');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- TRIGGER: On Auth User Created
-- ============================================

-- 確保 trigger 不存在時才建立（避免重複）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_workspace();

-- ============================================
-- COMMENT
-- ============================================

COMMENT ON FUNCTION public.create_default_workspace() IS
'新用戶註冊時自動建立預設 Workspace 和 Free 訂閱方案。
預設 Workspace 名稱格式："{用戶名} 的工作區"
前端可在 Onboarding 流程中引導用戶更名。';
