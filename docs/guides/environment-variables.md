# 環境變數設定

## 概述

本文件列出所有 Edge Functions 需要的環境變數及其設定方式。

---

## Supabase Secrets

使用 `supabase secrets set` 設定以下環境變數：

### 必要設定

| 變數名稱 | 說明 | 範例 |
|----------|------|------|
| `THREADS_APP_ID` | Threads App ID | `123456789` |
| `THREADS_APP_SECRET` | Threads App Secret | `abcdef123456...` |
| `ENCRYPTION_SECRET` | Token 加密密鑰（高熵字串；建議 ≥32 bytes） | `openssl rand -hex 32` 的輸出 |
| `OAUTH_STATE_SECRET` | OAuth State HMAC 簽章密鑰（高熵字串；建議 ≥32 bytes） | `openssl rand -hex 32` 的輸出 |
| `FRONTEND_URL` | 前端應用 URL | `https://app.threadsvibe.com` |
| `CRON_SECRET` | 排程任務驗證金鑰 | 任意安全字串 |

### 建議設定（安全性/行為調整）

| 變數名稱 | 說明 | 範例 |
|----------|------|------|
| `ALLOWED_ORIGINS` | CORS 白名單（逗號分隔 origin） | `https://app.threadsvibe.com,https://staging.threadsvibe.com` |
| `THREADS_USE_AUTH_HEADER` | Threads API 是否使用 `Authorization: Bearer`（不支援時請維持 `false`） | `false` |
| `EXPOSE_ERROR_DETAILS` | 是否對外回傳 500 詳細錯誤（僅限本地開發） | `true` |

### 自動提供的變數

以下變數由 Supabase 自動提供，無需手動設定：

| 變數名稱 | 說明 |
|----------|------|
| `SUPABASE_URL` | Supabase 專案 URL |
| `SUPABASE_ANON_KEY` | Supabase 匿名 Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key |

---

## 設定指令

```bash
# Threads OAuth
supabase secrets set THREADS_APP_ID=your_app_id
supabase secrets set THREADS_APP_SECRET=your_app_secret

# Token 加密（產生高熵密鑰）
supabase secrets set ENCRYPTION_SECRET="$(openssl rand -hex 32)"

# OAuth State 簽章（產生高熵密鑰）
supabase secrets set OAUTH_STATE_SECRET="$(openssl rand -hex 32)"

# 前端 URL
supabase secrets set FRONTEND_URL=https://your-frontend-url.com

# 排程任務驗證
supabase secrets set CRON_SECRET=your_secure_random_string
```

---

## 產生加密金鑰

### Node.js

```javascript
const crypto = require('crypto');
const key = crypto.randomBytes(32).toString('hex');
console.log(key); // 64 字元 hex 字串（可用）
```

### 命令列

```bash
# macOS / Linux
openssl rand -hex 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 驗證設定

```bash
# 列出已設定的 Secrets
supabase secrets list

# 預期輸出
# CRON_SECRET
# ENCRYPTION_SECRET
# FRONTEND_URL
# OAUTH_STATE_SECRET
# THREADS_APP_ID
# THREADS_APP_SECRET
```

---

## Edge Functions 使用方式

```typescript
// 讀取環境變數
const THREADS_APP_ID = Deno.env.get('THREADS_APP_ID');
const ENCRYPTION_SECRET = Deno.env.get('ENCRYPTION_SECRET');
const OAUTH_STATE_SECRET = Deno.env.get('OAUTH_STATE_SECRET');

// 確認變數存在
if (!THREADS_APP_ID) {
  throw new Error('THREADS_APP_ID not configured');
}
```

---

## 各 Edge Function 使用的變數

| Function | 使用的環境變數 |
|----------|----------------|
| `threads-oauth` | `THREADS_APP_ID`, `OAUTH_STATE_SECRET`, `SUPABASE_URL` |
| `threads-oauth-callback` | `THREADS_APP_ID`, `THREADS_APP_SECRET`, `OAUTH_STATE_SECRET`, `ENCRYPTION_SECRET`, `FRONTEND_URL` |
| `scheduled-sync` | `CRON_SECRET`, `ENCRYPTION_SECRET` |
| `token-refresh` | `CRON_SECRET`, `ENCRYPTION_SECRET` |
| `token-auto-revoke` | `CRON_SECRET` |
| `workspace-cleanup` | `CRON_SECRET` |
| `quota-check` | 無（使用 JWT 驗證） |
| `threads-account-status` | 無（使用 JWT 驗證） |
| `threads-account-unlink` | 無（使用 JWT 驗證） |
| `token-transfer-initiate` | 無（使用 JWT 驗證） |
| `workspace-member-remove` | 無（使用 JWT 驗證） |
