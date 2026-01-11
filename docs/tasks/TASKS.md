# 當前任務

> 此文件追蹤目前進行中的任務。任務類型說明見 [task-workflow.md](../guides/task-workflow.md)。

## 進行中

### ARCH-01：資料保留與 Rollup 策略實作 [深夜]

**目標：** 實作 ADR-002 定義的分層資料保留與 Rollup 機制

**背景：** 參考 [ADR-002: 資料保留與 Rollup 策略](../decisions/002-data-retention-rollup-strategy.md)

**過渡策略：** 採用雙寫模式（Dual-Write），確保平滑過渡

---

**Phase 1：資料表建立** `可獨立執行，不影響現有系統` ✅ 完成

- [x] 建立 `workspace_threads_post_metrics_15m` 表
- [x] 建立 `workspace_threads_post_metrics_hourly` 表
- [x] 建立 `workspace_threads_post_metrics_daily` 表
- [x] 建立 `workspace_threads_account_insights_15m` 表
- [x] 建立 `workspace_threads_account_insights_hourly` 表
- [x] 建立 `workspace_threads_account_insights_daily` 表
- [x] 建立各表索引
- [x] 設定 RLS 政策

> Migration: `20260111100001_add_tiered_metrics_tables.sql`

---

**Phase 2a：同步邏輯修改 - 雙寫模式** `同時寫入新舊表` ✅ 完成

- [x] 新增 `getSyncFrequency()` 函數（依貼文年齡決定同步頻率）
- [x] 新增 `getTargetTable()` 函數（依貼文年齡決定寫入目標）
- [x] 修改 `sync-metrics`：
  - 維持寫入舊表（不變）
  - 新增寫入分層表邏輯
- [x] 修改 `sync-account-insights`：
  - 維持寫入舊表（不變）
  - 新增寫入分層表邏輯

> 新增檔案: `_shared/tiered-storage.ts`
> 修改檔案: `_shared/sync.ts`

---

**Phase 3：Rollup Jobs** `可與 Phase 2a 並行開發` ✅ 完成

- [x] 建立 `hourly_rollup` Edge Function
  - 每小時 :05 分執行
  - 15m → hourly rollup（取最後一筆）
- [x] 建立 `daily_rollup` Edge Function
  - 每日 01:00 UTC 執行
  - hourly → daily rollup（取最後一筆）
- [x] 設定 pg_cron 排程

> Edge Functions: `hourly-rollup/index.ts`, `daily-rollup/index.ts`
> Migration: `20260111100002_add_rollup_cron_jobs.sql`

---

**Phase 4：Cleanup Jobs** `可與 Phase 2a 並行開發` ✅ 完成

- [x] 建立 `metrics-cleanup` 統一清理函數
  - Post Metrics 15m：168h（系統保留，用戶存取 72h）
  - Post Metrics hourly：90 天
  - Post Metrics daily：365 天
  - Account Insights 15m：168h
  - Account Insights hourly：30 天
  - Account Insights daily：365 天
- [x] 設定 pg_cron 排程（每日 UTC 05:00）

> Edge Function: `metrics-cleanup/index.ts`
> Migration: `20260111100003_add_cleanup_cron_job.sql`
> 注意：15m 多保留 96h 作為系統緩衝，用於異常回滾

---

**驗證期（1-3 天）** `確認新表資料正確`

- [ ] 比對新舊表數據一致性
- [ ] 驗證 Rollup 結果正確
- [ ] 監控同步效能

---

**Phase 5：前端切換** `驗證通過後執行`

- [ ] 修改趨勢圖查詢（根據時間範圍選擇對應粒度表）
- [ ] 新增 API 層方案存取控制
- [ ] 測試前端功能正常

---

**Phase 2b：停止雙寫** `前端切換成功後執行`

- [ ] 移除 `sync-metrics` 寫入舊表的邏輯
- [ ] 移除 `sync-account-insights` 寫入舊表的邏輯
- [ ] 修改 `scheduled-sync` 排程邏輯（依頻率分組）

---

**Phase 6：Legacy 處理**

- [ ] 標記現有 `workspace_threads_post_metrics` 為 legacy
- [ ] 標記現有 `workspace_threads_account_insights` 為 legacy
- [ ] 更新文件

---

**回滾計劃：**

若新表出現問題：
1. 前端切回讀取舊表
2. 停止寫入新表
3. 修復問題後重新開始

**驗收標準：**

1. 雙寫期間：新舊表數據一致
2. 新貼文（72h 內）每 15 分鐘同步，寫入 15m 表
3. 舊貼文依年齡降頻同步，寫入對應粒度表
4. Rollup Job 正確產生 hourly/daily 資料
5. Cleanup Job 正確清除過期資料
6. 前端趨勢圖正常顯示

**相關文件：**
- [ADR-002](../decisions/002-data-retention-rollup-strategy.md)
- [schema-overview.md](../03-database/schema-overview.md)

---

## 待開始

### FE-01：登入頁面 [普通]

**目標：** 實作 Google OAuth 登入頁面

