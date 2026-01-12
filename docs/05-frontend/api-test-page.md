# API 測試頁面

## 概述

API 測試頁面提供開發者測試 Meta/Threads API 的工具，使用當前帳號的 Token 直接呼叫 API 並顯示原始回應。

**路由**：`/api-test`

---

## 功能

### 可用端點

| 端點 ID | 名稱 | API Path | 說明 |
|---------|------|----------|------|
| `me` | 個人資料 | `/me` | 帳號基本資訊 |
| `me_insights` | 帳號 Insights | `/me/threads_insights` | views, followers_count |
| `me_threads` | 貼文列表 | `/me/threads` | 最近 10 則貼文 |
| `post_insights` | 貼文 Insights | `/{post_id}/insights` | 指定貼文成效（需輸入 Post ID） |

---

## 使用流程

```
1. 選擇 Threads 帳號（左側選單）
2. 選擇要測試的 API 端點
3. 若為 post_insights，輸入 Post ID
4. 點擊「執行測試」
5. 查看原始 JSON 回應
```

---

## 元件結構

```
/api-test/page.tsx
├── API 設定 Card
│   ├── API 端點 Select
│   ├── Post ID Input (when required)
│   └── 執行測試 Button
├── 錯誤提示 Alert
└── API 回應 Card
    ├── Request URL
    └── Response JSON (可複製)
```

---

## Edge Function

**路徑**：`supabase/functions/api-test/index.ts`

### 請求格式

```json
POST /functions/v1/api-test
{
  "account_id": "uuid",
  "endpoint": "me | me_insights | me_threads | post_insights",
  "post_id": "string (optional, required for post_insights)"
}
```

### 回應格式

```json
{
  "endpoint": {
    "id": "me_insights",
    "name": "帳號 Insights",
    "url": "https://graph.threads.net/v1.0/me/threads_insights?..."
  },
  "status": 200,
  "statusText": "OK",
  "duration_ms": 234,
  "response": { ... }  // Threads API 原始回應
}
```

---

## 安全性

- 需要登入並選擇帳號
- 驗證 Workspace 成員權限
- Token 不會顯示在前端（URL 中顯示 `[REDACTED]`）
- 僅限測試用途，不會寫入任何資料

---

## 檔案位置

| 檔案 | 說明 |
|------|------|
| `frontend/app/(auth)/api-test/page.tsx` | 測試頁面 |
| `supabase/functions/api-test/index.ts` | Edge Function |

---

## 相關文件

- [sync-account-insights.md](../04-backend/sync/sync-account-insights.md) - 帳號 Insights 同步
- [threads-oauth.md](../04-backend/auth/threads-oauth.md) - Threads OAuth 流程
