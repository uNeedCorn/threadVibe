# ThreadsVibe 文件索引

> **此為文件系統的入口點，任何文件查詢都應從這裡開始。**

---

## 文件結構

```
docs/
├── INDEX.md                    ← 本文件
│
├── 01-requirements/            # 需求文件
├── 02-architecture/            # 架構設計
├── 03-database/                # 資料庫規格
├── 04-backend/                 # 後端規格
├── 05-frontend/                # 前端規格
├── 06-metrics/                 # 指標體系
│
├── guides/                     # 開發指南
│   ├── coding-best-practices.md
│   ├── task-workflow.md
│   ├── telegram-notification.md
│   └── environment-variables.md
│
├── references/                 # 參考文件
│   └── design-tokens.md
│
├── decisions/                  # 架構決策記錄 (ADR)
│
├── tasks/                      # 任務追蹤
│   ├── TASKS.md
│   ├── TASKS_BACKLOG.md
│   └── TASKS_ARCHIVE.md
│
└── brand/                      # 品牌資源
```

---

## 01-requirements 需求文件

| 文件 | 說明 |
|------|------|
| [user-stories.md](01-requirements/user-stories.md) | 使用者故事 |
| [user-flows.md](01-requirements/user-flows.md) | 使用者流程 |
| [feature-list.md](01-requirements/feature-list.md) | 功能清單 |

---

## 02-architecture 架構設計

| 文件 | 說明 |
|------|------|
| [system-overview.md](02-architecture/system-overview.md) | 系統架構總覽 |
| [data-model.md](02-architecture/data-model.md) | 資料模型說明 |
| [erd.md](02-architecture/erd.md) | ERD 圖 |
| [api-design.md](02-architecture/api-design.md) | API 設計原則 |

---

## 03-database 資料庫規格

### 總覽

| 文件 | 說明 |
|------|------|
| [schema-overview.md](03-database/schema-overview.md) | Schema 總覽 + 三層式架構 |
| [rls-policies.md](03-database/rls-policies.md) | RLS 政策設計 |

### 核心資料表

| 文件 | 說明 |
|------|------|
| [users.md](03-database/tables/users.md) | 使用者（Supabase Auth） |
| [workspaces.md](03-database/tables/workspaces.md) | 工作區 |
| [workspace-members.md](03-database/tables/workspace-members.md) | 成員關係 |

### Threads 帳號相關

| 文件 | Layer | 說明 |
|------|-------|------|
| [workspace-threads-accounts.md](03-database/tables/workspace-threads-accounts.md) | L3 | Threads 帳號 + Current Insights |
| [workspace-threads-tokens.md](03-database/tables/workspace-threads-tokens.md) | - | Token 記錄 |
| [workspace-threads-account-insights.md](03-database/tables/workspace-threads-account-insights.md) | L1 | 帳號 Insights Snapshot |
| [workspace-threads-account-insights-deltas.md](03-database/tables/workspace-threads-account-insights-deltas.md) | L2 | 帳號 Insights Delta |

### Threads 貼文相關

| 文件 | Layer | 說明 |
|------|-------|------|
| [workspace-threads-posts.md](03-database/tables/workspace-threads-posts.md) | L3 | 貼文 + Current 成效 |
| [workspace-threads-post-metrics.md](03-database/tables/workspace-threads-post-metrics.md) | L1 | 貼文成效 Snapshot |
| [workspace-threads-post-metrics-deltas.md](03-database/tables/workspace-threads-post-metrics-deltas.md) | L2 | 貼文成效 Delta |

### 標籤相關

| 文件 | 說明 |
|------|------|
| [workspace-threads-account-tags.md](03-database/tables/workspace-threads-account-tags.md) | 用戶自定義標籤 |
| [workspace-threads-post-tags.md](03-database/tables/workspace-threads-post-tags.md) | 貼文與標籤關聯 |

### 系統資料表

