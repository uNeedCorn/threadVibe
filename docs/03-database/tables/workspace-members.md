# workspace_members

## 說明

記錄 User 與 Workspace 的 n:n 關係，包含角色與邀請狀態。

---

## Schema

```sql
CREATE TABLE workspace_members (
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  joined_at    TIMESTAMPTZ,
  invited_by   UUID REFERENCES auth.users(id),
  PRIMARY KEY (workspace_id, user_id)
);
```

---

## 欄位說明

| 欄位 | 類型 | Nullable | 說明 |
|------|------|----------|------|
| `workspace_id` | UUID | NO | Workspace ID (PK, FK) |
| `user_id` | UUID | NO | User ID (PK, FK) |
| `role` | TEXT | NO | 角色：owner/editor/viewer |
| `invited_at` | TIMESTAMPTZ | NO | 邀請時間 |
| `joined_at` | TIMESTAMPTZ | YES | 加入時間（null = 待接受） |
| `invited_by` | UUID | YES | 邀請人 (FK → auth.users) |

---

## 索引

```sql
CREATE INDEX idx_members_user ON workspace_members(user_id);
CREATE INDEX idx_members_workspace ON workspace_members(workspace_id);
```

---

## 關聯

| 關聯表 | 關係 | 說明 |
|--------|------|------|
| `workspaces` | n:1 | 所屬 Workspace |
| `auth.users` | n:1 | 使用者 |

---

## 角色權限

| 角色 | 查看 | 編輯 | 管理成員 | 刪除 Workspace |
|------|------|------|----------|----------------|
| owner | ✓ | ✓ | ✓ | ✓ |
| editor | ✓ | ✓ | ✗ | ✗ |
| viewer | ✓ | ✗ | ✗ | ✗ |

---

## 業務規則

- 建立 Workspace 時，建立者自動成為 `owner`
- 每個 Workspace 至少要有一個 `owner`
- 最後一個 Owner 不可降級或離開
- `joined_at = NULL` 表示邀請尚未接受
