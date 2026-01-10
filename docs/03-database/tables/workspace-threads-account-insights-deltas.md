# workspace_threads_account_insights_deltas

## 說明

**Layer 2: Delta（增量）** — 儲存每次同步計算出的帳號 Insights 增量。

每次同步時，自動計算「本次 Snapshot - 上次 Snapshot」的差值，用於分析成長趨勢。

---

## 三層式 Insights 架構

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Snapshot（快照）                                │
│ → workspace_threads_account_insights                    │
│ → 每次同步新增一筆，不可變                               │
├─────────────────────────────────────────────────────────┤
│ Layer 2: Delta（增量）← 本表                            │
│ → 儲存「本次 - 上次」的差值                              │
│ → 可重算（若 Snapshot 資料正確）                         │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Current（當前）                                 │
│ → workspace_threads_accounts.current_*                  │
│ → 每次同步更新，方便快速查詢最新值                       │
└─────────────────────────────────────────────────────────┘
```

---

## Schema

```sql
CREATE TABLE workspace_threads_account_insights_deltas (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_account_id  UUID NOT NULL REFERENCES workspace_threads_accounts(id) ON DELETE CASCADE,
  period_start                  TIMESTAMPTZ NOT NULL,
  period_end                    TIMESTAMPTZ NOT NULL,
  followers_delta               INTEGER NOT NULL DEFAULT 0,
  profile_views_delta           INTEGER NOT NULL DEFAULT 0,
  likes_count_7d_delta          INTEGER NOT NULL DEFAULT 0,
  views_count_7d_delta          INTEGER NOT NULL DEFAULT 0,
  is_recalculated               BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 欄位說明

### 時間區間

| 欄位 | 類型 | Nullable | 說明 |
|------|------|----------|------|
| `id` | UUID | NO | 主鍵 |
| `workspace_threads_account_id` | UUID | NO | 所屬帳號 (FK) |
| `period_start` | TIMESTAMPTZ | NO | 區間起始（上次 snapshot 時間） |
| `period_end` | TIMESTAMPTZ | NO | 區間結束（本次 snapshot 時間） |

### Delta 數值

| 欄位 | 類型 | Nullable | 說明 |
|------|------|----------|------|
| `followers_delta` | INTEGER | NO | 粉絲數增量 |
| `profile_views_delta` | INTEGER | NO | Profile 觀看數增量 |
| `likes_count_7d_delta` | INTEGER | NO | 7 天按讚數增量 |
| `views_count_7d_delta` | INTEGER | NO | 7 天觀看數增量 |

### 元資料

| 欄位 | 類型 | Nullable | 說明 |
|------|------|----------|------|
| `is_recalculated` | BOOLEAN | NO | 是否為重算（非原始計算） |
| `created_at` | TIMESTAMPTZ | NO | 建立時間 |

---

## 索引

```sql
CREATE INDEX idx_account_insights_deltas_account_period
ON workspace_threads_account_insights_deltas(workspace_threads_account_id, period_end DESC);

CREATE INDEX idx_account_insights_deltas_period_end
ON workspace_threads_account_insights_deltas(period_end DESC);
```

---

## 關聯

| 關聯表 | 關係 | 說明 |
|--------|------|------|
| `workspace_threads_accounts` | n:1 | 所屬帳號 |

---

## Delta 計算邏輯

```typescript
function calculateInsightsDelta(
  current: AccountInsightsSnapshot,
  previous: AccountInsightsSnapshot
): AccountInsightsDelta {
  return {
    period_start: previous.captured_at,
    period_end: current.captured_at,
    followers_delta: current.followers_count - previous.followers_count,
    profile_views_delta: current.profile_views - previous.profile_views,
    likes_count_7d_delta: current.likes_count_7d - previous.likes_count_7d,
    views_count_7d_delta: current.views_count_7d - previous.views_count_7d,
    is_recalculated: false,
  };
}
```

---

## 查詢範例

### 過去 7 天的粉絲成長

```sql
SELECT SUM(followers_delta) as total_followers_growth
FROM workspace_threads_account_insights_deltas
WHERE workspace_threads_account_id = $1
  AND period_end >= NOW() - INTERVAL '7 days';
```

### 每日粉絲成長趨勢

```sql
SELECT
  DATE(period_end) as date,
  SUM(followers_delta) as followers_growth
FROM workspace_threads_account_insights_deltas
WHERE workspace_threads_account_id = $1
  AND period_end >= NOW() - INTERVAL '30 days'
GROUP BY DATE(period_end)
ORDER BY date DESC;
```

### 成長率計算

```sql
WITH current_data AS (
  SELECT current_followers_count
  FROM workspace_threads_accounts
  WHERE id = $1
),
growth_data AS (
  SELECT SUM(followers_delta) as growth_7d
  FROM workspace_threads_account_insights_deltas
  WHERE workspace_threads_account_id = $1
    AND period_end >= NOW() - INTERVAL '7 days'
)
SELECT
  growth_7d,
  ROUND(growth_7d::NUMERIC / NULLIF(current_followers_count - growth_7d, 0) * 100, 2) as growth_rate_percent
FROM current_data, growth_data;
```

---

## 資料保留策略

- **永久保留**所有 Delta 記錄
- 可用於計算任意時間區間的成長
- 若需清理，可保留最近 N 天的 Delta
