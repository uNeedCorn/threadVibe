-- ============================================================================
-- Migration: Remove profiles trigger
-- Description: 移除嘗試插入不存在的 profiles 表的 trigger
-- ============================================================================

-- 移除 trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 移除 function
DROP FUNCTION IF EXISTS public.handle_new_user();
