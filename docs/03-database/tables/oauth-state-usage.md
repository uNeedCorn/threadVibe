# oauth_state_usage

## 說明

追蹤 Threads OAuth `state` 是否已被使用，用於防止 **state 重放攻擊**（單次使用）。

---

## Schema

```sql
CREATE TABLE oauth_state_usage (
  state_hash  TEXT PRIMARY KEY,
  workspace_id UUID NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 業務規則

- `state_hash` 由 Edge Function 計算（SHA-256），並在 callback **交換 token 前**寫入。
- 若插入失敗且為重複鍵，代表該 `state` 已被使用，callback 必須拒絕處理。
- 由 `workspace-cleanup` 排程任務定期清理過期資料（目前保留期：`expires_at` 過期後再保留 1 天）。
