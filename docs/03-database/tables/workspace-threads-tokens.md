# workspace_threads_tokens

## 說明

儲存 Threads OAuth Token。支援同一帳號多個 Token（用於移轉）及刷新追蹤。

> 此表包含 token 密文欄位，已鎖定禁止 client 直接存取；所有操作皆透過 Edge Functions（service_role）封裝。

---

## Schema

```sql
CREATE TABLE workspace_threads_tokens (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_account_id  UUID NOT NULL REFERENCES workspace_threads_accounts(id) ON DELETE CASCADE,
  authorized_by_user_id         UUID NOT NULL REFERENCES auth.users(id),
  access_token_encrypted        TEXT NOT NULL,
  refresh_token_encrypted       TEXT,
  expires_at                    TIMESTAMPTZ NOT NULL,
  is_primary                    BOOLEAN NOT NULL DEFAULT TRUE,
  transfer_reminder_sent_at     TIMESTAMPTZ,
  auto_revoke_at                TIMESTAMPTZ,
  revoked_at                    TIMESTAMPTZ,
  -- Token 刷新追蹤欄位
  refreshed_at                  TIMESTAMPTZ,
  refresh_error                 TEXT,
  refresh_error_at              TIMESTAMPTZ,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 欄位說明

| 欄位 | 類型 | Nullable | 說明 |
|------|------|----------|------|
| `id` | UUID | NO | 主鍵 |
| `workspace_threads_account_id` | UUID | NO | 所屬帳號 (FK) |
| `authorized_by_user_id` | UUID | NO | 授權者 (FK → auth.users) |
| `access_token_encrypted` | TEXT | NO | 加密的 Access Token |
| `refresh_token_encrypted` | TEXT | YES | 加密的 Refresh Token |
| `expires_at` | TIMESTAMPTZ | NO | Token 過期時間 |
| `is_primary` | BOOLEAN | NO | 是否為主要使用的 Token |
| `transfer_reminder_sent_at` | TIMESTAMPTZ | YES | 移轉提醒發送時間 |
| `auto_revoke_at` | TIMESTAMPTZ | YES | 自動撤銷時間 |
| `revoked_at` | TIMESTAMPTZ | YES | 撤銷時間 |
| `refreshed_at` | TIMESTAMPTZ | YES | 上次成功刷新時間 |
| `refresh_error` | TEXT | YES | 刷新失敗錯誤訊息 |
| `refresh_error_at` | TIMESTAMPTZ | YES | 刷新失敗時間 |
| `created_at` | TIMESTAMPTZ | NO | 建立時間 |

---

## 索引

```sql
CREATE INDEX idx_tokens_account ON workspace_threads_tokens(workspace_threads_account_id);
CREATE INDEX idx_tokens_authorized_by ON workspace_threads_tokens(authorized_by_user_id);
CREATE INDEX idx_tokens_expires ON workspace_threads_tokens(expires_at) WHERE revoked_at IS NULL;
```

---

## 關聯

| 關聯表 | 關係 | 說明 |
|--------|------|------|
| `workspace_threads_accounts` | n:1 | 所屬帳號 |
| `auth.users` | n:1 | 授權者 |

---

## Token 加密

使用 AES-GCM 256-bit 加密（在 Edge Functions 中處理）：

```typescript
// 加密（在 Edge Functions 中）
const encryptedToken = await encrypt(accessToken);

// 解密
const accessToken = await decrypt(encryptedToken);
```

---

## Token 刷新追蹤

### 欄位用途

| 欄位 | 設定時機 | 說明 |
|------|----------|------|
| `refreshed_at` | 刷新成功時 | 記錄上次成功刷新的時間 |
| `refresh_error` | 刷新失敗時 | 記錄錯誤訊息 |
| `refresh_error_at` | 刷新失敗時 | 記錄失敗時間 |

### 相關 Edge Functions

| Function | 說明 |
|----------|------|
| `token-refresh` | 每日刷新即將過期的 Token |
| `token-auto-revoke` | 撤銷已無法刷新的 Token |

---

## 業務規則

### 多 Token 支援

- 同一帳號可有多個 Token（移轉期間）
- 只有一個可標記為 `is_primary = TRUE`
- 同步時使用 `is_primary = TRUE` 的 Token

### Token 移轉流程

1. 新授權者完成 OAuth → 建立新 Token（`is_primary = TRUE`）
2. 舊 Token 設為 `is_primary = FALSE`
3. 舊 Token 可選擇保留或立即 revoke

### 自動撤銷

- 成員離開時設定 `auto_revoke_at = NOW() + 7 days`
- `token-auto-revoke` 檢查 `auto_revoke_at < NOW()` 並設定 `revoked_at`

### Token 刷新

- `token-refresh` 每日執行，刷新 7 天內到期的 Token
- 刷新成功：更新 `access_token_encrypted`、`expires_at`、`refreshed_at`
- 刷新失敗：記錄 `refresh_error`、`refresh_error_at`
