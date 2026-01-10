# Telegram 通知指南

本文件說明如何設定 Telegram 通知，讓 Claude 在任務完成或需要互動時發送訊息。

## 前置需求

1. MCP 伺服器已設定 `telegram-notify`
2. Telegram Bot Token 已設定
3. Chat ID 已設定

---

## 使用方式

使用 `mcp__telegram-notify__send_telegram_message` 工具發送通知：

```javascript
mcp__telegram-notify__send_telegram_message({
  message: "任務完成：已完成 Dashboard 重構"
})
```

---

## 必須通知的時機

### 1. 任務完成

```
✅ 任務完成：[任務名稱]

主要變更：
- 新增 StatsCard 元件
- 重構 DashboardPage
- 更新相關文件

測試結果：通過
```

### 2. 需要使用者輸入

```
⏸️ 需要確認：[問題描述]

發現以下問題需要決策：
1. 要使用方案 A 還是方案 B？
2. 這個欄位需要驗證嗎？

請回覆後繼續執行。
```

### 3. 發生錯誤

```
❌ 執行錯誤：[錯誤類型]

錯誤訊息：[具體訊息]
發生位置：[檔案:行號]

建議處理方式：
- [建議 1]
- [建議 2]
```

### 4. 使用者明確要求

當使用者說「通知我」、「完成後告訴我」時：

```
📬 通知：[使用者請求的主題]

[回覆內容]
```

### 5. 長時間任務完成

執行超過 5 分鐘的任務完成時：

```
⏱️ 長時間任務完成：[任務名稱]

執行時間：約 X 分鐘
結果：成功/失敗

詳情：
- [變更摘要]
```

---

## 訊息格式

### 標題圖示

| 圖示 | 意義 |
|------|------|
| ✅ | 成功/完成 |
| ❌ | 錯誤/失敗 |
| ⏸️ | 需要輸入/暫停 |
| ⏱️ | 長時間任務 |
| 📬 | 一般通知 |
| ⚠️ | 警告 |

### 訊息結構

```
[圖示] [類型]：[標題]

[主要內容]

[額外資訊（如有）]
```

### 長度建議

- 標題：< 50 字
- 主要內容：< 200 字
- 清單項目：< 10 項

---

## 範例

### 深夜任務完成

```
✅ 深夜任務完成：重構 DashboardPage

已完成的變更：
- 將 DashboardPage 從 500 行拆分為多個元件
- 新增 useInsightsQuery hook
- 更新單元測試

測試結果：通過
Lint 檢查：0 errors, 0 warnings
```

### 需要設計決策

```
⏸️ 需要設計決策

在實作「數據匯出」功能時，發現以下選項：

1. CSV 格式（簡單，相容性高）
2. JSON 格式（保留完整結構）
3. 兩者都支援

請選擇偏好的方案。
```

### 編譯錯誤

```
❌ 編譯錯誤

錯誤：Cannot find module '@/hooks/useAuth'
位置：src/features/dashboard/pages/DashboardPage.tsx:5

可能原因：
- 路徑別名未正確設定
- 模組尚未建立

建議檢查 tsconfig.json 的 paths 設定。
```

---

## 不需要通知的情況

- 簡單的程式碼修改
- 使用者正在互動中
- 執行時間 < 1 分鐘的任務
- 中間步驟的進度更新

---

## 設定方式

### 1. 建立 Telegram Bot

1. 在 Telegram 搜尋 `@BotFather`
2. 發送 `/newbot` 建立新 Bot
3. 記錄 Bot Token

### 2. 取得 Chat ID

1. 發送訊息給你的 Bot
2. 訪問 `https://api.telegram.org/bot<TOKEN>/getUpdates`
3. 找到 `chat.id` 值

### 3. 設定 MCP

在 Claude Code 設定中加入 telegram-notify MCP 伺服器：

```json
{
  "mcpServers": {
    "telegram-notify": {
      "command": "npx",
      "args": ["telegram-notify-mcp"],
      "env": {
        "TELEGRAM_BOT_TOKEN": "your-bot-token",
        "TELEGRAM_CHAT_ID": "your-chat-id"
      }
    }
  }
}
```
