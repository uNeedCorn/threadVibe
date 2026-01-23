-- =============================================================================
-- Migration: Restore Profiles Trigger
-- Description: 重新建立新用戶註冊時自動建立 profile 的 trigger，並補建既有用戶的 profile
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. 重新建立 trigger（之前被 20260116170100 誤刪）
-- -----------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- -----------------------------------------------------------------------------
-- 2. 補建既有用戶的 profile（針對已註冊但沒有 profile 的用戶）
-- -----------------------------------------------------------------------------
INSERT INTO profiles (id, email, display_name, avatar_url)
SELECT
  u.id,
  u.email,
  COALESCE(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    split_part(u.email, '@', 1)
  ),
  u.raw_user_meta_data->>'avatar_url'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM profiles p WHERE p.id = u.id
);
