# rate_limit_counters

## 說明

資料庫層級的簡易 Rate Limit 計數器，供 Edge Functions 以 `service_role` 進行原子化限流。

> 此表不設計給一般 client 直接讀寫。

---

## Schema

```sql
CREATE TABLE rate_limit_counters (
  key        TEXT PRIMARY KEY,
  count      INTEGER NOT NULL,
  reset_at   TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## RPC

使用 `public.check_rate_limit(p_key, p_limit, p_window_seconds)` 做原子化檢查：

- 回傳：`allowed`, `remaining`, `reset_at`
- Edge Functions 依回傳結果決定是否回 `429`

## 清理

- 由 `workspace-cleanup` 排程任務定期刪除 `reset_at` 已過期且超過 1 天的資料，避免表無限增長。