| 文件 | 說明 |
|------|------|
| [user-subscriptions.md](03-database/tables/user-subscriptions.md) | 訂閱方案 |
| [sync-logs.md](03-database/tables/sync-logs.md) | 同步記錄（帳號層級） |
| [system-job-logs.md](03-database/tables/system-job-logs.md) | 系統任務記錄（系統層級） |
| [oauth-state-usage.md](03-database/tables/oauth-state-usage.md) | OAuth state 單次使用追蹤 |
| [rate-limit-counters.md](03-database/tables/rate-limit-counters.md) | Rate Limit 計數器（系統內部） |
| [system-admins.md](03-database/tables/system-admins.md) | 系統管理員 |
| [token-transfers.md](03-database/tables/token-transfers.md) | Token 移轉記錄 |
| [system-job-locks.md](03-database/tables/system-job-locks.md) | 排程任務鎖（防重複執行） |
| [llm-usage-logs.md](03-database/tables/llm-usage-logs.md) | LLM 使用記錄 |

---

## 04-backend 後端規格

### 認證 (auth/)

| 文件 | 說明 |
|------|------|
| [google-oauth.md](04-backend/auth/google-oauth.md) | Google OAuth 流程 |
| [threads-oauth.md](04-backend/auth/threads-oauth.md) | Threads OAuth 流程 |

### 同步機制 (sync/)

| 文件 | 說明 |
|------|------|
| [scheduled-sync.md](04-backend/sync/scheduled-sync.md) | 排程同步主流程 |
| [token-refresh.md](04-backend/sync/token-refresh.md) | Token 刷新機制 |
| [sync-posts.md](04-backend/sync/sync-posts.md) | 同步貼文 |
| [sync-metrics.md](04-backend/sync/sync-metrics.md) | 同步貼文成效（三層式） |
| [sync-account-profile.md](04-backend/sync/sync-account-profile.md) | 同步帳號 Profile |
| [sync-account-insights.md](04-backend/sync/sync-account-insights.md) | 同步帳號 Insights（三層式） |

### API 端點 (api/)

| 文件 | 說明 |
|------|------|
| [workspace-crud.md](04-backend/api/workspace-crud.md) | Workspace CRUD |
| [member-management.md](04-backend/api/member-management.md) | 成員管理 |
| [account-management.md](04-backend/api/account-management.md) | Threads 帳號管理 |
| [token-transfer.md](04-backend/api/token-transfer.md) | Token 移轉 |
| [quota-check.md](04-backend/api/quota-check.md) | 額度檢查 |

### 背景任務 (jobs/)

| 文件 | 說明 |
|------|------|
| [cron-setup.md](04-backend/jobs/cron-setup.md) | Cron 排程設定（pg_cron + pg_net） |
| [workspace-deletion.md](04-backend/jobs/workspace-deletion.md) | Workspace 刪除任務 |
| [token-auto-revoke.md](04-backend/jobs/token-auto-revoke.md) | Token 自動撤銷 |

### AI 功能 (ai/)

| 文件 | 說明 |
|------|------|
| [tagging-system.md](04-backend/ai/tagging-system.md) | 標籤系統（用戶自定義 + AI 建議） |

---

## 05-frontend 前端規格

| 文件 | 說明 |
|------|------|
| [pages.md](05-frontend/pages.md) | 頁面清單 |
| [insight-page.md](05-frontend/insight-page.md) | Insight 頁面設計（問題導向） |
| [components.md](05-frontend/components.md) | 元件清單 |
| [ui-guidelines.md](05-frontend/ui-guidelines.md) | UI 開發指引（Square UI） |

---

## 06-metrics 指標體系

> 詳細指標定義請參考 [06-metrics/INDEX.md](06-metrics/INDEX.md)

### 基礎 Rate 指標

