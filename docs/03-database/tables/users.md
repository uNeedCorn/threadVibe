# users (auth.users)

## 說明

使用者資料由 Supabase Auth 管理，儲存於 `auth.users` 表。此文件說明與 ThreadsVibe 相關的欄位使用方式。

---

## Schema (Supabase Auth 內建)

```sql
-- auth.users (由 Supabase 管理)
CREATE TABLE auth.users (
  id                  UUID PRIMARY KEY,
  email               TEXT UNIQUE,
  encrypted_password  TEXT,
  email_confirmed_at  TIMESTAMPTZ,
  raw_user_meta_data  JSONB,
  raw_app_meta_data   JSONB,
  created_at          TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ,
  -- ... 其他 Supabase Auth 欄位
);
```

---

## 使用的欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | UUID | 使用者 ID |
| `email` | TEXT | Email（來自 Google OAuth） |
| `raw_user_meta_data` | JSONB | Google Profile 資訊 |
| `created_at` | TIMESTAMPTZ | 註冊時間 |

---

## raw_user_meta_data 結構

Google OAuth 登入後會填入：

```json
{
  "name": "Ralph Chen",
  "email": "ralph@example.com",
  "avatar_url": "https://lh3.googleusercontent.com/...",
  "full_name": "Ralph Chen",
  "picture": "https://lh3.googleusercontent.com/...",
  "provider_id": "123456789",
  "email_verified": true
}
```

---

## 存取方式

### 取得當前使用者

```typescript
const { data: { user } } = await supabase.auth.getUser();
```

### 在 RLS 中使用

```sql
auth.uid() -- 當前使用者的 UUID
```

---

## 關聯

| 關聯表 | 關係 | 說明 |
|--------|------|------|
| `workspaces.created_by_user_id` | 1:n | 建立的 Workspace |
| `workspace_members.user_id` | 1:n | 加入的 Workspace |
| `workspace_threads_tokens.authorized_by_user_id` | 1:n | 授權的 Token |
| `user_subscriptions.user_id` | 1:1 | 訂閱方案 |

---

## 不另建 public.users 表

ThreadsVibe 不額外建立 `public.users` 表，原因：

1. Supabase Auth 已提供完整使用者管理
2. 避免資料重複與同步問題
3. Google Profile 資訊已存於 `raw_user_meta_data`

如需額外使用者設定，可考慮：
- 存入 `user_subscriptions.metadata`
- 或建立 `user_preferences` 表
