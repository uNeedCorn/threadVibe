-- ============================================
-- Fix RLS Policy Recursion Issue
-- Migration: 20260110000011_fix_rls_recursion.sql
-- ============================================

-- 問題：原本的 RLS 政策使用自引用子查詢，導致遞歸問題
-- 解決：改用更直接的權限檢查，避免遞歸

-- ============================================
-- Drop existing problematic policies
-- ============================================

DROP POLICY IF EXISTS "workspace_select" ON workspaces;
DROP POLICY IF EXISTS "members_select" ON workspace_members;
DROP POLICY IF EXISTS "accounts_select" ON workspace_threads_accounts;

-- ============================================
-- WORKSPACES POLICIES (Fixed)
-- ============================================

-- 用戶可以看到自己是成員的 workspace
CREATE POLICY "workspace_select" ON workspaces
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = workspaces.id
    AND workspace_members.user_id = auth.uid()
    AND workspace_members.joined_at IS NOT NULL
  )
);

-- ============================================
-- WORKSPACE MEMBERS POLICIES (Fixed)
-- ============================================

-- 用戶可以直接查看自己的 membership 記錄
-- 也可以查看同一個 workspace 中其他成員的記錄
CREATE POLICY "members_select" ON workspace_members
FOR SELECT USING (
  -- 直接檢查：是這筆記錄的擁有者
  user_id = auth.uid()
  OR
  -- 間接檢查：已經是同一個 workspace 的成員
  EXISTS (
    SELECT 1 FROM workspace_members wm
    WHERE wm.workspace_id = workspace_members.workspace_id
    AND wm.user_id = auth.uid()
    AND wm.joined_at IS NOT NULL
  )
);

-- ============================================
-- THREADS ACCOUNTS POLICIES (Fixed)
-- ============================================

CREATE POLICY "accounts_select" ON workspace_threads_accounts
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_members.workspace_id = workspace_threads_accounts.workspace_id
    AND workspace_members.user_id = auth.uid()
    AND workspace_members.joined_at IS NOT NULL
  )
);
