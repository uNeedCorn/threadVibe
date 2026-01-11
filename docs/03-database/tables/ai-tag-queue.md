# ai_tag_queue

## 概述

AI Tagging Job Queue 表，用於管理待處理的 AI 標籤分析任務。

- **用途**：追蹤需要進行 AI 分析的貼文
- **觸發**：sync-posts 完成後入隊
- **處理**：ai-tagging Edge Function 輪詢處理

---

## Schema

```sql
CREATE TABLE ai_tag_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_account_id UUID NOT NULL
    REFERENCES workspace_threads_accounts(id) ON DELETE CASCADE,
  post_id UUID NOT NULL
    REFERENCES workspace_threads_posts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  UNIQUE (post_id)
);

-- 索引
CREATE INDEX idx_ai_tag_queue_status
  ON ai_tag_queue(status, created_at);
CREATE INDEX idx_ai_tag_queue_account
  ON ai_tag_queue(workspace_threads_account_id);
```

---

## 欄位說明

| 欄位 | 類型 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| id | UUID | ✅ | gen_random_uuid() | 主鍵 |
| workspace_threads_account_id | UUID | ✅ | - | 所屬 Threads 帳號 |
| post_id | UUID | ✅ | - | 貼文 ID |
| status | TEXT | ✅ | 'pending' | 任務狀態 |
| attempts | INTEGER | ✅ | 0 | 已嘗試次數 |
| max_attempts | INTEGER | ✅ | 3 | 最大重試次數 |
| error_message | TEXT | ❌ | - | 失敗原因 |
| created_at | TIMESTAMPTZ | ✅ | now() | 入隊時間 |
| started_at | TIMESTAMPTZ | ❌ | - | 開始處理時間 |
| completed_at | TIMESTAMPTZ | ❌ | - | 完成時間 |

---

## 狀態流程

```
pending → processing → completed
              ↓
           failed (可重試)
              ↓
           failed (超過 max_attempts，不再處理)
```

| 狀態 | 說明 |
|------|------|
| `pending` | 等待處理 |
| `processing` | 處理中（已被 worker 取走） |
| `completed` | 成功完成 |
| `failed` | 失敗（可能重試） |

---

## 約束

| 約束 | 說明 |
|------|------|
| UNIQUE (post_id) | 同一貼文只能有一個 job，避免重複處理 |
| ON DELETE CASCADE (account) | 帳號刪除時連帶刪除 |
| ON DELETE CASCADE (post) | 貼文刪除時連帶刪除 |

---

## RLS 政策

使用 `is_workspace_member()` 函數：

```sql
ALTER TABLE ai_tag_queue ENABLE ROW LEVEL SECURITY;

-- SELECT：工作區成員可查詢
CREATE POLICY "Members can view ai_tag_queue"
  ON ai_tag_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_threads_accounts a
      WHERE a.id = ai_tag_queue.workspace_threads_account_id
        AND is_workspace_member(a.workspace_id)
    )
  );

-- INSERT/UPDATE/DELETE：僅 service_role
-- 由 Edge Function 使用 service client 操作
```

---

## 查詢範例

### 取得待處理任務

```sql
-- 取得 pending 且未超過重試次數的任務（每批 10 筆）
SELECT *
FROM ai_tag_queue
WHERE status = 'pending'
  OR (status = 'failed' AND attempts < max_attempts)
ORDER BY created_at ASC
LIMIT 10
FOR UPDATE SKIP LOCKED;
```

### 標記為處理中

```sql
UPDATE ai_tag_queue
SET
  status = 'processing',
  started_at = now(),
  attempts = attempts + 1
WHERE id = $1;
```

### 標記為完成

```sql
UPDATE ai_tag_queue
SET
  status = 'completed',
  completed_at = now()
WHERE id = $1;
```

### 標記為失敗

```sql
UPDATE ai_tag_queue
SET
  status = 'failed',
  error_message = $2
WHERE id = $1;
```

### 清理已完成任務（保留 7 天）

```sql
DELETE FROM ai_tag_queue
WHERE status = 'completed'
  AND completed_at < now() - INTERVAL '7 days';
```

---

## 相關資料表

| 資料表 | 關係 | 說明 |
|--------|------|------|
| workspace_threads_accounts | N:1 | 所屬帳號 |
| workspace_threads_posts | N:1 | 關聯的貼文 |

---

## 相關文件

- [tagging-system.md](../../04-backend/ai/tagging-system.md) - AI 標籤系統總覽
- [llm-usage-logs.md](llm-usage-logs.md) - LLM 使用記錄
