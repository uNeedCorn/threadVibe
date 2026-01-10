# Cron 排程設定

## 概述

使用 Supabase 的 `pg_cron` + `pg_net` 擴展，定期觸發 Edge Functions 執行背景任務。

---

## 架構

```
pg_cron (排程器)
    ↓
trigger_edge_function() (輔助函數)
    ↓
pg_net.http_post() (HTTP 請求)
    ↓
Edge Functions (執行任務)
```

---

## 擴展依賴

| 擴展 | 版本 | 用途 |
|------|------|------|
| `pg_cron` | 1.6.4 | 排程任務管理 |
| `pg_net` | 0.19.5 | 發送 HTTP 請求 |
| `supabase_vault` | 0.3.1 | 安全儲存 CRON_SECRET |

---

## 排程任務

| Job Name | 排程 (Cron) | 說明 | UTC 時間 | 台灣時間 |
|----------|-------------|------|----------|----------|
| `scheduled-sync` | `0,15,30,45 * * * *` | 同步貼文/成效/Insights | 每 15 分鐘 | 每 15 分鐘 |
| `token-refresh` | `0 2 * * *` | 刷新即將過期 Token | 02:00 | 10:00 |
| `token-auto-revoke` | `0 3 * * *` | 撤銷已過期 Token | 03:00 | 11:00 |
| `workspace-cleanup` | `0 4 * * *` | 清理已刪除 Workspace | 04:00 | 12:00 |

---

## 輔助函數

```sql
CREATE OR REPLACE FUNCTION trigger_edge_function(function_name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cron_secret TEXT;
  project_url TEXT := 'https://emlclhiaqbkuvztlkfbh.supabase.co';
  request_id BIGINT;
BEGIN
  -- 從 Vault 取得 CRON_SECRET
  SELECT decrypted_secret INTO cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'CRON_SECRET'
  LIMIT 1;

  IF cron_secret IS NULL THEN
    RAISE WARNING 'CRON_SECRET not found in vault, skipping %', function_name;
    RETURN;
  END IF;

  -- 發送 HTTP POST 請求到 Edge Function
  SELECT net.http_post(
    url := project_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || cron_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) INTO request_id;

  RAISE NOTICE 'Triggered % with request_id: %', function_name, request_id;
END;
$$;
```

---

## 管理指令

### 查看所有排程

```sql
SELECT jobid, jobname, schedule, command, active
FROM cron.job
ORDER BY jobid;
```

### 查看執行歷史

```sql
SELECT jobid, runid, job_pid, status, return_message, start_time, end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
```

### 暫停排程

```sql
SELECT cron.unschedule('scheduled-sync');
```

### 恢復排程

```sql
SELECT cron.schedule(
  'scheduled-sync',
  '0,15,30,45 * * * *',
  $$SELECT trigger_edge_function('scheduled-sync')$$
);
```

### 手動觸發

```sql
SELECT trigger_edge_function('scheduled-sync');
```

---

## Vault Secret 管理

### 儲存 CRON_SECRET

```sql
SELECT vault.create_secret(
  'your-secret-value',
  'CRON_SECRET',
  'Cron job authentication secret for Edge Functions'
);
```

### 更新 CRON_SECRET

```sql
UPDATE vault.secrets
SET secret = 'new-secret-value'
WHERE name = 'CRON_SECRET';
```

### 驗證 Secret

```sql
SELECT name, created_at, updated_at
FROM vault.decrypted_secrets
WHERE name = 'CRON_SECRET';
```

---

## 錯誤排查

### 1. 排程未執行

檢查 `cron.job` 是否有該任務：

```sql
SELECT * FROM cron.job WHERE jobname = 'scheduled-sync';
```

### 2. CRON_SECRET 問題

確認 Vault 中有正確的 secret：

```sql
SELECT name FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET';
```

### 3. HTTP 請求失敗

檢查 `pg_net` 請求歷史：

```sql
SELECT * FROM net._http_response ORDER BY created DESC LIMIT 10;
```

### 4. Edge Function 錯誤

檢查 `system_job_logs`：

```sql
SELECT job_type, status, error_message, metadata
FROM system_job_logs
ORDER BY started_at DESC
LIMIT 10;
```

---

## 相關資源

- [排程同步主流程](../sync/scheduled-sync.md)
- [Token 刷新機制](../sync/token-refresh.md)
- [Token 自動撤銷](token-auto-revoke.md)
- [Workspace 刪除任務](workspace-deletion.md)
- [system_job_logs](../../03-database/tables/system-job-logs.md)
