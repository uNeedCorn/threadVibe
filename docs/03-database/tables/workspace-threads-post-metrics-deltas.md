# workspace_threads_post_metrics_deltas

## 說明

**Layer 2: Delta（增量）** — 儲存每次同步計算出的成效增量。

每次同步時，自動計算「本次 Snapshot - 上次 Snapshot」的差值，用於分析成長趨勢。

---

## 三層式成效架構

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Snapshot（快照）                                │
│ → workspace_threads_post_metrics                        │
│ → 每次同步新增一筆，不可變                               │
├─────────────────────────────────────────────────────────┤
│ Layer 2: Delta（增量）← 本表                            │
│ → 儲存「本次 - 上次」的差值                              │
│ → 可重算（若 Snapshot 資料正確）                         │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Current（當前）                                 │
│ → workspace_threads_posts.current_*                     │
│ → 每次同步更新，方便快速查詢最新值                       │
└─────────────────────────────────────────────────────────┘
```

---

## Schema

```sql
CREATE TABLE workspace_threads_post_metrics_deltas (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_post_id UUID NOT NULL REFERENCES workspace_threads_posts(id) ON DELETE CASCADE,
  period_start              TIMESTAMPTZ NOT NULL,
  period_end                TIMESTAMPTZ NOT NULL,
  views_delta               INTEGER NOT NULL DEFAULT 0,
  likes_delta               INTEGER NOT NULL DEFAULT 0,
  replies_delta             INTEGER NOT NULL DEFAULT 0,
  reposts_delta             INTEGER NOT NULL DEFAULT 0,
  quotes_delta              INTEGER NOT NULL DEFAULT 0,
  shares_delta              INTEGER NOT NULL DEFAULT 0,
  is_recalculated           BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 欄位說明

### 時間區間

| 欄位 | 類型 | Nullable | 說明 |
|------|------|----------|------|
| `id` | UUID | NO | 主鍵 |
| `workspace_threads_post_id` | UUID | NO | 所屬貼文 (FK) |
| `period_start` | TIMESTAMPTZ | NO | 區間起始（上次 snapshot 時間） |
| `period_end` | TIMESTAMPTZ | NO | 區間結束（本次 snapshot 時間） |

### Delta 數值

| 欄位 | 類型 | Nullable | 說明 |
|------|------|----------|------|
| `views_delta` | INTEGER | NO | 觀看數增量 |
| `likes_delta` | INTEGER | NO | 按讚數增量 |
| `replies_delta` | INTEGER | NO | 回覆數增量 |
| `reposts_delta` | INTEGER | NO | 轉發數增量 |
| `quotes_delta` | INTEGER | NO | 引用數增量 |
| `shares_delta` | INTEGER | NO | 分享數增量 |

### 元資料

| 欄位 | 類型 | Nullable | 說明 |
|------|------|----------|------|
| `is_recalculated` | BOOLEAN | NO | 是否為重算（非原始計算） |
| `created_at` | TIMESTAMPTZ | NO | 建立時間 |

---

## 索引

```sql
CREATE INDEX idx_deltas_post_period
ON workspace_threads_post_metrics_deltas(workspace_threads_post_id, period_end DESC);

CREATE INDEX idx_deltas_period_end
ON workspace_threads_post_metrics_deltas(period_end DESC);
```

---

## 關聯

| 關聯表 | 關係 | 說明 |
|--------|------|------|
| `workspace_threads_posts` | n:1 | 所屬貼文 |

---

## Delta 計算邏輯

```typescript
function calculateDelta(current: Snapshot, previous: Snapshot): Delta {
  return {
    period_start: previous.captured_at,
    period_end: current.captured_at,
    views_delta: current.views - previous.views,
    likes_delta: current.likes - previous.likes,
    replies_delta: current.replies - previous.replies,
    reposts_delta: current.reposts - previous.reposts,
    quotes_delta: current.quotes - previous.quotes,
    shares_delta: current.shares - previous.shares,
    is_recalculated: false,
  };
}
```

---

## 重算機制

若發現 Snapshot 資料有誤並修正後，可重算 Delta：

```sql
-- 標記為重算
UPDATE workspace_threads_post_metrics_deltas
SET is_recalculated = TRUE
WHERE workspace_threads_post_id = $1;

-- 或刪除後重新計算
DELETE FROM workspace_threads_post_metrics_deltas
WHERE workspace_threads_post_id = $1;

-- 重新計算並插入...
```

---

## 查詢範例

### 過去 7 天的總增量

```sql
SELECT
  SUM(views_delta) as total_views_growth,
  SUM(likes_delta) as total_likes_growth
FROM workspace_threads_post_metrics_deltas
WHERE workspace_threads_post_id = $1
  AND period_end >= NOW() - INTERVAL '7 days';
```

### 每日成長趨勢

```sql
SELECT
  DATE(period_end) as date,
  SUM(views_delta) as views_growth,
  SUM(likes_delta) as likes_growth
FROM workspace_threads_post_metrics_deltas
WHERE workspace_threads_post_id = $1
GROUP BY DATE(period_end)
ORDER BY date DESC;
```

---

## 資料保留策略

- **永久保留**所有 Delta 記錄
- 可用於計算任意時間區間的成長
- 若需清理，可保留最近 N 天的 Delta
