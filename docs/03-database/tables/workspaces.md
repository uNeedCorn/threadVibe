# workspaces

## 說明

工作區是資料隔離的基本單位。每個 Workspace 獨立管理 Threads 帳號、貼文數據、成員權限。

---

## Schema

```sql
CREATE TABLE workspaces (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  created_by_user_id UUID NOT NULL REFERENCES auth.users(id),
  deleted_at      TIMESTAMPTZ,
  deletion_confirmed_by JSONB DEFAULT '[]',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 欄位說明

| 欄位 | 類型 | Nullable | 說明 |
|------|------|----------|------|
| `id` | UUID | NO | 主鍵 |
| `name` | TEXT | NO | Workspace 名稱 |
| `created_by_user_id` | UUID | NO | 建立者 (FK → auth.users) |
| `deleted_at` | TIMESTAMPTZ | YES | 軟刪除時間 |
| `deletion_confirmed_by` | JSONB | YES | 確認刪除的 Owner ID 列表 |
| `created_at` | TIMESTAMPTZ | NO | 建立時間 |
| `updated_at` | TIMESTAMPTZ | NO | 更新時間 |

---

## 索引

```sql
CREATE INDEX idx_workspaces_created_by ON workspaces(created_by_user_id);
CREATE INDEX idx_workspaces_deleted_at ON workspaces(deleted_at) WHERE deleted_at IS NOT NULL;
```

---

## 關聯

| 關聯表 | 關係 | 說明 |
|--------|------|------|
| `auth.users` | n:1 | 建立者 |
| `workspace_members` | 1:n | 成員列表 |
| `workspace_threads_accounts` | 1:n | 綁定的 Threads 帳號 |

---

## 軟刪除機制

1. Owner 發起刪除 → 設定 `deleted_at`
2. 多 Owner 情況：需所有 Owner 確認
3. 確認後加入 `deletion_confirmed_by` 陣列
4. 30 天後由 Job 永久刪除

---

## 業務規則

- 首次登入自動建立「預設 Workspace」
- 名稱可重複（不同使用者可用相同名稱）
- 刪除時：所有關聯資料一併軟刪除
