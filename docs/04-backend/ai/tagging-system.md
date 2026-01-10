# 標籤系統

## 概述

ThreadsVibe 標籤系統提供兩種標籤類型，幫助用戶對貼文進行分類與分析：

| 類型 | 說明 | 來源 |
|------|------|------|
| **用戶自定義標籤** | 用戶自行建立的核心分類標籤 | 手動建立 |
| **AI 建議標籤** | LLM 分析貼文內容後的建議標籤 | Gemini 2 Flash |

---

## 標籤層級

標籤為 **Account 層級**，每個 Threads 帳號擁有獨立的標籤集合：

```
Workspace
└── Threads Account A
│   ├── 用戶自定義標籤（獨立）
│   └── AI 建議標籤（獨立）
└── Threads Account B
    ├── 用戶自定義標籤（獨立）
    └── AI 建議標籤（獨立）
```

---

## 用戶自定義標籤

### 功能

| 功能 | 說明 |
|------|------|
| 建立標籤 | 用戶可自由建立標籤名稱與顏色 |
| 編輯標籤 | 修改標籤名稱與顏色 |
| 刪除標籤 | 刪除標籤（連帶移除貼文關聯） |
| 多標籤 | 每篇貼文可指定多個標籤 |

### 資料表

- [workspace_threads_account_tags](../../03-database/tables/workspace-threads-account-tags.md)
- [workspace_threads_post_tags](../../03-database/tables/workspace-threads-post-tags.md)

---

## AI 建議標籤

### 5 個維度

AI 標籤採用多維度分類，從 5 個面向分析貼文：

| # | 維度 | Key | 用途 | 標籤選項 |
|---|------|-----|------|----------|
| 1 | **內容類型** | `content_type` | 貼文形式分類 | 教學分享、日常隨筆、產品推廣、時事評論、問答互動、公告通知、個人故事、迷因娛樂 |
| 2 | **語氣風格** | `tone` | 表達方式 | 專業正式、輕鬆幽默、真誠感性、犀利直接、中立客觀 |
| 3 | **互動意圖** | `intent` | 貼文目的 | 引發討論、知識傳遞、導流轉換、品牌建立、社群互動、個人抒發 |
| 4 | **情緒色彩** | `emotion` | 傳達的情緒 | 正向積極、中性平和、感性溫暖、幽默諷刺、批判反思 |
| 5 | **目標受眾** | `audience` | 針對誰 | 新手入門、進階玩家、一般大眾、業界同行、忠實粉絲 |

### 維度分析價值

| 維度 | 可回答的問題 |
|------|--------------|
| 內容類型 | 什麼類型的內容互動率最高？ |
| 語氣風格 | 什麼風格最受歡迎？ |
| 互動意圖 | 什麼目的的貼文達成率高？ |
| 情緒色彩 | 什麼情緒的貼文表現好？ |
| 目標受眾 | 針對誰的內容表現好？ |

### 信心分數

每個 AI 建議標籤都附帶信心分數（0-1）：

| 分數區間 | 顏色 | 說明 |
|----------|------|------|
| ≥ 0.8 | 🟢 綠色 | 高信心，可信賴 |
| 0.6 - 0.79 | 🟡 黃色 | 中信心，供參考 |
| < 0.6 | ⚪ 灰色 | 低信心，謹慎採用 |

### 資料結構

#### AI 建議標籤（含分數）

```jsonc
// workspace_threads_posts.ai_suggested_tags
{
  "content_type": [
    { "tag": "教學分享", "confidence": 0.92 },
    { "tag": "產品推廣", "confidence": 0.35 }
  ],
  "tone": [
    { "tag": "專業正式", "confidence": 0.88 },
    { "tag": "輕鬆幽默", "confidence": 0.42 }
  ],
  "intent": [
    { "tag": "知識傳遞", "confidence": 0.85 },
    { "tag": "品牌建立", "confidence": 0.72 }
  ],
  "emotion": [
    { "tag": "正向積極", "confidence": 0.78 }
  ],
  "audience": [
    { "tag": "新手入門", "confidence": 0.81 }
  ]
}
```

#### 用戶選定的 AI 標籤（不含分數）

```jsonc
// workspace_threads_posts.ai_selected_tags
{
  "content_type": ["教學分享"],
  "tone": ["專業正式"],
  "intent": ["知識傳遞", "品牌建立"],
  "emotion": ["正向積極"],
  "audience": ["新手入門"]
}
```

