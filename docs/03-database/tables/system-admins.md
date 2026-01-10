# system_admins

## 概述

系統管理員資料表，記錄具有系統層級管理權限的使用者。

---

## Schema

```sql
CREATE TABLE system_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 欄位說明

| 欄位 | 類型 | 說明 |
|------|------|------|
| `user_id` | UUID (PK) | 使用者 ID，連結 auth.users |
| `granted_at` | TIMESTAMPTZ | 授權時間 |

---

## RLS Policies

| Policy 名稱 | 操作 | 規則 |
|-------------|------|------|
| `admins_select` | SELECT | 只能查看自己是否為管理員 |

---

## 使用場景

### 1. 驗證管理員身份

```typescript
// _shared/auth.ts
export async function isSystemAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from('system_admins')
    .select('user_id')
    .eq('user_id', userId)
    .single();

  return !!data;
}
```

### 2. 管理員專屬操作

- 檢視所有 Workspace
- 系統設定調整
- 使用者管理

---

## 安全考量

- 此表只能透過資料庫直接操作或 service_role 新增
- 一般使用者無法自行新增管理員權限
- RLS 限制只能查看自己的管理員狀態