**需求：**
- 頁面元素：Logo + 產品名稱標語 + Google 登入按鈕 + 說明文字 + 條款連結
- 未登入用戶訪問任何頁面 → 導向登入頁
- 登入後導向邏輯：
  - 已連結 Threads 帳號 → `/dashboard`
  - 未連結 Threads 帳號 → `/settings`

**相關文件：** [pages.md](../05-frontend/pages.md)

---

### FE-02：主要介面 Layout [普通]

**目標：** 實作需登入頁面的共用 Layout

**需求：**
- Sidebar：
  - 頂部：Logo + Workspace 切換（支援多 Workspace）
  - 導航：Dashboard / 貼文 / Insights / 設定
- Header：用戶頭像下拉 + 登出按鈕
- 響應式：桌面展開 / 平板可收合 / 手機漢堡選單

**相關文件：** [pages.md](../05-frontend/pages.md), [components.md](../05-frontend/components.md)

---

### FE-03：設定頁面 [普通]

**目標：** 實作單頁式設定頁面

**需求：**
- 區塊 1：Threads 帳號管理（多帳號、連結/重新授權/解除）
- 區塊 2：Workspace 設定（名稱修改）
- 區塊 3：成員管理（邀請/變更角色/移除）
- 區塊 4：危險區域（刪除 Workspace）

**相關文件：** [pages.md](../05-frontend/pages.md)

---

### FE-04：貼文列表 [普通]

**目標：** 實作表格式貼文列表頁面

**需求：**
- 列表樣式：表格式 + 無限捲動
- 顯示欄位：內容預覽、媒體縮圖、帳號名稱、發布時間、Views/Likes/Replies/Reposts/Quotes、最後更新時間
- 篩選：時間範圍 / 帳號 / 媒體類型
- 排序：發布時間 + 各項指標皆可排序

**相關文件：** [pages.md](../05-frontend/pages.md), [components.md](../05-frontend/components.md)

---

## 本週完成

### FE-05：Dashboard 頁面 [普通]

**完成日期：** 2026-01-11

**目標：** 實作 Dashboard 總覽頁面

**完成內容：**
1. **KPI 卡片**（`components/dashboard/kpi-card.tsx`）
   - 總粉絲數、本週觀看數、本週互動數、本週貼文數
   - 顯示與前期比較的增減趨勢

2. **趨勢圖表**（`components/dashboard/trend-chart.tsx`）
   - 7 天觀看數趨勢折線圖
   - 支援多帳號比較（不同顏色線條）
   - 使用 Recharts + shadcn/ui Chart

3. **熱門貼文**（`components/dashboard/top-posts.tsx`）
   - 按觀看數排序的 Top 5 貼文

4. **最新貼文**（`components/dashboard/recent-posts.tsx`）
   - 最近發布的 5 篇貼文

5. **帳號切換 Tabs**
   - 支援「全部帳號」及個別帳號篩選

**修正問題：**
- 修正 Supabase 欄位名稱（`current_followers` → `current_followers_count`）
- 修正趨勢圖表線條不顯示問題（CSS 變數 → 實際 hex 顏色）
- 修正資料載入邏輯避免無限迴圈

**相關檔案：**
- `app/(auth)/dashboard/page.tsx`
- `components/dashboard/` 目錄
- `components/ui/tabs.tsx`（新增 shadcn/ui Tabs）

---

### BE-01：OAuth Callback 同步 Insights [深夜]

**完成日期：** 2026-01-11

**目標：** 在 Threads OAuth 完成後自動同步帳號 Insights

**完成內容：**
- 修改 `threads-oauth-callback` Edge Function
- OAuth 完成後呼叫 `getUserInsights()` 取得粉絲數
- 寫入 Layer 3（`workspace_threads_accounts.current_followers_count`）
- 寫入 Layer 1 Snapshot（`workspace_threads_account_insights`）

**⚠️ Threads API 限制：**
- 追蹤數 < 100 的帳號無法取得 Insights 資料（followers_count, views, likes 等）
- 此為 Meta 官方限制，非程式問題

**相關檔案：**
- `supabase/functions/threads-oauth-callback/index.ts`

---

### FIX-01：修復 RLS 遞歸與前端查詢錯誤 [深夜]

**完成日期：** 2026-01-10

**問題：**
- RLS 政策造成遞歸（workspaces ↔ workspace_members 互相查詢導致 500 錯誤）
- 前端查詢了不存在的資料庫欄位（導致 400 錯誤）

**解決方案：**
1. 新增 `is_workspace_member(uuid)` SECURITY DEFINER 函數繞過 RLS
2. 更新 workspaces、workspace_members、workspace_threads_accounts 的 SELECT 政策
3. 修正前端元件查詢欄位：
   - `workspace-switcher.tsx`: `created_at` → `joined_at`
   - `members-section.tsx`: 移除不存在的 `id`、`created_at` → `joined_at`
   - `threads-accounts-section.tsx`: `profile_picture_url` → `profile_pic_url`、移除 `token_status`
   - `posts/page.tsx`: 移除 `thumbnail_url`、修正 join 查詢

**相關文件：**
- Migration: `20260110000011_fix_rls_recursion.sql`
- RLS 政策: [rls-policies.md](../03-database/rls-policies.md)

---

<!-- 本週完成的任務，週末時移至 TASKS_ARCHIVE.md -->
