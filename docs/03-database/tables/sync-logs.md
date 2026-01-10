# sync_logs

## 說明

記錄資料同步任務的執行狀態，用於監控與除錯。

---

## Schema

```sql
CREATE TABLE sync_logs (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_account_id  UUID NOT NULL REFERENCES workspace_threads_accounts(id) ON DELETE CASCADE,
  job_type                      TEXT NOT NULL,
  status                        TEXT NOT NULL DEFAULT 'pending',
  started_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at                  TIMESTAMPTZ,
  error_message                 TEXT,
  metadata                      JSONB
);
```

---

## 欄位說明

| 欄位 | 類型 | Nullable | 說明 |
|------|------|----------|------|
| `id` | UUID | NO | 主鍵 |
| `workspace_threads_account_id` | UUID | NO | 同步的帳號 (FK) |
| `job_type` | TEXT | NO | 任務類型 |
| `status` | TEXT | NO | 執行狀態 |
| `started_at` | TIMESTAMPTZ | NO | 開始時間 |
| `completed_at` | TIMESTAMPTZ | YES | 完成時間 |
| `error_message` | TEXT | YES | 錯誤訊息 |
| `metadata` | JSONB | YES | 額外資訊 |

---

## 索引

```sql
CREATE INDEX idx_sync_logs_account ON sync_logs(workspace_threads_account_id);
CREATE INDEX idx_sync_logs_started ON sync_logs(started_at DESC);
CREATE INDEX idx_sync_logs_status ON sync_logs(status) WHERE status = 'failed';
```

---

## 關聯

| 關聯表 | 關係 | 說明 |
|--------|------|------|
| `workspace_threads_accounts` | n:1 | 同步的帳號 |

---

## Job Type

| 類型 | 說明 |
|------|------|
| `sync_posts` | 同步貼文 |
| `sync_metrics` | 同步成效 |
| `sync_account_insights` | 同步帳號 Insights |
> `token_refresh`、`workspace_cleanup` 等系統級任務請看 `system_job_logs`（不記在 `sync_logs`）。

---

## Status

| 狀態 | 說明 |
|------|------|
| `pending` | 等待中 |
| `running` | 執行中 |
| `completed` | 成功完成 |
| `partial` | 部分成功（例如部分貼文成效失敗） |
| `failed` | 失敗 |

---

## Metadata JSON 範例

### 成功時

```json
{
  "posts_synced": 25,
  "metrics_updated": 25,
  "duration_ms": 1500
}
```

### 失敗時

```json
{
  "api_response": {
    "error": {
      "code": 190,
      "message": "Invalid access token"
    }
  },
  "retry_count": 3
}
```

---

## 資料保留策略

- 保留最近 30 天的記錄
- 定期清理舊記錄（由 `workspace-cleanup` 排程任務負責）

```sql
DELETE FROM sync_logs WHERE started_at < NOW() - INTERVAL '30 days';
```

---

## 查詢範例

### 最近失敗的任務

```sql
SELECT * FROM sync_logs
WHERE status = 'failed'
ORDER BY started_at DESC
LIMIT 10;
```

### 同步成功率

```sql
SELECT
  date_trunc('day', started_at) as day,
  COUNT(*) FILTER (WHERE status = 'completed') as success,
  COUNT(*) FILTER (WHERE status = 'failed') as failed
FROM sync_logs
WHERE started_at > NOW() - INTERVAL '7 days'
GROUP BY day;
```
