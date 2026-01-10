-- ============================================
-- Harden workspace_threads_tokens INSERT policy
-- Migration: 00007_harden_tokens_insert_policy.sql
-- ============================================

-- 原 tokens_insert 僅檢查 authorized_by_user_id，可能被用來替不屬於該使用者工作區的帳號寫入 token。
-- 目標：限制只能為「自己是 owner/editor 的 workspace」內的 Threads account 建立 token。

DROP POLICY IF EXISTS "tokens_insert" ON workspace_threads_tokens;

CREATE POLICY "tokens_insert" ON workspace_threads_tokens
FOR INSERT WITH CHECK (
  authorized_by_user_id = auth.uid()
  AND workspace_threads_account_id IN (
    SELECT wta.id
    FROM workspace_threads_accounts wta
    JOIN workspace_members wm ON wta.workspace_id = wm.workspace_id
    WHERE wm.user_id = auth.uid()
      AND wm.role IN ('owner', 'editor')
      AND wm.joined_at IS NOT NULL
  )
);
