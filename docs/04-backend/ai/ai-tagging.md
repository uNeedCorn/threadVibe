# ai-tagging Edge Function

## 概述

處理 AI 標籤分析任務的 Edge Function，從 `ai_tag_queue` 取得待處理任務，呼叫 Gemini API 分析貼文內容。

- **觸發方式**：pg_cron 每分鐘執行
- **驗證**：CRON_SECRET
- **批次大小**：每次處理 10 筆

---

## 端點

```
POST /ai-tagging
Headers: Authorization: Bearer <CRON_SECRET>
```

---

## 執行流程

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ai-tagging                                   │
├─────────────────────────────────────────────────────────────────────┤
│  1. 驗證 CRON_SECRET                                                │
│  2. 從 ai_tag_queue 取得 pending 或可重試的 failed 任務（最多 10 筆）│
│  3. 逐筆處理：                                                       │
│     a. 標記為 processing                                            │
│     b. 取得貼文內容                                                  │
│     c. 呼叫 Gemini API 分析                                         │
│     d. 更新貼文的 ai_suggested_tags                                 │
│     e. 記錄 LLM 使用量                                              │
│     f. 標記為 completed                                             │
│  4. 回傳處理結果統計                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 環境變數

| 變數 | 說明 | 必填 |
|------|------|------|
| `CRON_SECRET` | 排程驗證密鑰 | ✅ |
| `GEMINI_API_KEY` | Gemini API 金鑰 | ✅ |

---

## 回應格式

### 成功

```json
{
  "message": "Processing complete",
  "processed": 8,
  "failed": 2,
  "total": 10
}
```

### 無任務

```json
{
  "message": "No jobs to process",
  "processed": 0
}
```

---

## Gemini API 整合

### 模型

- **模型**：`gemini-2.0-flash`
- **Temperature**：0.3（較低以獲得一致結果）
- **回應格式**：JSON

### Prompt 結構

```
你是一個內容分析專家，專門分析社群媒體貼文。請分析以下貼文內容，並從 5 個維度進行分類。

每個維度請回傳信心度最高的前 3 個標籤，信心度範圍為 0-1。

## 維度與選項
1. 內容類型 (content_type): 教學分享、日常隨筆、產品推廣...
2. 語氣風格 (tone): 專業正式、輕鬆幽默...
3. 互動意圖 (intent): 引發討論、知識傳遞...
4. 情緒色彩 (emotion): 正向積極、中性平和...
5. 目標受眾 (audience): 新手入門、進階玩家...

## 回傳格式
{
  "content_type": [{"tag": "...", "confidence": 0.95}, ...],
  ...
}

## 貼文內容
[貼文文字]
```

---

## 錯誤處理

| 情況 | 處理方式 |
|------|----------|
| 貼文無文字 | 設定空標籤 `{}`，標記完成 |
| Gemini API 錯誤 | 標記 failed，記錄錯誤訊息 |
| 超過重試次數 | 保持 failed 狀態，不再處理 |

---

## 重試機制

| 項目 | 規格 |
|------|------|
| 最大重試次數 | 3 次 |
| 重試條件 | `status = 'failed' AND attempts < max_attempts` |
| 重試時機 | 下次 cron 執行時 |

---

## pg_cron 排程

```sql
-- 每分鐘執行
SELECT cron.schedule(
  'ai-tagging',
  '* * * * *',
  $$SELECT trigger_edge_function('ai-tagging')$$
);
```

---

## 相關檔案

| 檔案 | 說明 |
|------|------|
| `supabase/functions/ai-tagging/index.ts` | Edge Function 主程式 |
| `supabase/functions/_shared/gemini.ts` | Gemini API 客戶端 |

---

## 相關文件

- [tagging-system.md](tagging-system.md) - AI 標籤系統總覽
- [ai-tag-queue.md](../../03-database/tables/ai-tag-queue.md) - 任務佇列資料表
- [llm-usage-logs.md](../../03-database/tables/llm-usage-logs.md) - LLM 使用記錄
- [cron-setup.md](../jobs/cron-setup.md) - Cron 排程設定
