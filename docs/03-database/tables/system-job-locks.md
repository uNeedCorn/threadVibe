# system_job_locks

## 說明

資料庫層級的排程任務鎖，用於避免同一個 `job_type` 因排程重疊或多個 scheduler 觸發而 **重複執行**。

> 此表僅供 Edge Functions（`service_role`）透過 RPC 使用，client 不可直接存取。

---

## Schema

```sql
CREATE TABLE system_job_locks (
  job_type     TEXT PRIMARY KEY,
  locked_until TIMESTAMPTZ NOT NULL,
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## RPC

- `public.acquire_system_job_lock(p_job_type, p_ttl_seconds)`：嘗試取得鎖（TTL 秒）
  - 回傳：`acquired`, `locked_until`
- `public.release_system_job_lock(p_job_type)`：最佳努力釋放鎖（將 `locked_until` 設為 NOW）

---

## 使用位置

- `scheduled-sync`、`token-refresh`、`token-auto-revoke`、`workspace-cleanup` 皆會在開始前先取得鎖；未取得時會回傳 `skipped=true`。

