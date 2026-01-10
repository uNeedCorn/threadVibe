# Threads 帳號管理

## 概述

管理 Workspace 中綁定的 Threads 帳號：連結、狀態查看、解除連結。

---

## 操作清單

| 操作 | 權限 | 說明 |
|------|------|------|
| 連結帳號 | Owner/Editor | OAuth 授權 |
| 查看狀態 | 成員 | Token 有效性 |
| 重新授權 | Owner/Editor | Token 失效時 |
| 解除連結 | Owner | 移除帳號 |

---

## 連結帳號

參見 [threads-oauth.md](../auth/threads-oauth.md)

---

## 查看帳號狀態

### Edge Function（建議）

使用 Edge Function 封裝 token 狀態查詢，避免 client 直接讀取 `workspace_threads_tokens`（包含密文欄位）。

```
GET /functions/v1/threads-account-status?account_id=xxx
Headers: Authorization: Bearer <user_jwt>
```

回傳：

```ts
type TokenStatus = 'valid' | 'expired' | 'no_token';

interface AccountStatus {
  id: string;
  username: string;
  profile_pic_url: string | null;
  is_active: boolean;
  token_status: TokenStatus;
  expires_at: string | null;
}
```

實作位置：`supabase/functions/threads-account-status/index.ts`

---

### （舊）直接查表（不建議）

> 已鎖定 `workspace_threads_tokens` 的 client 存取（`REVOKE ALL`），此作法將無法取得 token 狀態；請改用 `threads-account-status`。

### 回傳格式

```typescript
interface AccountStatus {
  id: string;
  username: string;
  profile_pic_url: string;
  is_active: boolean;
  token_status: 'valid' | 'expired' | 'no_token';
  expires_at: string | null;
}
```

---

## 列出 Workspace 所有帳號

> 若需要同時列出帳號與 token 狀態，請逐一呼叫 `threads-account-status`（或之後新增批次版 Edge Function）。

---

## 重新授權

Token 失效時，需重新進行 OAuth 流程：

```typescript
async function reauthorizeAccount(workspaceId: string, accountId: string) {
  // 導向 OAuth 流程，帶入 workspace_id
  const oauthUrl = `/api/threads-oauth?workspace_id=${workspaceId}&account_id=${accountId}`;
  window.location.href = oauthUrl;
}
```

OAuth callback 會：
1. 取得新 Token
2. 將舊 Token 設為 non-primary
3. 建立新 Token 並設為 primary

---

## 解除連結

### Edge Function（建議）

```
POST /functions/v1/threads-account-unlink
Headers: Authorization: Bearer <user_jwt>
Body: { "account_id": "uuid" }
```

- 權限：僅 Workspace `owner`
- 行為：revoke 該帳號所有未撤銷 token，並將帳號設為 `is_active=false`

實作位置：`supabase/functions/threads-account-unlink/index.ts`

---

### （舊）直接查表（不建議）

> 已透過 migration 鎖定 `workspace_threads_tokens` 的 client 存取（`REVOKE ALL`），此作法會被拒絕；請改用 `threads-account-unlink`。

---

## 啟用/停用同步

```typescript
async function toggleAccountSync(accountId: string, isActive: boolean) {
  await supabase
    .from('workspace_threads_accounts')
    .update({
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', accountId);
}
```
