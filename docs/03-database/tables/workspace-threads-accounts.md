# workspace_threads_accounts

## 說明

記錄 Workspace 中綁定的 Threads 帳號。同一個 Threads 帳號可被多個 Workspace 綁定（各自獨立）。

**此表同時作為三層式 Insights 架構的 Layer 3（Current）**，儲存最新的帳號 Insights。

---

## 三層式 Insights 架構

```
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Snapshot（快照）                                │
│ → workspace_threads_account_insights                    │
│ → 每次同步新增一筆，不可變                               │
├─────────────────────────────────────────────────────────┤
│ Layer 2: Delta（增量）                                   │
│ → workspace_threads_account_insights_deltas             │
│ → 自動計算前後差值                                       │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Current（當前）← 本表                          │
│ → workspace_threads_accounts.current_*                  │
│ → 每次同步更新，方便快速查詢                             │
└─────────────────────────────────────────────────────────┘
```

---

## Schema

```sql
CREATE TABLE workspace_threads_accounts (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  threads_user_id     TEXT NOT NULL,
  username            TEXT NOT NULL,
  name                TEXT,
  biography           TEXT,
  profile_pic_url     TEXT,
  is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
  is_active           BOOLEAN NOT NULL DEFAULT TRUE,

  -- Layer 3: Current Insights (最新 Insights)
  current_followers_count    INTEGER NOT NULL DEFAULT 0,
  current_profile_views      INTEGER NOT NULL DEFAULT 0,
  current_likes_count_7d     INTEGER NOT NULL DEFAULT 0,
  current_views_count_7d     INTEGER NOT NULL DEFAULT 0,
  last_insights_sync_at      TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, threads_user_id)
);
```

---

## 欄位說明

### 基本欄位

| 欄位 | 類型 | Nullable | 說明 |
|------|------|----------|------|
| `id` | UUID | NO | 主鍵 |
| `workspace_id` | UUID | NO | 所屬 Workspace (FK) |
| `threads_user_id` | TEXT | NO | Threads 平台的 User ID |
| `username` | TEXT | NO | Threads @username |
| `name` | TEXT | YES | 顯示名稱 |
| `biography` | TEXT | YES | 個人簡介 |
| `profile_pic_url` | TEXT | YES | 頭像 URL |
| `is_verified` | BOOLEAN | NO | 是否已驗證 |
| `is_active` | BOOLEAN | NO | 是否啟用同步 |

### Layer 3: Current Insights 欄位

| 欄位 | 類型 | Nullable | 說明 |
|------|------|----------|------|
| `current_followers_count` | INTEGER | NO | 當前粉絲數 |
| `current_profile_views` | INTEGER | NO | 當前 Profile 觀看數 |
| `current_likes_count_7d` | INTEGER | NO | 7 天按讚數 |
| `current_views_count_7d` | INTEGER | NO | 7 天觀看數 |
| `last_insights_sync_at` | TIMESTAMPTZ | YES | 最後 Insights 同步時間 |

### 系統欄位

| 欄位 | 類型 | Nullable | 說明 |
|------|------|----------|------|
| `created_at` | TIMESTAMPTZ | NO | 建立時間 |
| `updated_at` | TIMESTAMPTZ | NO | 更新時間 |

---

## 索引

```sql
CREATE INDEX idx_threads_accounts_workspace
ON workspace_threads_accounts(workspace_id);

CREATE INDEX idx_threads_accounts_active
ON workspace_threads_accounts(is_active)
WHERE is_active = TRUE;

CREATE INDEX idx_threads_accounts_followers
ON workspace_threads_accounts(current_followers_count DESC);
```

---

## 唯一約束

```sql
UNIQUE (workspace_id, threads_user_id)
```

同一 Workspace 內不可重複綁定同一 Threads 帳號。

---

## 關聯

| 關聯表 | 關係 | 說明 |
|--------|------|------|
| `workspaces` | n:1 | 所屬 Workspace |
| `workspace_threads_tokens` | 1:n | Token 記錄 |
| `workspace_threads_posts` | 1:n | 貼文 |
| `workspace_threads_account_insights` | 1:n | Layer 1 Insights Snapshot |
| `workspace_threads_account_insights_deltas` | 1:n | Layer 2 Insights Delta |
| `sync_logs` | 1:n | 同步記錄 |

---

## 業務規則

- OAuth 成功後建立此記錄
- `is_active = FALSE` 時停止同步
- 所有 Token 失效時自動設為 inactive
- Profile 資料由 `sync-account-profile` 更新
- Current Insights 由 `sync-account-insights` 更新
