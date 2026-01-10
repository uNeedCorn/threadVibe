# Schema 總覽

## 資料表清單

### 核心資料表

| 資料表 | 說明 | 文件 |
|--------|------|------|
| `workspaces` | 工作區 | [workspaces.md](tables/workspaces.md) |
| `workspace_members` | 成員關係 | [workspace-members.md](tables/workspace-members.md) |

### Threads 帳號相關

| 資料表 | Layer | 說明 | 文件 |
|--------|-------|------|------|
| `workspace_threads_accounts` | L3 | 帳號 + Current Insights | [workspace-threads-accounts.md](tables/workspace-threads-accounts.md) |
| `workspace_threads_tokens` | - | Token 記錄 | [workspace-threads-tokens.md](tables/workspace-threads-tokens.md) |
| `workspace_threads_account_insights` | L1 | 帳號 Insights Snapshot | [workspace-threads-account-insights.md](tables/workspace-threads-account-insights.md) |
| `workspace_threads_account_insights_deltas` | L2 | 帳號 Insights Delta | [workspace-threads-account-insights-deltas.md](tables/workspace-threads-account-insights-deltas.md) |

### Threads 貼文相關

| 資料表 | Layer | 說明 | 文件 |
|--------|-------|------|------|
| `workspace_threads_posts` | L3 | 貼文 + Current 成效 | [workspace-threads-posts.md](tables/workspace-threads-posts.md) |
| `workspace_threads_post_metrics` | L1 | 貼文成效 Snapshot | [workspace-threads-post-metrics.md](tables/workspace-threads-post-metrics.md) |
| `workspace_threads_post_metrics_deltas` | L2 | 貼文成效 Delta | [workspace-threads-post-metrics-deltas.md](tables/workspace-threads-post-metrics-deltas.md) |

### 系統資料表

| 資料表 | 說明 | 文件 |
|--------|------|------|
| `user_subscriptions` | 訂閱方案 | [user-subscriptions.md](tables/user-subscriptions.md) |
| `sync_logs` | 同步記錄 | [sync-logs.md](tables/sync-logs.md) |
| `system_job_logs` | 系統任務記錄 | [system-job-logs.md](tables/system-job-logs.md) |
| `system_job_locks` | 排程任務鎖（防重複執行） | [system-job-locks.md](tables/system-job-locks.md) |
| `oauth_state_usage` | OAuth state 單次使用追蹤 | [oauth-state-usage.md](tables/oauth-state-usage.md) |
| `rate_limit_counters` | Rate Limit 計數器（內部） | [rate-limit-counters.md](tables/rate-limit-counters.md) |
| `system_admins` | 系統管理員 | [system-admins.md](tables/system-admins.md) |
| `token_transfers` | Token 移轉記錄 | [token-transfers.md](tables/token-transfers.md) |

### 使用 Supabase Auth

| 資料表 | 說明 | 備註 |
|--------|------|------|
| `auth.users` | 使用者 | Supabase 內建 |

---

## Schema 分類

```
public
├── workspaces
├── workspace_members
│
├── workspace_threads_accounts              ← 帳號 L3: Current
├── workspace_threads_tokens
├── workspace_threads_account_insights      ← 帳號 L1: Snapshot
├── workspace_threads_account_insights_deltas ← 帳號 L2: Delta
│
├── workspace_threads_posts                 ← 貼文 L3: Current
├── workspace_threads_post_metrics          ← 貼文 L1: Snapshot
├── workspace_threads_post_metrics_deltas   ← 貼文 L2: Delta
│
├── user_subscriptions
├── sync_logs
├── system_job_logs
├── system_job_locks
├── oauth_state_usage
├── rate_limit_counters
├── system_admins
└── token_transfers

auth (Supabase 內建)
└── users
```

---

## 三層式成效架構

成效數據採用三層式架構，確保資料完整性與查詢效率。

### 架構說明

