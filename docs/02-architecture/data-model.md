# 資料模型說明

## 核心概念

### 多租戶架構

```
User (1) ←→ (n) WorkspaceMember (n) ←→ (1) Workspace
```

- **User**: 透過 Google OAuth 登入的使用者
- **Workspace**: 資料隔離的基本單位
- **WorkspaceMember**: User 與 Workspace 的 n:n 關係

### Token 歸屬

```
Workspace (1) → (n) ThreadsAccount (1) → (n) ThreadsToken
```

- Token 歸屬於 **Workspace**，非個人
- 同一 Threads 帳號可綁定多個 Workspace
- 每個綁定可有多個 Token（支援移轉）

---

## 實體關係

### 核心實體

| 實體 | 說明 | 主鍵 |
|------|------|------|
| User | 系統使用者 | id (UUID) |
| Workspace | 工作區 | id (UUID) |
| WorkspaceMember | 成員關係 | workspace_id + user_id |
| WorkspaceThreadsAccount | Workspace 內的 Threads 帳號 | id (UUID) |
| WorkspaceThreadsToken | Token 記錄 | id (UUID) |

### 資料實體

| 實體 | 說明 | 主鍵 |
|------|------|------|
| WorkspaceThreadsPost | 貼文 + Layer 3 Current | id (UUID) |
| WorkspaceThreadsPostMetrics | Layer 1 Snapshot | id (UUID) |
| WorkspaceThreadsPostMetricsDeltas | Layer 2 Delta | id (UUID) |
| WorkspaceThreadsAccountInsights | 帳號 Insights | id (UUID) |

### 系統實體

| 實體 | 說明 | 主鍵 |
|------|------|------|
| UserSubscription | 使用者訂閱方案 | id (UUID) |
| SyncLog | 同步記錄 | id (UUID) |
| SystemAdmin | 系統管理員 | user_id |

---

## 關係定義

### User ↔ Workspace (n:n)

透過 `workspace_members` 關聯：

```sql
workspace_members (
  workspace_id  → workspaces.id
  user_id       → auth.users.id
  role          → 'owner' | 'editor' | 'viewer'
)
```

### Workspace → ThreadsAccount (1:n)

```sql
workspace_threads_accounts (
  workspace_id  → workspaces.id
  threads_user_id  -- Threads 平台的 user_id
)
```

### ThreadsAccount → Token (1:n)

```sql
workspace_threads_tokens (
  workspace_threads_account_id → workspace_threads_accounts.id
  authorized_by_user_id        → auth.users.id
  is_primary                   -- 目前使用的 Token
)
```

### ThreadsAccount → Posts (1:n)

```sql
workspace_threads_posts (
  workspace_threads_account_id → workspace_threads_accounts.id
)
```

### Post → Metrics (1:n) — 三層架構

```
Post (1) → (n) Metrics Snapshot (Layer 1)
Post (1) → (n) Metrics Delta (Layer 2)
Post (1) → (1) Current (Layer 3, 內嵌於 Post)
```

```sql
-- Layer 1: Snapshot
workspace_threads_post_metrics (
  workspace_threads_post_id → workspace_threads_posts.id
  captured_at               -- 快照時間
)

-- Layer 2: Delta
workspace_threads_post_metrics_deltas (
  workspace_threads_post_id → workspace_threads_posts.id
  period_start, period_end  -- 計算區間
)

-- Layer 3: Current (內嵌於 workspace_threads_posts)
workspace_threads_posts.current_views
workspace_threads_posts.current_likes
...
```

---

## 三層式成效架構

貼文成效數據採用三層式架構：

```
Threads API
    ↓
┌─────────────────────────────────────────────────────────┐
│ Layer 1: Snapshot                                       │
│ workspace_threads_post_metrics                          │
│ → 不可變、每次同步新增一筆                               │
├─────────────────────────────────────────────────────────┤
│ Layer 2: Delta                                          │
│ workspace_threads_post_metrics_deltas                   │
│ → 自動計算增量、可重算                                   │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Current                                        │
│ workspace_threads_posts.current_*                       │
│ → 每次同步更新最新值                                    │
└─────────────────────────────────────────────────────────┘
```

### 設計原則

| 原則 | 說明 |
|------|------|
| **不可變** | Layer 1 Snapshot 永不修改 |
| **可追溯** | 可從 Layer 1 重建 Layer 2/3 |
| **快速查詢** | Layer 3 避免 JOIN/aggregate |
| **成長分析** | Layer 2 Delta 直接計算區間成長 |

---

## 資料隔離策略

### 獨立資料模式

即使同一個 Threads 帳號被多個 Workspace 綁定：

- 各 Workspace 有**獨立的貼文副本**
- 各 Workspace 有**獨立的成效數據**
- **不共享** raw data

### 原因

1. 簡化查詢（無需跨 Workspace join）
2. 支援不同同步頻率設定
3. 刪除 Workspace 時不影響其他

---

## 軟刪除策略

| 實體 | 軟刪除欄位 | 保留期 |
|------|-----------|--------|
| Workspace | deleted_at | 30 天 |
| ThreadsToken | revoked_at | 永久記錄 |
| WorkspaceMember | - | 直接刪除 |
