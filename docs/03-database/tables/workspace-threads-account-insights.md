# workspace_threads_account_insights

## 說明

**Layer 1: Snapshot（快照）** — 儲存 Threads 帳號層級的 Insights 數據。

每次同步新增一筆，永不修改，作為 Single Source of Truth。

---

## 三層式 Insights 架構

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Snapshot（快照）← 本表                          │
│ → workspace_threads_account_insights                    │
│ → 每次同步新增一筆，不可變                               │
│ → Single Source of Truth                                │
├─────────────────────────────────────────────────────────┤
│ Layer 2: Delta（增量）                                   │
│ → workspace_threads_account_insights_deltas             │
│ → 自動計算「本次 - 上次」的差值                          │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Current（當前）                                 │
│ → workspace_threads_accounts.current_*                  │
│ → 每次同步更新，方便快速查詢最新值                       │
└─────────────────────────────────────────────────────────┘
```

---

## Schema

```sql
CREATE TABLE workspace_threads_account_insights (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_account_id  UUID NOT NULL REFERENCES workspace_threads_accounts(id) ON DELETE CASCADE,
  followers_count               INTEGER NOT NULL DEFAULT 0,
  profile_views                 INTEGER NOT NULL DEFAULT 0,
  likes_count_7d                INTEGER NOT NULL DEFAULT 0,
  views_count_7d                INTEGER NOT NULL DEFAULT 0,
  demographics                  JSONB,
  captured_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sync_batch_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 欄位說明

### 基本欄位

| 欄位 | 類型 | Nullable | 說明 |
|------|------|----------|------|
| `id` | UUID | NO | 主鍵 |
| `workspace_threads_account_id` | UUID | NO | 所屬帳號 (FK) |
| `captured_at` | TIMESTAMPTZ | NO | 實際寫入時間（技術用） |
| `sync_batch_at` | TIMESTAMPTZ | NO | 排程批次時間（業務用，對齊到 15 分鐘） |

### sync_batch_at vs captured_at

| 欄位 | 用途 | 範例 |
|------|------|------|
| `captured_at` | 記錄實際寫入時間，用於除錯 | `2026-01-11 13:15:45.123` |
| `sync_batch_at` | 記錄排程邏輯時間，用於趨勢查詢 | `2026-01-11 13:15:00` |

> 詳細設計請參考 [ADR-001: 同步批次時間戳](../../decisions/001-sync-batch-timestamp.md)

### Insights 數值

| 欄位 | 類型 | Nullable | 說明 |
|------|------|----------|------|
| `followers_count` | INTEGER | NO | 粉絲數 |
| `profile_views` | INTEGER | NO | Profile 觀看數 |
| `likes_count_7d` | INTEGER | NO | 7 天按讚數 |
| `views_count_7d` | INTEGER | NO | 7 天觀看數 |
| `demographics` | JSONB | YES | 受眾輪廓 |

---

## 索引

```sql
CREATE INDEX idx_insights_account_captured
ON workspace_threads_account_insights(workspace_threads_account_id, captured_at DESC);

CREATE INDEX idx_insights_captured
ON workspace_threads_account_insights(captured_at DESC);
```

---

## 關聯

| 關聯表 | 關係 | 說明 |
|--------|------|------|
| `workspace_threads_accounts` | n:1 | 所屬帳號 |
| `workspace_threads_account_insights_deltas` | 1:n | Delta 記錄（由本表快照計算） |

---

## Demographics JSON 結構

```json
{
  "gender": {
    "male": 45.2,
    "female": 52.8,
    "other": 2.0
  },
  "age": {
    "13-17": 5.0,
    "18-24": 25.0,
    "25-34": 40.0,
    "35-44": 20.0,
    "45-54": 7.0,
    "55-64": 2.5,
    "65+": 0.5
  },
  "country": {
    "TW": 60.0,
    "US": 15.0,
    "JP": 10.0,
    "HK": 8.0,
    "other": 7.0
  },
  "city": {
    "Taipei": 35.0,
    "New Taipei": 15.0,
    "Taichung": 10.0
  }
}
```

---

## 資料保留策略

- **永久保留**所有 Snapshot
- 每次同步 **INSERT 新筆**，永不 UPDATE
- 是 Layer 2 Delta 計算的依據

---

## 查詢範例

### 最新 Insights

```sql
SELECT *
FROM workspace_threads_account_insights
WHERE workspace_threads_account_id = $1
ORDER BY captured_at DESC
LIMIT 1;
```

### 粉絲成長趨勢（從 Snapshot）

```sql
SELECT
  date_trunc('day', captured_at) as day,
  MAX(followers_count) as followers
FROM workspace_threads_account_insights
WHERE workspace_threads_account_id = $1
  AND captured_at > NOW() - INTERVAL '30 days'
GROUP BY day
ORDER BY day;
```

### 受眾分析

```sql
SELECT demographics
FROM workspace_threads_account_insights
WHERE workspace_threads_account_id = $1
ORDER BY captured_at DESC
LIMIT 1;
```
