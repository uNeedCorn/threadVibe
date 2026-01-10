-- ============================================
-- Fix workspace_members RLS Recursion
-- Migration: 20260111000002_fix_members_rls_recursion.sql
-- ============================================

-- 問題：members_select 政策有自引用子查詢導致無限遞迴
-- 解決：簡化政策，只允許用戶查看自己的 membership 記錄
--       以及使用 security definer function 來檢查權限

-- ============================================
-- Step 1: Create helper function (Security Definer)
-- ============================================

-- 先刪除舊的函數（如果存在）
DROP FUNCTION IF EXISTS is_workspace_member(UUID);

-- 此函數以 superuser 權限執行，繞過 RLS
CREATE FUNCTION is_workspace_member(p_workspace_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id
    AND user_id = auth.uid()
    AND joined_at IS NOT NULL
  );
END;
$$;

-- ============================================
-- Step 2: Fix workspace_members policy
-- ============================================

DROP POLICY IF EXISTS "members_select" ON workspace_members;

-- 用戶只能看到自己的 membership 記錄
-- 不再允許看到同 workspace 其他成員（避免遞迴）
CREATE POLICY "members_select" ON workspace_members
FOR SELECT USING (
  user_id = auth.uid()
);

-- ============================================
-- Step 3: Update other policies to use the helper function
-- ============================================

DROP POLICY IF EXISTS "workspace_select" ON workspaces;
DROP POLICY IF EXISTS "accounts_select" ON workspace_threads_accounts;

CREATE POLICY "workspace_select" ON workspaces
FOR SELECT USING (
  is_workspace_member(id)
);

CREATE POLICY "accounts_select" ON workspace_threads_accounts
FOR SELECT USING (
  is_workspace_member(workspace_id)
);

-- ============================================
-- Step 4: Update posts and related policies
-- ============================================

-- 更新貼文相關的 RLS 政策
DROP POLICY IF EXISTS "posts_select" ON workspace_threads_posts;

CREATE POLICY "posts_select" ON workspace_threads_posts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM workspace_threads_accounts wta
    WHERE wta.id = workspace_threads_posts.workspace_threads_account_id
    AND is_workspace_member(wta.workspace_id)
  )
);

-- 更新 metrics 相關政策
DROP POLICY IF EXISTS "post_metrics_select" ON workspace_threads_post_metrics;

CREATE POLICY "post_metrics_select" ON workspace_threads_post_metrics
FOR SELECT USING (
  workspace_threads_post_id IN (
    SELECT wtp.id FROM workspace_threads_posts wtp
    JOIN workspace_threads_accounts wta ON wtp.workspace_threads_account_id = wta.id
    WHERE is_workspace_member(wta.workspace_id)
  )
);

-- 更新 deltas 政策
DROP POLICY IF EXISTS "post_deltas_select" ON workspace_threads_post_metrics_deltas;

CREATE POLICY "post_deltas_select" ON workspace_threads_post_metrics_deltas
FOR SELECT USING (
  workspace_threads_post_id IN (
    SELECT wtp.id FROM workspace_threads_posts wtp
    JOIN workspace_threads_accounts wta ON wtp.workspace_threads_account_id = wta.id
    WHERE is_workspace_member(wta.workspace_id)
  )
);
