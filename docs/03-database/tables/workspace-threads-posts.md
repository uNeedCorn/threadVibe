# workspace_threads_posts

## 說明

儲存從 Threads API 同步的貼文。每個 Workspace 獨立儲存（即使同一 Threads 帳號）。

**此表同時作為三層式成效架構的 Layer 3（Current）**，儲存最新的成效數據。

---

## 三層式成效架構

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Snapshot（快照）                                │
│ → workspace_threads_post_metrics                        │
│ → 每次同步新增一筆，不可變                               │
├─────────────────────────────────────────────────────────┤
│ Layer 2: Delta（增量）                                   │
│ → workspace_threads_post_metrics_deltas                 │
│ → 自動計算前後差值                                       │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Current（當前）← 本表                          │
│ → workspace_threads_posts.current_*                     │
│ → 每次同步更新，方便快速查詢                             │
└─────────────────────────────────────────────────────────┘
```

---

## Schema

```sql
CREATE TABLE workspace_threads_posts (
  id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_account_id  UUID NOT NULL REFERENCES workspace_threads_accounts(id) ON DELETE CASCADE,
  threads_post_id               TEXT NOT NULL,
  text                          TEXT,
  media_type                    TEXT,
  media_url                     TEXT,
  permalink                     TEXT,
  published_at                  TIMESTAMPTZ NOT NULL,

  -- Layer 3: Current metrics (最新成效)
  current_views                 INTEGER NOT NULL DEFAULT 0,
  current_likes                 INTEGER NOT NULL DEFAULT 0,
  current_replies               INTEGER NOT NULL DEFAULT 0,
  current_reposts               INTEGER NOT NULL DEFAULT 0,
  current_quotes                INTEGER NOT NULL DEFAULT 0,
  current_shares                INTEGER NOT NULL DEFAULT 0,
  virality_score                NUMERIC(10,2) DEFAULT 0,
  last_metrics_sync_at          TIMESTAMPTZ,

  created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_threads_account_id, threads_post_id)
);
```

---

## 欄位說明

### 基本欄位

| 欄位 | 類型 | Nullable | 說明 |
|------|------|----------|------|
| `id` | UUID | NO | 主鍵 |
| `workspace_threads_account_id` | UUID | NO | 所屬帳號 (FK) |
| `threads_post_id` | TEXT | NO | Threads 平台的 Post ID |
| `text` | TEXT | YES | 貼文內容 |
| `media_type` | TEXT | YES | 媒體類型 |
| `media_url` | TEXT | YES | 媒體 URL |
| `permalink` | TEXT | YES | 貼文連結 |
| `published_at` | TIMESTAMPTZ | NO | 發布時間 |

### Layer 3: Current 欄位

| 欄位 | 類型 | Nullable | 說明 |
|------|------|----------|------|
| `current_views` | INTEGER | NO | 當前觀看數 |
| `current_likes` | INTEGER | NO | 當前按讚數 |
| `current_replies` | INTEGER | NO | 當前回覆數 |
| `current_reposts` | INTEGER | NO | 當前轉發數 |
| `current_quotes` | INTEGER | NO | 當前引用數 |
| `current_shares` | INTEGER | NO | 當前分享數 |
| `virality_score` | NUMERIC(10,2) | YES | 病毒傳播分數 |
| `last_metrics_sync_at` | TIMESTAMPTZ | YES | 最後成效同步時間 |

### 系統欄位

| 欄位 | 類型 | Nullable | 說明 |
|------|------|----------|------|
| `created_at` | TIMESTAMPTZ | NO | 建立時間 |
| `updated_at` | TIMESTAMPTZ | NO | 更新時間 |

---

## 索引

```sql
CREATE INDEX idx_posts_account_published
ON workspace_threads_posts(workspace_threads_account_id, published_at DESC);

CREATE INDEX idx_posts_threads_id
ON workspace_threads_posts(threads_post_id);
```

---

## 唯一約束

```sql
UNIQUE (workspace_threads_account_id, threads_post_id)
```

同一帳號內不可重複儲存同一貼文。

---

## 關聯

| 關聯表 | 關係 | 說明 |
|--------|------|------|
| `workspace_threads_accounts` | n:1 | 所屬帳號 |
| `workspace_threads_post_metrics` | 1:n | 成效快照 |

---

## Media Type 對應

| 值 | 說明 |
|------|------|
| TEXT_POST | 純文字貼文 |
| IMAGE | 圖片貼文 |
| VIDEO | 影片貼文 |
| CAROUSEL_ALBUM | 多圖/影片輪播 |

---

## 同步邏輯

```
API Response → Normalize → Upsert
```

- 使用 `threads_post_id` 判斷是否已存在
- 存在則更新 `text`, `media_url` 等可變欄位
- 不存在則新增