| 文件 | 適用層級 | 說明 |
|------|----------|------|
| [engagement-rate.md](06-metrics/engagement-rate.md) | Both | 互動率 |
| [reply-rate.md](06-metrics/reply-rate.md) | Post | 回覆率（演算法王道） |
| [repost-rate.md](06-metrics/repost-rate.md) | Post | 轉發率 |
| [quote-rate.md](06-metrics/quote-rate.md) | Post | 引用率 |

### 綜合評分指標

| 文件 | 適用層級 | 說明 |
|------|----------|------|
| [virality-score.md](06-metrics/virality-score.md) | Post | 病毒傳播分數 |

### 成長類指標

| 文件 | 適用層級 | 說明 |
|------|----------|------|
| [early-velocity.md](06-metrics/early-velocity.md) | Post | 早期互動速度 |
| [growth-multiple.md](06-metrics/growth-multiple.md) | Post | 曝光成長倍數 |
| [follower-growth.md](06-metrics/follower-growth.md) | Account | 粉絲成長 |

---

## 開發指南 (guides/)

| 文件 | 說明 | 狀態 |
|------|------|------|
| [coding-best-practices.md](guides/coding-best-practices.md) | 程式設計最佳實踐與規範 | ✅ |
| [task-workflow.md](guides/task-workflow.md) | 任務管理流程 | ✅ |
| [telegram-notification.md](guides/telegram-notification.md) | Telegram 通知設定指南 | ✅ |
| [environment-variables.md](guides/environment-variables.md) | 環境變數設定指南 | ✅ |

---

## 參考文件 (references/)

| 文件 | 說明 | 狀態 |
|------|------|------|
| [design-tokens.md](references/design-tokens.md) | 設計 tokens（色彩、字型、間距） | ✅ |

---

## 品牌資源 (brand/)

| 文件 | 說明 | 狀態 |
|------|------|------|
| [visual-identity.md](brand/visual-identity.md) | 視覺識別規範（Zenivy 品牌色 + Square UI） | ✅ |

---

## 架構決策記錄 (decisions/)

| 編號 | 標題 | 狀態 |
|------|------|------|
| [ADR-001](decisions/001-sync-batch-timestamp.md) | 同步批次時間戳 (sync_batch_at) | ✅ 已採納 |
| [ADR-002](decisions/002-data-retention-rollup-strategy.md) | 資料保留與 Rollup 策略 | ✅ 已採納 |

---

## 任務追蹤 (tasks/)

| 文件 | 說明 |
|------|------|
| [TASKS.md](tasks/TASKS.md) | 當前進行中的任務 |
| [TASKS_BACKLOG.md](tasks/TASKS_BACKLOG.md) | 待辦/延後任務 |
| [TASKS_ARCHIVE.md](tasks/TASKS_ARCHIVE.md) | 已完成任務歸檔 |

---

## 三層式成效架構

成效數據採用三層式架構，確保資料完整性與查詢效率：

| Layer | 用途 | 特性 |
|-------|------|------|
| Layer 1 (L1) | Snapshot 快照 | 不可變、Single Source of Truth |
| Layer 3 (L3) | Current 當前 | 每次同步更新、快速查詢 |

> **註**：L2 Delta 已移除，成長率改由 L1 即時計算，避免冗餘儲存。

### 貼文成效

- L1: `workspace_threads_post_metrics`
- L3: `workspace_threads_posts.current_*`

### 帳號 Insights

- L1: `workspace_threads_account_insights`
- L3: `workspace_threads_accounts.current_*`

---

## 同步頻率

| 同步類型 | 頻率 | 文件 |
|----------|------|------|
| 貼文同步 | 每小時 00/15/30/45 | [sync-posts.md](04-backend/sync/sync-posts.md) |
| 貼文成效 | 每小時 00/15/30/45 | [sync-metrics.md](04-backend/sync/sync-metrics.md) |
| 帳號 Insights | 每小時 00/15/30/45 | [sync-account-insights.md](04-backend/sync/sync-account-insights.md) |
| 帳號 Profile | 手動/OAuth 後 | [sync-account-profile.md](04-backend/sync/sync-account-profile.md) |
| Token 刷新 | 每日 | [token-refresh.md](04-backend/sync/token-refresh.md) |

