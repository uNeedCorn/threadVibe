# RLS 政策設計

## 概述

Row Level Security (RLS) 確保資料存取權限在資料庫層級實施。

---

## 全域原則

1. 所有表都啟用 RLS
2. 預設拒絕所有存取
3. 透過 Policy 明確授權
4. 使用 `auth.uid()` 驗證身份

---

## SECURITY DEFINER 輔助函數

為避免 RLS 政策遞歸問題（workspaces ↔ workspace_members 互相查詢導致無限循環），使用 SECURITY DEFINER 函數繞過 RLS 檢查：

```sql
-- 檢查當前用戶是否為指定 workspace 的成員
CREATE OR REPLACE FUNCTION is_workspace_member(ws_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = ws_id
    AND user_id = auth.uid()
    AND joined_at IS NOT NULL
  )
$$;

GRANT EXECUTE ON FUNCTION is_workspace_member(uuid) TO authenticated;
```

> **注意：** 此函數在 `20260110000011_fix_rls_recursion.sql` 中定義。

---

## workspaces

```sql
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- 成員可查看（使用 is_workspace_member 避免遞歸）
CREATE POLICY "workspace_select" ON workspaces
FOR SELECT USING (is_workspace_member(id));

-- 登入用戶可建立
CREATE POLICY "workspace_insert" ON workspaces
FOR INSERT WITH CHECK (
  auth.uid() = created_by_user_id
);

-- Owner 可更新
CREATE POLICY "workspace_update" ON workspaces
FOR UPDATE USING (
  id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);

-- Owner 可刪除（軟刪除）
CREATE POLICY "workspace_delete" ON workspaces
FOR DELETE USING (
  id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);
```

---

## workspace_members

```sql
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- 成員可查看同 Workspace 成員（使用 is_workspace_member 避免遞歸）
CREATE POLICY "members_select" ON workspace_members
FOR SELECT USING (
  user_id = auth.uid() OR is_workspace_member(workspace_id)
);

-- Owner 可新增成員
CREATE POLICY "members_insert" ON workspace_members
FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);

-- Owner 可更新成員角色
CREATE POLICY "members_update" ON workspace_members
FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);

-- Owner 可移除成員（或成員自己離開）
CREATE POLICY "members_delete" ON workspace_members
FOR DELETE USING (
  user_id = auth.uid() OR
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role = 'owner'
  )
);
```

---

## workspace_threads_accounts

```sql
ALTER TABLE workspace_threads_accounts ENABLE ROW LEVEL SECURITY;

-- 成員可查看（使用 is_workspace_member 避免遞歸）
CREATE POLICY "accounts_select" ON workspace_threads_accounts
FOR SELECT USING (is_workspace_member(workspace_id));

-- Owner/Editor 可新增
CREATE POLICY "accounts_insert" ON workspace_threads_accounts
FOR INSERT WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
  )
);

-- Owner/Editor 可更新
CREATE POLICY "accounts_update" ON workspace_threads_accounts
FOR UPDATE USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid() AND role IN ('owner', 'editor')
  )
);
```

---

## workspace_threads_tokens

```sql
ALTER TABLE workspace_threads_tokens ENABLE ROW LEVEL SECURITY;

-- ⚠️ 重要：token 屬於高敏感資料（含密文欄位），本專案採用「Edge Function 封裝」策略：
-- - client 端禁止直接讀寫此表（migration 00008 會 REVOKE ALL）
-- - OAuth callback / refresh / sync 等一律使用 service_role 存取
-- - UI 需要 token 狀態時，改呼叫 Edge Function `threads-account-status`
```

---

## workspace_threads_posts

```sql
ALTER TABLE workspace_threads_posts ENABLE ROW LEVEL SECURITY;

-- 成員可查看
CREATE POLICY "posts_select" ON workspace_threads_posts
FOR SELECT USING (
  workspace_threads_account_id IN (
    SELECT wta.id FROM workspace_threads_accounts wta
    JOIN workspace_members wm ON wta.workspace_id = wm.workspace_id
    WHERE wm.user_id = auth.uid() AND wm.joined_at IS NOT NULL
  )
);
```

---

## workspace_threads_post_metrics

```sql
ALTER TABLE workspace_threads_post_metrics ENABLE ROW LEVEL SECURITY;

-- 成員可查看
CREATE POLICY "metrics_select" ON workspace_threads_post_metrics
FOR SELECT USING (
  workspace_threads_post_id IN (
    SELECT wtp.id FROM workspace_threads_posts wtp
    JOIN workspace_threads_accounts wta ON wtp.workspace_threads_account_id = wta.id
    JOIN workspace_members wm ON wta.workspace_id = wm.workspace_id
    WHERE wm.user_id = auth.uid() AND wm.joined_at IS NOT NULL
  )
);
```

---

## workspace_threads_account_insights

```sql
ALTER TABLE workspace_threads_account_insights ENABLE ROW LEVEL SECURITY;

-- 成員可查看
CREATE POLICY "insights_select" ON workspace_threads_account_insights
FOR SELECT USING (
  workspace_threads_account_id IN (
    SELECT wta.id FROM workspace_threads_accounts wta
    JOIN workspace_members wm ON wta.workspace_id = wm.workspace_id
    WHERE wm.user_id = auth.uid() AND wm.joined_at IS NOT NULL
  )
);
```

---

## user_subscriptions

```sql
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- 只能查看自己的訂閱
CREATE POLICY "subscriptions_select" ON user_subscriptions
FOR SELECT USING (user_id = auth.uid());
```

---

## sync_logs

```sql
ALTER TABLE sync_logs ENABLE ROW LEVEL SECURITY;

-- Owner 可查看同步記錄
CREATE POLICY "logs_select" ON sync_logs
FOR SELECT USING (
  workspace_threads_account_id IN (
    SELECT wta.id FROM workspace_threads_accounts wta
    JOIN workspace_members wm ON wta.workspace_id = wm.workspace_id
    WHERE wm.user_id = auth.uid() AND wm.role = 'owner'
  )
);
```

---

## Service Role 例外

Edge Functions 使用 `service_role` key 時繞過 RLS：

```typescript
const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false }
});
// 此 client 具有完整資料庫存取權限
```
