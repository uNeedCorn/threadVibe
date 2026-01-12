# r_hat_queue

> R̂_t 計算 Job Queue - 管理待處理的再生數計算任務

## 概述

`r_hat_queue` 用於管理 R̂_t（再生數估計）計算任務。當貼文指標同步完成後，會將貼文入隊到此表，由 `r-hat-calculator` Edge Function 定期處理。

## Schema

```sql
CREATE TABLE r_hat_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_post_id UUID NOT NULL
    REFERENCES workspace_threads_posts(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  calculated_r_hat NUMERIC,
  calculated_r_hat_status TEXT
);
```

## 欄位說明

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | UUID | 主鍵 |
| `workspace_threads_post_id` | UUID | 關聯貼文 ID |
| `status` | TEXT | 任務狀態 |
| `priority` | INTEGER | 優先級（數字越大越優先） |
| `attempts` | INTEGER | 已嘗試次數 |
| `max_attempts` | INTEGER | 最大重試次數（預設 3） |
| `error_message` | TEXT | 錯誤訊息（失敗時） |
| `created_at` | TIMESTAMPTZ | 入隊時間 |
| `started_at` | TIMESTAMPTZ | 開始處理時間 |
| `completed_at` | TIMESTAMPTZ | 完成時間 |
| `calculated_r_hat` | NUMERIC | 計算結果：R̂_t 值 |
| `calculated_r_hat_status` | TEXT | 計算結果：狀態分類 |

## 狀態流轉

```
pending → processing → completed
                    → failed (可重試)
                    → skipped (資料不足)
```

| 狀態 | 說明 |
|------|------|
| `pending` | 等待處理 |
| `processing` | 處理中 |
| `completed` | 計算完成 |
| `failed` | 處理失敗（可重試） |
| `skipped` | 資料不足，跳過 |

## 優先級

| 值 | 說明 |
|----|------|
| 0 | 正常同步後入隊 |
| 10 | 新貼文（發布後 48 小時內） |
| 20 | 熱門貼文（保留擴展） |

## 索引

```sql
-- 主要查詢：找 pending 任務，按優先級和建立時間排序
CREATE INDEX idx_r_hat_queue_pending
  ON r_hat_queue(status, priority DESC, created_at)
  WHERE status = 'pending';

-- 同一貼文同時只能有一個 pending/processing job
CREATE UNIQUE INDEX idx_r_hat_queue_unique_pending
  ON r_hat_queue(workspace_threads_post_id)
  WHERE status IN ('pending', 'processing');

-- 按貼文查詢歷史
CREATE INDEX idx_r_hat_queue_post
  ON r_hat_queue(workspace_threads_post_id, created_at DESC);
```

## RLS 政策

```sql
-- 工作區成員可查詢
CREATE POLICY "Members can view r_hat_queue"
  ON r_hat_queue FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_threads_posts p
      JOIN workspace_threads_accounts a ON a.id = p.workspace_threads_account_id
      WHERE p.id = r_hat_queue.workspace_threads_post_id
        AND is_workspace_member(a.workspace_id)
    )
  );
```

INSERT/UPDATE/DELETE 由 `service_role` 操作。

## 入隊邏輯

在 `sync.ts` 的 `syncMetricsForAccount` 完成後入隊：

```typescript
const queueItems = syncedPostIds.map((postId) => {
  // 計算優先級：新貼文（48 小時內）優先
  const hoursOld = ...;
  let priority = 0;
  if (hoursOld <= 48) priority = 10;

  return {
    workspace_threads_post_id: postId,
    status: 'pending',
    priority,
  };
});

await serviceClient
  .from('r_hat_queue')
  .upsert(queueItems, {
    onConflict: 'workspace_threads_post_id',
    ignoreDuplicates: true,
  });
```

## 相關資源

| 資源 | 說明 |
|------|------|
| [r-hat-calculator](../../04-backend/functions/r-hat-calculator.md) | 處理此 Queue 的 Edge Function |
| [ai-tag-queue](./ai-tag-queue.md) | 類似的 Job Queue 設計參考 |

## Migration

- `20260111800002_create_r_hat_queue.sql`