---

## 流程

### 首次同步流程

```
┌─────────────────────────────────────────────────────────────┐
│  1. 用戶連結 Threads 帳號                                    │
│  2. 同步所有貼文                                             │
│  3. 逐篇執行 AI 分析（避免上下文污染）                         │
│     ├── 調用 Gemini 2 Flash                                 │
│     ├── 儲存 ai_suggested_tags 到貼文                        │
│     └── 記錄 LLM Usage Log                                  │
│  4. 前端顯示 AI 建議標籤（含信心分數顏色）                     │
│  5. 用戶選擇想要的標籤 → 存入 ai_selected_tags               │
└─────────────────────────────────────────────────────────────┘
```

### 定期同步流程

```
┌─────────────────────────────────────────────────────────────┐
│  1. Cron 觸發同步                                            │
│  2. 抓取新貼文                                               │
│  3. 篩選條件：ai_suggested_tags IS NULL                      │
│  4. 只對符合條件的貼文執行 AI 分析                            │
│  5. 記錄 LLM Usage Log                                       │
└─────────────────────────────────────────────────────────────┘
```

### 為何逐篇分析

| 原因 | 說明 |
|------|------|
| **避免污染** | 批次分析可能導致上下文混淆，影響分類準確度 |
| **可追蹤** | 每篇貼文獨立記錄 token 消耗 |
| **可重試** | 單篇失敗不影響其他貼文 |

---

## UI 顯示規則

### 未選定時（顯示 AI 建議）

```
┌─────────────────────────────────────────────────────────────┐
│  AI 建議標籤                                                 │
├─────────────────────────────────────────────────────────────┤
│  內容類型                                                    │
│  [🟢 教學分享 92%] [⚪ 產品推廣 35%]                          │
│                                                             │
│  語氣風格                                                    │
│  [🟢 專業正式 88%] [⚪ 輕鬆幽默 42%]                          │
│                                                             │
│  互動意圖                                                    │
│  [🟢 知識傳遞 85%] [🟡 品牌建立 72%]                          │
│                                                             │
│  情緒色彩                                                    │
│  [🟡 正向積極 78%]                                           │
│                                                             │
│  目標受眾                                                    │
│  [🟢 新手入門 81%]                                           │
└─────────────────────────────────────────────────────────────┘
```

### 選定後（不顯示分數）

```
┌─────────────────────────────────────────────────────────────┐
│  AI 標籤                                                     │
├─────────────────────────────────────────────────────────────┤
│  [教學分享] [專業正式] [知識傳遞] [品牌建立] [正向積極] [新手入門] │
└─────────────────────────────────────────────────────────────┘
```

---

## LLM 使用記錄

每次 AI 分析都記錄使用量，用於成本追蹤：

| 欄位 | 說明 |
|------|------|
| workspace_id | 所屬工作區 |
| workspace_threads_account_id | 所屬帳號 |
| model_name | 模型名稱（gemini-2-flash） |
| model_version | 模型版本 |
| input_tokens | 輸入 token 數 |
| output_tokens | 輸出 token 數 |
| total_tokens | 總 token 數 |
| purpose | 用途（post_tagging） |

詳見：[llm-usage-logs](../../03-database/tables/llm-usage-logs.md)

---

## 篩選與統計

### 篩選邏輯

| 篩選類型 | 資料來源 |
|----------|----------|
| 依用戶自定義標籤 | `workspace_threads_post_tags` JOIN |
| 依 AI 建議標籤（已選定） | `ai_selected_tags` JSONB 查詢 |
| 依維度統計 | 依 dimension key 聚合 |

### 統計範例

```sql
-- 依內容類型統計平均互動率
SELECT
  tag->>'tag' as content_type,
  AVG(current_engagement_rate) as avg_er
FROM workspace_threads_posts,
  jsonb_array_elements(ai_selected_tags->'content_type') as tag
WHERE workspace_threads_account_id = $1
GROUP BY tag->>'tag'
ORDER BY avg_er DESC;
```

---

## 相關資源

- [workspace_threads_account_tags](../../03-database/tables/workspace-threads-account-tags.md)
- [workspace_threads_post_tags](../../03-database/tables/workspace-threads-post-tags.md)
- [llm-usage-logs](../../03-database/tables/llm-usage-logs.md)
- [Insight 頁面 Q4](../../05-frontend/insight-page.md)（什麼內容表現最好？）
