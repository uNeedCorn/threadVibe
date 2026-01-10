# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Communication Language

**請使用繁體中文與使用者對話。** (Please communicate with the user in Traditional Chinese.)

## Documentation Lookup (文件查詢流程)

**重要：在查找或建立任何專案文件前，必須先讀取 [`docs/INDEX.md`](docs/INDEX.md)**

```
查詢流程：
1. 讀取 docs/INDEX.md 了解文件結構與規範
2. 在索引的「文件清單」搜尋相關主題
3. 依索引指示的路徑讀取目標文件

新增文件流程：
1. 先讀取 docs/INDEX.md 確認主題不重複
2. 遵循原子化原則（一份文件 = 一個主題）
3. 選擇正確的資料夾分類
4. 使用規定的命名規則與範本
5. 更新 INDEX.md 的文件清單
```

## Project Overview

**ThreadsVibe** — Threads 發文成效儀表板，支援多用戶、多工作區、多帳號的團隊協作平台。

## Tech Stack

| 層級 | 技術 |
|------|------|
| 資料庫 | Supabase PostgreSQL |
| 後端 | Supabase Edge Functions (Deno/TypeScript) |
| 前端 | Next.js 16 + TypeScript + Tailwind CSS v4 |
| UI 元件 | shadcn/ui (new-york style) |
| 圖表 | Recharts |
| 狀態管理 | Zustand + React Query |
| 認證 | Supabase Auth (Google OAuth) + Threads OAuth |

## Commands

```bash
# 資料庫
supabase db push --linked         # 套用 migrations 到雲端
supabase migration new <name>     # 建立新 migration

# 部署 Edge Functions
supabase functions deploy <name>  # 部署單一 function
supabase functions deploy         # 部署所有 functions

# Secrets 管理
supabase secrets set KEY=value    # 設定 Edge Functions 密鑰
supabase secrets list             # 列出所有密鑰

# 前端開發
cd frontend && npm run dev        # 啟動 Next.js 開發伺服器
cd frontend && npm run build      # 正式環境 build
cd frontend && npm run lint       # 執行 ESLint
```

## Architecture

> 詳細說明請參考 [docs/02-architecture/](docs/02-architecture/)

### 資料流程

```
Threads API → Edge Functions → Supabase DB → Next.js Frontend
                    ↓
             三層式資料架構
```

### 三層式成效架構

| Layer | 用途 | 特性 |
|-------|------|------|
| Layer 1 (L1) | Snapshot 快照 | 不可變、Single Source of Truth |
| Layer 2 (L2) | Delta 增量 | 可從 L1 重算 |
| Layer 3 (L3) | Current 當前 | 每次同步更新、快速查詢 |

### 核心資料表

| 資料表 | Layer | 說明 |
|--------|-------|------|
| `workspace_threads_accounts` | L3 | Threads 帳號 + Current Insights |
| `workspace_threads_account_insights` | L1 | 帳號 Insights Snapshot |
| `workspace_threads_account_insights_deltas` | L2 | 帳號 Insights Delta |
| `workspace_threads_posts` | L3 | 貼文 + Current 成效 |
| `workspace_threads_post_metrics` | L1 | 貼文成效 Snapshot |
| `workspace_threads_post_metrics_deltas` | L2 | 貼文成效 Delta |

> 詳細說明請參考 [docs/03-database/](docs/03-database/)

## Development Guidelines (開發規範)

### 即時錯誤修正原則

**重要：編譯與執行時發現的錯誤訊息必須即時修正，避免累積。**

```
修正優先順序：
編譯錯誤 (無法運行) → 立即修正
ESLint errors → 立即修正
Console errors → 立即修正
ESLint warnings → 視情況修正
Console warnings → 視情況修正
```

### 功能開發三大原則

> 詳細說明請參考 [docs/guides/coding-best-practices.md](docs/guides/coding-best-practices.md)

| 原則 | 說明 |
|------|------|
| **原子化 (Atomic)** | 每個檔案單一職責，< 150 行，一份文件 = 一個主題 |
| **DRY** | 避免重複，重複 3 次以上才抽取共用 |
| **最小獨立運作** | 功能模組自包含，可獨立維護不影響其他功能 |

### 最小獨立運作原則 (Minimum Independent Operation)