---

## Migration

| 文件 | 說明 |
|------|------|
| [20260110000001_initial_schema.sql](../supabase/migrations/20260110000001_initial_schema.sql) | 初始 Schema |
| [20260110000002_auto_create_default_workspace.sql](../supabase/migrations/20260110000002_auto_create_default_workspace.sql) | 新用戶自動建立預設 Workspace |
| [20260110000003_add_token_refresh_tracking.sql](../supabase/migrations/20260110000003_add_token_refresh_tracking.sql) | Token 刷新追蹤欄位 |
| [20260110000004_add_system_job_logs.sql](../supabase/migrations/20260110000004_add_system_job_logs.sql) | 系統任務記錄表 |
| [20260110000005_add_oauth_state_usage.sql](../supabase/migrations/20260110000005_add_oauth_state_usage.sql) | OAuth state 單次使用追蹤 |
| [20260110000006_add_rate_limiting.sql](../supabase/migrations/20260110000006_add_rate_limiting.sql) | Rate Limiting（DB-backed） |
| [20260110000007_harden_tokens_insert_policy.sql](../supabase/migrations/20260110000007_harden_tokens_insert_policy.sql) | 強化 tokens INSERT 政策 |
| [20260110000008_lock_down_sensitive_tables.sql](../supabase/migrations/20260110000008_lock_down_sensitive_tables.sql) | 鎖定 token/transfer 表 client 存取 |
| [20260110000009_enable_rls_rate_limit_counters.sql](../supabase/migrations/20260110000009_enable_rls_rate_limit_counters.sql) | rate_limit_counters 啟用 RLS |
| [20260110000010_add_system_job_locks.sql](../supabase/migrations/20260110000010_add_system_job_locks.sql) | system_job_locks（排程防重複執行） |
| [20260110000011_fix_rls_recursion.sql](../supabase/migrations/20260110000011_fix_rls_recursion.sql) | 修復 RLS 遞歸問題（新增 is_workspace_member 函數） |
| [20260110000012_setup_cron_jobs.sql](../supabase/migrations/20260110000012_setup_cron_jobs.sql) | Cron 排程設定（pg_cron + pg_net） |
| [20260111200001_create_tags_tables.sql](../supabase/migrations/20260111200001_create_tags_tables.sql) | 用戶自定義標籤系統 |

---

## 文件規範

### 命名規則

```
01-requirements/  → kebab-case.md
02-architecture/  → kebab-case.md
03-database/      → kebab-case.md
04-backend/       → kebab-case.md
05-frontend/      → kebab-case.md
guides/           → kebab-case.md
references/       → kebab-case.md
decisions/        → NNN-kebab-case.md（如 001-tech-stack.md）
```

### 狀態標記

| 標記 | 說明 |
|------|------|
| ✅ | 完成且維護中 |
| 📝 | 草稿/待完善 |
| 🚧 | 施工中 |
| ⚠️ | 需要更新 |
| 🗑️ | 待移除 |

### 原子化原則

```
一份文件 = 一個主題

✅ 正確：schema-overview.md（只包含 Schema 總覽）
❌ 錯誤：backend-guide.md（混合多個主題）
```

---

## 文件維護

### 新增文件流程

1. 確認主題在索引中不重複
2. 選擇正確的資料夾分類
3. 使用規定的命名規則
4. 建立文件並填入內容
5. **更新本索引的文件清單**

### 更新頻率

| 文件類型 | 更新時機 |
|----------|----------|
| 需求文件 | 需求變更時 |
| 架構文件 | 架構變更時 |
| 資料庫規格 | Schema 變更時 |
| 後端規格 | API/Function 變更時 |
| 前端規格 | UI/元件變更時 |
| 開發指南 | 流程調整時 |
| ADR | 重大決策時新增 |
| 任務文件 | 隨任務進度更新 |
