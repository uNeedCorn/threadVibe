# 當前任務

> 此文件追蹤目前進行中的任務。任務類型說明見 [task-workflow.md](../guides/task-workflow.md)。

## 進行中

<!-- 進行中的任務放這裡 -->

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