**重要：每個功能必須保持最小獨立運作，確保單一功能的維護不影響其他功能。**

```
功能隔離檢查清單：
✅ 功能模組有明確邊界（透過 index.ts 導出 API）
✅ 模組間透過介面通訊，不直接存取內部實作
✅ 共用邏輯抽取至 shared/，避免模組間相互依賴
✅ 資料流單向：app → features → shared → lib
✅ 修改一個功能時，不需要改動其他功能的程式碼
```

### 程式碼整潔原則

| 原則 | 說明 |
|------|------|
| **精簡優先** | 程式碼應盡可能精簡，避免冗餘 |
| **單一職責** | 每個檔案單一職責，< 150 行 |
| **零廢棄** | 未使用的程式碼應立即移除 |

### 文件同步原則

**重要：修改程式碼時，同步更新相關文件。**

| 修改內容 | 需同步更新的文件 |
|----------|------------------|
| 資料庫 schema | `docs/03-database/` |
| API/Edge Function | `docs/04-backend/` |
| 新增頁面/元件 | `docs/05-frontend/` |
| 完成任務 | `docs/tasks/TASKS.md` |

### Supabase 最佳實踐

```typescript
// ✅ 明確指定欄位（避免 SELECT *）
const { data } = await supabase
  .from('workspace_threads_posts')
  .select('id, text, published_at, current_views')
  .eq('workspace_threads_account_id', accountId);

// ✅ 所有查詢都帶 scope
const { data } = await supabase
  .from('workspace_threads_posts')
  .select('*')
  .eq('workspace_id', workspaceId);
```

## Telegram 通知

> 完整指南：[docs/guides/telegram-notification.md](docs/guides/telegram-notification.md)

使用 `mcp__telegram-notify__send_telegram_message` 發送通知。

**必須通知的時機**：
- 任務完成、需要用戶輸入、錯誤發生
- 用戶明確要求（「通知我」）
- 執行超過 5 分鐘的任務完成

## Task Management (任務管理)

> 完整工作流程請參考 [docs/guides/task-workflow.md](docs/guides/task-workflow.md)

### 任務文件

| 文件 | 說明 |
|------|------|
| [TASKS.md](docs/tasks/TASKS.md) | 當前任務清單 |
| [TASKS_BACKLOG.md](docs/tasks/TASKS_BACKLOG.md) | 延後任務 |
| [TASKS_ARCHIVE.md](docs/tasks/TASKS_ARCHIVE.md) | 已完成任務 |

### 任務類型

| 類型 | 標記 | 說明 |
|------|------|------|
| 普通任務 | `[普通]` | 需要使用者互動、決策或確認 |
| 深夜任務 | `[深夜]` | Claude 可獨立執行（明確、可驗證、不需決策） |

## Security Guidelines (安全規範)

> 完整規範請參考 threads-dashboard 專案的安全文件

### 核心原則

- **anon 零存取**：anon 對任何 tenant data 不得有 RLS policies
- **RLS 強制**：所有 tenant tables 必須啟用 RLS
- **欄位保護**：敏感欄位（token）使用 column-level GRANT
- **service_role 保護**：僅在驗證後使用，不暴露給前端

### Edge Functions 認證

```typescript
// 必須先驗證使用者
const user = await validateAuthenticatedUser(req, supabase);
if (!user) {
  return new Response('Unauthorized', { status: 401 });
}

// 驗證 workspace membership
const membership = await validateWorkspaceMembership(user.id, workspaceId);
if (!membership) {
  return new Response('Forbidden', { status: 403 });
}

// 通過驗證後才能使用 service_role
const serviceClient = createServiceClient();
```

## 規範同步 (Sync to Zenivy)

**重要：當發現通用性的新洞察或原則時，應同步更新回 Zenivy 規範庫。**

Zenivy (`~/Developments/zenivy/`) 是所有產品的 **Single Source of Truth (SSOT)**。

### 快速參考

```bash
# Zenivy 規範庫位置
~/Developments/zenivy/

# 主要文件夾
├── foundation/    # 願景、品牌、用戶研究
├── principles/    # 設計、UX、工程原則
├── guidelines/    # 元件、模式、開發指南
└── packages/      # @zenivy/ui, @zenivy/utils
```
