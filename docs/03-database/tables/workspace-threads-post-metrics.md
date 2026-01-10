# workspace_threads_post_metrics

## 說明

**Layer 1: Snapshot（快照）** — 儲存貼文成效的不可變時序快照。

每次同步從 Threads API 取得的原始數據，直接存入此表。此資料為 **Single Source of Truth**，不可修改。

---

## 三層式成效架構

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Snapshot（快照）← 本表                         │
│ → 每次同步新增一筆，不可變                               │
│ → 作為 delta 計算的基礎                                 │
├─────────────────────────────────────────────────────────┤
│ Layer 2: Delta（增量）                                   │
│ → workspace_threads_post_metrics_deltas                 │
│ → 自動計算「本次 - 上次」的差值                          │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Current（當前）                                 │
│ → workspace_threads_posts.current_*                     │
│ → 每次同步更新，方便快速查詢最新值                       │
└─────────────────────────────────────────────────────────┘
```

---

## Schema

```sql
CREATE TABLE workspace_threads_post_metrics (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_post_id UUID NOT NULL REFERENCES workspace_threads_posts(id) ON DELETE CASCADE,
  views                     INTEGER NOT NULL DEFAULT 0,
  likes                     INTEGER NOT NULL DEFAULT 0,
  replies                   INTEGER NOT NULL DEFAULT 0,
  reposts                   INTEGER NOT NULL DEFAULT 0,
  quotes                    INTEGER NOT NULL DEFAULT 0,
  shares                    INTEGER NOT NULL DEFAULT 0,
  captured_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 欄位說明

| 欄位 | 類型 | Nullable | 說明 |
|------|------|----------|------|
| `id` | UUID | NO | 主鍵 |
| `workspace_threads_post_id` | UUID | NO | 所屬貼文 (FK) |
| `views` | INTEGER | NO | 觀看次數 |
| `likes` | INTEGER | NO | 按讚數 |
| `replies` | INTEGER | NO | 回覆數 |
| `reposts` | INTEGER | NO | 轉發數 |
| `quotes` | INTEGER | NO | 引用數 |
| `shares` | INTEGER | NO | 分享數 |
| `captured_at` | TIMESTAMPTZ | NO | 快照時間 |

---

## 索引

```sql
CREATE INDEX idx_metrics_post_captured
ON workspace_threads_post_metrics(workspace_threads_post_id, captured_at DESC);

CREATE INDEX idx_metrics_captured
ON workspace_threads_post_metrics(captured_at DESC);
```

---

## 關聯

| 關聯表 | 關係 | 說明 |
|--------|------|------|
| `workspace_threads_posts` | n:1 | 所屬貼文 |

---

## 指標來源 (Threads API)

| API 欄位 | 對應欄位 |
|----------|----------|
| views | views |
| likes | likes |
| replies | replies |
| reposts | reposts |
| quotes | quotes |
| shares | shares |

---

## 資料保留策略

- **不刪除**任何歷史快照
- 每次同步新增一筆（非更新）
- 可用於繪製趨勢圖

---

## 查詢範例

### 最新成效

```sql
SELECT DISTINCT ON (workspace_threads_post_id) *
FROM workspace_threads_post_metrics
ORDER BY workspace_threads_post_id, captured_at DESC;
```

### 趨勢分析

```sql
SELECT
  date_trunc('day', captured_at) as day,
  SUM(views) as total_views
FROM workspace_threads_post_metrics
WHERE workspace_threads_post_id = $1
GROUP BY day
ORDER BY day;
```
