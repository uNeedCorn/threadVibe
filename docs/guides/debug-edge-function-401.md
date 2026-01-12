# Edge Function 401 Unauthorized 除錯指引

> **適用情境**：Supabase Edge Function 回傳 401 Unauthorized 錯誤
> **最後更新**：2026-01-12

---

## 背景

Supabase Edge Functions 有兩層 JWT 驗證機制：

1. **Infrastructure 層**：Supabase 基礎設施會在請求到達函式前驗證 JWT
2. **Application 層**：我們自己程式碼中的 `getAuthenticatedUser()` 驗證

如果沒有使用 `--no-verify-jwt` 部署，請求會在 Infrastructure 層被攔截。

---

## 錯誤訊息範例

### Console 錯誤

```
POST https://xxx.supabase.co/functions/v1/insights-radar 401 (Unauthorized)
[Radar] Function error: FunctionsHttpError: Edge Function returned a non-2xx status code
```

### 兩種 401 的差異

| 來源 | 回傳格式 | 說明 |
|------|----------|------|
| **Supabase Infrastructure** | `{"code":401,"message":"Invalid JWT"}` | 未使用 `--no-verify-jwt` 部署 |
| **我們的程式碼** | `{"error":"Missing authorization header","code":"UNAUTHORIZED"}` | 前端未傳送或傳送無效 token |

---

## 除錯流程

### Step 1：確認錯誤來源

使用 curl 直接測試函式（不帶 Authorization header）：

```bash
curl -s -X POST 'https://<project-ref>.supabase.co/functions/v1/<function-name>' \
  -H 'Content-Type: application/json' \
  -d '{"account_id":"test"}'
```

**判讀結果**：

| 回傳訊息 | 問題來源 | 解法 |
|----------|----------|------|
| `"message":"Invalid JWT"` | Supabase Infrastructure | 需使用 `--no-verify-jwt` 重新部署 |
| `"error":"Missing authorization header"` | 我們的程式碼 | 函式正常，問題在前端 |

---

### Step 2：檢查部署狀態

```bash
# 列出函式最後部署時間
supabase functions list --project-ref <project-ref> | grep <function-name>

# 比對本地與部署版本
supabase functions download <function-name> --project-ref <project-ref>
diff supabase/functions/<function-name>/index.ts supabase/functions/<function-name>/index.ts.backup
```

**常見問題**：
- 本地程式碼已修改但未部署
- 部署時忘記加 `--no-verify-jwt`

---

### Step 3：檢查前端請求

在 Browser DevTools → Network 找到該請求：

1. **確認 Request Headers**：
   - 是否有 `Authorization: Bearer <token>`？
   - Token 是否看起來正常（以 `eyJ` 開頭的 JWT）？

2. **確認 Response Body**：
   - 錯誤訊息格式是 Infrastructure 還是 Application 層？

---

### Step 4：驗證 Token 有效性

```bash
# 解碼 JWT（不驗證簽章，只看 payload）
echo '<jwt-token>' | cut -d. -f2 | base64 -d 2>/dev/null | jq .

# 檢查 exp（過期時間）
# exp 是 Unix timestamp，可用 date -r <timestamp> 轉換
```

**常見問題**：
- Token 已過期（`exp` 小於當前時間）
- Token 格式錯誤
- 使用了錯誤類型的 key（publishable key vs anon key）

---

### Step 5：確認 Session 狀態

在前端 Console 執行：

```javascript
const { data: { session } } = await supabase.auth.getSession();
console.log('Session:', session);
console.log('Access Token:', session?.access_token);
console.log('Expires At:', new Date(session?.expires_at * 1000));
```

**常見問題**：
- Session 為 null（用戶未登入）
- Session 已過期

---

## 解決方案

### 情境 A：Supabase Infrastructure 驗證失敗

```bash
# 使用 --no-verify-jwt 重新部署
supabase functions deploy <function-name> --no-verify-jwt --project-ref <project-ref>
```

### 情境 B：程式碼修改未部署

```bash
# 重新部署（記得加 --no-verify-jwt）
supabase functions deploy <function-name> --no-verify-jwt --project-ref <project-ref>
```

### 情境 C：前端 Token 問題

```typescript
// 確保 supabase client 正確初始化
const supabase = createClient();

// 呼叫函式時會自動帶入 Authorization header
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { ... }
});
```

### 情境 D：Session 過期

```typescript
// 重新整理 session
const { data, error } = await supabase.auth.refreshSession();

// 或要求用戶重新登入
await supabase.auth.signOut();
// redirect to login page
```

---

## 快速檢查清單

- [ ] 函式是否使用 `--no-verify-jwt` 部署？
- [ ] 本地程式碼是否與部署版本一致？
- [ ] 前端請求是否有 Authorization header？
- [ ] JWT token 是否有效（未過期）？
- [ ] 用戶 session 是否正常？

---

## 相關文件

- [Supabase Edge Functions 認證](https://supabase.com/docs/guides/functions/auth)
- [專案 Edge Functions 列表](../04-backend/functions/)
