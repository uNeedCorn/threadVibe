# user_subscriptions

## 說明

儲存使用者的訂閱方案資訊。預留給未來付費功能使用。

---

## Schema

```sql
CREATE TABLE user_subscriptions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan_type   TEXT NOT NULL DEFAULT 'free',
  limits      JSONB NOT NULL DEFAULT '{}',
  valid_until TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 欄位說明

| 欄位 | 類型 | Nullable | 說明 |
|------|------|----------|------|
| `id` | UUID | NO | 主鍵 |
| `user_id` | UUID | NO | 使用者 ID (FK, UNIQUE) |
| `plan_type` | TEXT | NO | 方案類型 |
| `limits` | JSONB | NO | 額度限制 |
| `valid_until` | TIMESTAMPTZ | YES | 方案有效期限 |
| `created_at` | TIMESTAMPTZ | NO | 建立時間 |
| `updated_at` | TIMESTAMPTZ | NO | 更新時間 |

---

## 索引

```sql
CREATE UNIQUE INDEX idx_subscriptions_user ON user_subscriptions(user_id);
```

---

## 關聯

| 關聯表 | 關係 | 說明 |
|--------|------|------|
| `auth.users` | 1:1 | 使用者 |

---

## 方案類型

| 類型 | 說明 |
|------|------|
| `free` | 免費版 |
| `pro` | 專業版（預留） |
| `enterprise` | 企業版（預留） |

---

## Limits JSON 結構

```json
{
  "max_workspaces": 3,
  "max_accounts_per_workspace": 2,
  "max_members_per_workspace": 5,
  "sync_interval_minutes": 15,
  "data_retention_days": 90
}
```

---

## 預設額度

### Free Plan

```json
{
  "max_workspaces": 1,
  "max_accounts_per_workspace": 1,
  "max_members_per_workspace": 1,
  "sync_interval_minutes": 60,
  "data_retention_days": 30
}
```

---

## 額度檢查 API

```typescript
// GET /quota-check
async function checkQuota(userId: string) {
  const subscription = await getSubscription(userId);
  const currentUsage = await getCurrentUsage(userId);

  return {
    limits: subscription.limits,
    usage: currentUsage,
    canCreate: currentUsage < subscription.limits
  };
}
```

---

## 業務規則

- 首次登入時自動建立 `free` 方案記錄
- 每個使用者只有一筆訂閱記錄
- 升級/降級時更新 `plan_type` 和 `limits`