```
Threads API 回傳數據
        ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Snapshot（快照）                                │
│ → 每次同步新增一筆，不可變                               │
│ → Single Source of Truth                                │
├─────────────────────────────────────────────────────────┤
│ Layer 2: Delta（增量）                                   │
│ → 自動計算「本次 - 上次」的差值                          │
│ → 可從 Layer 1 重算                                     │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Current（當前）                                 │
│ → 每次同步更新最新值                                    │
│ → 方便快速查詢，避免 aggregate                          │
└─────────────────────────────────────────────────────────┘
```

### 貼文成效三層架構

| Layer | 表 | 操作 | 用途 |
|-------|-----|------|------|
| Layer 1 | `workspace_threads_post_metrics` | INSERT | 歷史快照、趨勢圖 |
| Layer 2 | `workspace_threads_post_metrics_deltas` | INSERT | 成長分析、區間統計 |
| Layer 3 | `workspace_threads_posts.current_*` | UPDATE | 列表顯示、排序 |

### 帳號 Insights 三層架構

| Layer | 表 | 操作 | 用途 |
|-------|-----|------|------|
| Layer 1 | `workspace_threads_account_insights` | INSERT | 歷史快照、趨勢圖 |
| Layer 2 | `workspace_threads_account_insights_deltas` | INSERT | 成長分析、區間統計 |
| Layer 3 | `workspace_threads_accounts.current_*` | UPDATE | Dashboard、排序 |

### 各層特性

| Layer | 特性 | 說明 |
|-------|------|------|
| Layer 1 | 不可變 | Snapshot 只 INSERT，永不 UPDATE |
| Layer 2 | 可重算 | 若 Snapshot 資料正確，Delta 可從 L1 重算 |
| Layer 3 | 可覆寫 | 每次同步更新最新值 |

---

## 命名規範

| 類型 | 規範 | 範例 |
|------|------|------|
| 資料表 | snake_case, 複數 | `workspace_members` |
| 欄位 | snake_case | `created_at` |
| 主鍵 | `id` (UUID) 或複合鍵 | `id`, `(workspace_id, user_id)` |
| 外鍵 | `<table>_id` | `workspace_id` |
| 布林 | `is_<name>` | `is_primary` |
| 時間戳 | `<action>_at` | `created_at`, `deleted_at` |
| Current 欄位 | `current_<name>` | `current_followers_count` |
| Delta 欄位 | `<name>_delta` | `followers_delta` |

---

## 共用欄位

所有資料表都應包含：

| 欄位 | 類型 | 說明 |
|------|------|------|
| `id` | UUID | 主鍵（單一主鍵情況） |
| `created_at` | TIMESTAMPTZ | 建立時間 |
| `updated_at` | TIMESTAMPTZ | 更新時間（若需要） |

---

## 索引策略

### 必要索引

1. 所有外鍵欄位
2. 常用查詢條件欄位
3. 排序欄位

### 建議索引

```sql
-- 貼文成效
CREATE INDEX idx_posts_account_published
ON workspace_threads_posts(workspace_threads_account_id, published_at DESC);

CREATE INDEX idx_metrics_post_captured
ON workspace_threads_post_metrics(workspace_threads_post_id, captured_at DESC);

CREATE INDEX idx_post_deltas_post_period
ON workspace_threads_post_metrics_deltas(workspace_threads_post_id, period_end DESC);

-- 帳號 Insights
CREATE INDEX idx_insights_account_captured
ON workspace_threads_account_insights(workspace_threads_account_id, captured_at DESC);

CREATE INDEX idx_account_deltas_account_period
ON workspace_threads_account_insights_deltas(workspace_threads_account_id, period_end DESC);
```

---

## 加密欄位

使用 pgcrypto 加密敏感資料：

| 資料表 | 欄位 | 說明 |
|--------|------|------|
| `workspace_threads_tokens` | `access_token_encrypted` | Access Token |
| `workspace_threads_tokens` | `refresh_token_encrypted` | Refresh Token |
