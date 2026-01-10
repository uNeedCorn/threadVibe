# system_job_logs

## 說明

記錄系統層級背景任務的執行狀態。與 `sync_logs` 不同，此表不綁定特定帳號，用於追蹤整體排程任務。

---

## Schema

```sql
CREATE TABLE system_job_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type      TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at  TIMESTAMPTZ,
  error_message TEXT,
  metadata      JSONB
);

-- 索引
CREATE INDEX idx_system_job_logs_type_status
  ON system_job_logs(job_type, status);
CREATE INDEX idx_system_job_logs_started
  ON system_job_logs(started_at DESC);
```

---

## 欄位說明

| 欄位 | 類型 | Nullable | 說明 |
|------|------|----------|------|
| `id` | UUID | NO | 主鍵 |
| `job_type` | TEXT | NO | 任務類型 |
| `status` | TEXT | NO | 執行狀態 |
| `started_at` | TIMESTAMPTZ | NO | 開始時間 |
| `completed_at` | TIMESTAMPTZ | YES | 完成時間 |
| `error_message` | TEXT | YES | 錯誤訊息 |
| `metadata` | JSONB | YES | 額外資訊 |

---

## 任務類型 (job_type)

| 值 | 說明 | Edge Function |
|----|------|---------------|
| `scheduled_sync` | 排程同步所有帳號 | `scheduled-sync` |
| `token_refresh` | 刷新即將過期 Token | `token-refresh` |
| `token_auto_revoke` | 自動撤銷過期 Token | `token-auto-revoke` |
| `workspace_cleanup` | 清理已刪除的 Workspace | `workspace-cleanup` |

---

## 狀態 (status)

| 值 | 說明 |
|----|------|
| `pending` | 等待執行 |
| `running` | 執行中 |
| `completed` | 成功完成 |
| `partial` | 部分成功（有些項目失敗） |
| `failed` | 完全失敗 |

---

## 與 sync_logs 的差異

| 特性 | system_job_logs | sync_logs |
|------|-----------------|-----------|
| 範圍 | 系統層級 | 帳號層級 |
| 綁定帳號 | 否 | 是 |
| 用途 | 追蹤整體任務 | 追蹤單一帳號同步 |
| 觸發者 | 排程器 | 排程器或使用者 |

---

## Metadata 範例

### scheduled_sync

```json
{
  "total_accounts": 10,
  "success_count": 8,
  "error_count": 2,
  "results": [
    {
      "account_id": "uuid",
      "username": "user1",
      "posts_synced": 5,
      "metrics_success": 5,
      "metrics_error": 0,
      "insights_synced": true
    }
  ]
}
```

### token_auto_revoke

```json
{
  "revoked_count": 3,
  "deactivated_accounts_count": 1,
  "revoked_tokens": [
    {
      "token_id": "uuid",
      "account_id": "uuid",
      "reason": "auto_revoke_at expired"
    }
  ],
  "deactivated_accounts": ["uuid"]
}
```

### workspace_cleanup

```json
{
  "retention_days": 30,
  "deleted_count": 2,
  "deleted_workspaces": [
    {
      "id": "uuid",
      "name": "Old Workspace",
      "deleted_at": "2025-12-01T00:00:00Z"
    }
  ]
}
```

---

## 查詢範例

### 最近的任務執行

```sql
SELECT job_type, status, started_at, completed_at, metadata
FROM system_job_logs
ORDER BY started_at DESC
LIMIT 10;
```

### 特定類型的失敗記錄

```sql
SELECT *
FROM system_job_logs
WHERE job_type = 'scheduled_sync'
  AND status IN ('failed', 'partial')
ORDER BY started_at DESC;
```

---

## 相關資源

- [排程同步主流程](../../04-backend/sync/scheduled-sync.md)
- [Token 刷新機制](../../04-backend/sync/token-refresh.md)

## 資料保留策略

- 保留最近 30 天的記錄
- 定期清理舊記錄（由 `workspace-cleanup` 排程任務負責）
