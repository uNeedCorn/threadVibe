# API 設計原則

## 整體架構

### API 類型

| 類型 | 技術 | 用途 |
|------|------|------|
| 資料查詢 | Supabase Client (PostgREST) | CRUD 操作 |
| 業務邏輯 | Edge Functions | OAuth、同步、複雜操作 |
| 即時更新 | Realtime (optional) | 狀態推播 |

---

## Edge Functions 列表

### 認證相關

| Function | 方法 | 說明 |
|----------|------|------|
| `/threads-oauth` | GET | 導向 Threads OAuth 頁面 |
| `/threads-oauth-callback` | GET | 處理 OAuth callback |

### 同步相關

| Function | 方法 | 觸發方式 | 說明 |
|----------|------|----------|------|
| `/scheduled-sync` | POST | Cron（每 15 分鐘；每小時 00/15/30/45） | 主排程入口 |
| `/token-refresh` | POST | Cron (每日) | Token 刷新 |
| `/sync-posts` | POST | 內部呼叫 | 同步貼文 |
| `/sync-metrics` | POST | 內部呼叫 | 同步成效 |
| `/sync-account-insights` | POST | 內部呼叫 | 同步 Insights |

### API 端點

| Function | 方法 | 說明 |
|----------|------|------|
| `/workspace-invite` | POST | 發送邀請 |
| `/workspace-accept-invite` | POST | 接受邀請 |
| `/token-transfer` | POST | Token 移轉 |
| `/quota-check` | GET | 額度檢查 |

---

## 認證機制

### 呼叫來源分類

| 來源 | 認證方式 | 權限 |
|------|----------|------|
| Frontend | JWT (anon/authenticated) | RLS 限制 |
| Cron Job | service_role key | 完整權限 |
| Edge Function 間 | service_role key | 完整權限 |

### 認證流程

```typescript
// Edge Function 認證範例
const authHeader = req.headers.get('Authorization');

// 1. 檢查 service_role (Cron/內部呼叫)
if (isServiceRole(authHeader)) {
  return { role: 'service' };
}

// 2. 檢查 authenticated user (Frontend)
const { data: { user } } = await supabase.auth.getUser();
if (user) {
  return { role: 'authenticated', userId: user.id };
}

// 3. 拒絕
return new Response('Unauthorized', { status: 401 });
```

---

## 錯誤處理

### HTTP Status Code

| Code | 說明 |
|------|------|
| 200 | 成功 |
| 201 | 建立成功 |
| 400 | 請求錯誤（參數不正確） |
| 401 | 未認證 |
| 403 | 無權限 |
| 404 | 資源不存在 |
| 500 | 伺服器錯誤 |

### 錯誤回應格式

```json
{
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Token has expired"
  }
}
```

---

## 命名規範

### Edge Function 命名

```
<domain>-<action>

範例：
- threads-oauth
- sync-posts
- workspace-invite
```

### 資料表命名

```
<scope>_<entity>

範例：
- workspace_threads_accounts
- workspace_threads_posts
```

### 欄位命名

```
snake_case

範例：
- created_at
- threads_user_id
- is_primary
```

---

## 分頁設計

### 標準分頁參數

| 參數 | 類型 | 預設 | 說明 |
|------|------|------|------|
| page | number | 1 | 頁碼 |
| limit | number | 20 | 每頁筆數 |
| sort | string | created_at | 排序欄位 |
| order | string | desc | 排序方向 |

### 分頁回應格式

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "totalPages": 8
  }
}
```

---

## Rate Limiting

### Threads API 限制

| 端點 | 限制 | 備註 |
|------|------|------|
| /me/threads | 40 req/hr | 依 App 層級 |
| /insights | 200 req/hr | 依 User 層級 |

### 處理策略

1. 批次處理，避免過於頻繁呼叫
2. 失敗時記錄 log，下次 retry
3. 不通知用戶（只記錄）
