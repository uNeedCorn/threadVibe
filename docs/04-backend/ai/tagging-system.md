# AI 標籤系統

## 概述

ThreadsVibe 標籤系統提供兩種標籤類型，幫助用戶對貼文進行分類與分析：

| 類型 | 說明 | 來源 | 付費 |
|------|------|------|------|
| **用戶自定義標籤** | 用戶自行建立的分類標籤 | 手動建立 | 免費 |
| **AI 建議標籤** | LLM 分析貼文內容的多維度標籤 | Gemini 2 Flash | 付費功能 |

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

### 回傳規格

| 項目 | 規格 |
|------|------|
| 每維度回傳數 | 前 3 個高信心度標籤 |
| 信心度顯示 | ✅ 顯示（0-100%） |
| 排序 | 依信心度降序 |

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

#### AI 建議標籤（每維度前 3 個）

```jsonc
// workspace_threads_posts.ai_suggested_tags
{
  "content_type": [
    { "tag": "教學分享", "confidence": 0.92 },
    { "tag": "產品推廣", "confidence": 0.65 },
    { "tag": "知識傳遞", "confidence": 0.58 }
  ],
  "tone": [
    { "tag": "專業正式", "confidence": 0.88 },
    { "tag": "中立客觀", "confidence": 0.72 },
    { "tag": "輕鬆幽默", "confidence": 0.42 }
  ],
  "intent": [
    { "tag": "知識傳遞", "confidence": 0.85 },
    { "tag": "品牌建立", "confidence": 0.72 },
    { "tag": "引發討論", "confidence": 0.61 }
  ],
  "emotion": [
    { "tag": "正向積極", "confidence": 0.78 },
    { "tag": "中性平和", "confidence": 0.65 },
    { "tag": "感性溫暖", "confidence": 0.45 }
  ],
  "audience": [
    { "tag": "新手入門", "confidence": 0.81 },
    { "tag": "一般大眾", "confidence": 0.73 },
    { "tag": "進階玩家", "confidence": 0.52 }
  ]
}
```

#### 用戶選定的 AI 標籤（用於成效分析）

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

## Job Queue 架構

AI Tagging 採用獨立 Job Queue 模式，與貼文同步解耦：

```
┌─────────────────┐      ┌──────────────────┐      ┌─────────────────┐
│   sync-posts    │ ──▶  │   ai_tag_queue   │ ──▶  │  ai-tagging     │
│   (每15分鐘)    │ 入隊  │   (資料表)        │ 處理  │  (Edge Func)    │
└─────────────────┘      └──────────────────┘      └─────────────────┘
```

### 流程說明

1. **sync-posts 完成後**：檢查 `ai_suggested_tags IS NULL` 的貼文
2. **入隊**：將需要 tagging 的貼文寫入 `ai_tag_queue`（pending 狀態）
3. **處理**：`ai-tagging` Job 每分鐘輪詢 queue，處理 pending 任務
4. **完成**：更新貼文的 `ai_suggested_tags`，標記 job 為 completed

### 入隊條件

| 條件 | 說明 |
|------|------|
| `ai_suggested_tags IS NULL` | 尚未進行 AI 分析的貼文 |
| 付費用戶 | 僅付費方案才入隊執行 |

### Queue 狀態

| 狀態 | 說明 |
|------|------|
| `pending` | 等待處理 |
| `processing` | 處理中 |
| `completed` | 完成 |
| `failed` | 失敗（可重試） |

### 重試機制

| 項目 | 規格 |
|------|------|
| 最大重試次數 | 3 次 |
| 重試條件 | `status = 'failed' AND attempts < max_attempts` |

---

## 付費機制

### 方案設計

| 用戶類型 | AI Tagging 行為 |
|----------|-----------------|
| **付費用戶** | 正常執行 AI tagging，完整顯示所有維度和信心度 |
| **免費用戶** | 不執行 AI tagging；UI 顯示鎖定狀態 + 升級按鈕 |

### 檢查時機

```typescript
// 在 sync-posts 入隊前檢查
const subscription = await getSubscription(workspaceId);

if (subscription.features.includes('ai_tagging')) {
  await enqueueForTagging(posts);
}
// 免費用戶：不入隊，不執行
```

### UI 顯示

| 用戶類型 | UI 呈現 |
|----------|---------|
| 付費用戶 | 正常顯示 AI 標籤區塊 |
| 免費用戶 | 顯示鎖定狀態（模糊 + 升級按鈕） |

---

## 資料表

### ai_tag_queue

Job Queue 表，詳見：[ai-tag-queue.md](../../03-database/tables/ai-tag-queue.md)

### workspace_threads_posts 欄位

| 欄位 | 類型 | 說明 |
|------|------|------|
| `ai_suggested_tags` | JSONB | AI 建議標籤（含信心度），永久保留 |
| `ai_selected_tags` | JSONB | 用戶選定的標籤，用於成效分析 |

---

## LLM 使用記錄

每次 AI 分析都記錄使用量，用於成本追蹤：

| 欄位 | 說明 |
|------|------|
| workspace_id | 所屬工作區 |
| workspace_threads_account_id | 所屬帳號 |
| model_name | 模型名稱（gemini-2.0-flash） |
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
| 依 AI 標籤（已選定） | `ai_selected_tags` JSONB 查詢 |
| 依維度統計 | 依 dimension key 聚合 |

### 統計範例

```sql
-- 依內容類型統計平均互動率
SELECT
  tag->>'tag' as content_type,
  AVG(engagement_rate) as avg_er
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
- [ai-tag-queue](../../03-database/tables/ai-tag-queue.md)
- [llm-usage-logs](../../03-database/tables/llm-usage-logs.md)
