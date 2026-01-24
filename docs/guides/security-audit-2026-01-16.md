# 安全弱點掃描報告

> **掃描日期**：2026-01-16
> **掃描範圍**：完整程式碼與功能安全審計
> **狀態**：📝 待逐項修正

---

## 執行摘要

| 類別 | Critical | High | Medium | Low | 總計 |
|------|----------|------|--------|-----|------|
| 認證與授權 | 0 | 4 | 7 | 2 | 13 |
| 資料庫安全 | 2 | 3 | 4 | 0 | 9 |
| API/Edge Functions | 0 | 1 | 3 | 7 | 11 |
| 前端安全 | 2 | 2 | 4 | 2 | 10 |
| 密鑰管理 | 1 | 2 | 0 | 1 | 4 |
| 依賴套件 | 0 | 0 | 0 | 0 | 0 |
| 業務邏輯 | 1 | 2 | 3 | 4 | 10 |
| **總計** | **6** | **14** | **21** | **16** | **57** |

**整體安全評分：55/100** ⚠️

---

## 目錄

1. [CRITICAL 問題](#1-critical-問題需立即修復)
2. [HIGH 問題](#2-high-問題本週內修復)
3. [MEDIUM 問題](#3-medium-問題下月內修復)
4. [LOW 問題](#4-low-問題長期改進)
5. [做得好的地方](#5-做得好的地方)
6. [修復優先順序](#6-修復優先順序)

---

## 1. CRITICAL 問題（需立即修復）

### SEC-C01: `.env.local` 暴露真實 Supabase 金鑰

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟢 LOW（Private repo + 單人開發） |
| **類別** | 密鑰管理 |
| **狀態** | ⏸️ 暫緩（風險可控） |

#### 問題描述

`.env.local` 檔案包含真實的 Supabase JWT 令牌：

```
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
```

#### 影響範圍

- `SUPABASE_SERVICE_ROLE_KEY` 可繞過所有 RLS 存取完整資料庫
- 任何有 Git 存取權的人都能獲得完整資料庫訪問權限
- 金鑰會永久保存在 Git 歷史中

#### 檔案位置

```
frontend/.env.local
```

#### 修復步驟

1. **立即**在 Supabase Dashboard 吊銷並重新生成金鑰
   - Project Settings → API → Keys and tokens → Regenerate
2. 從 Git 歷史中移除：
   ```bash
   # 使用 git-filter-repo（推薦）
   pip install git-filter-repo
   git filter-repo --invert-paths --path frontend/.env.local

   # 或使用 BFG Repo-Cleaner
   bfg --delete-files .env.local
   ```
3. 確認 `.env.local` 已在 `.gitignore` 中（已正確配置）
4. 設定 pre-commit hook 防止提交環境檔案

#### 驗證方式

```bash
# 確認 .env.local 不在 Git 追蹤中
git ls-files | grep .env.local
# 應該沒有輸出

# 確認 .gitignore 包含 .env.local
grep ".env.local" frontend/.gitignore
```

---

### SEC-C02: 邀請碼欄位名稱不匹配

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟢 LOW（功能未啟用） |
| **類別** | 業務邏輯 |
| **狀態** | ⏸️ 暫緩（功能暫停使用） |

> **暫緩原因**：邀請碼功能目前暫停使用，待重新啟用時再一併修正。

#### 問題描述

前端程式碼更新一個不存在的欄位 `used_by_user_id`，但資料庫實際欄位名稱是 `used_by`。

#### 影響範圍

- 邀請碼不會被正確標記為已使用
- **同一邀請碼可被無限次重複使用**
- 使用者配額控制完全失效

#### 檔案位置

```
frontend/app/auth/callback/route.ts:107
supabase/migrations/20260113003606_add_invitation_codes.sql:11
```

#### 問題程式碼

```typescript
// frontend/app/auth/callback/route.ts:107
// ❌ 錯誤：欄位名稱不匹配
.update({
  is_used: true,
  used_by_user_id: user.id,  // 資料庫欄位是 used_by
  used_at: new Date().toISOString()
})
```

```sql
-- 資料庫定義
-- supabase/migrations/20260113003606_add_invitation_codes.sql:11
used_by UUID REFERENCES auth.users(id),  -- 正確欄位名
```

#### 修復步驟

```typescript
// ✅ 修正：使用正確的欄位名稱
.update({
  is_used: true,
  used_by: user.id,  // 改為 used_by
  used_at: new Date().toISOString()
})
```

#### 驗證方式

```sql
-- 檢查邀請碼是否正確標記
SELECT code, is_used, used_by, used_at
FROM invitation_codes
WHERE code = 'TEST_CODE';

-- used_by 應該有值，不應該是 NULL
```

---

### SEC-C03: Profiles 表 RLS 過於寬鬆

| 項目 | 內容 |
|------|------|
| **風險等級** | 🔴 CRITICAL |
| **類別** | 資料庫安全 |
| **狀態** | ✅ 已修正（2026-01-19） |

#### 問題描述

RLS 政策使用 `USING (true)` 允許任何登入用戶查看所有人的 profile。

#### 影響範圍

- 任何已登入用戶可查看所有用戶的 email、display_name、avatar_url
- 可能導致用戶 enumeration 攻擊
- 隱私洩露（用戶發現平台的所有已註冊用戶）

#### 檔案位置

```
supabase/migrations/20260115144535_create_profiles_table.sql:24-27
```

#### 問題程式碼

```sql
-- ❌ 過於寬鬆
CREATE POLICY "Authenticated users can view profiles"
ON profiles FOR SELECT
TO authenticated
USING (true);  -- 允許任何人查看任何 profile
```

#### 修復步驟

建立新的 migration 修正 RLS：

```sql
-- migrations/YYYYMMDDHHMMSS_fix_profiles_rls.sql

-- 移除舊政策
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;

-- 建立新政策：只能查看自己或同 workspace 成員的 profile
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Users can view profiles in shared workspaces"
ON profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM workspace_members wm1
    JOIN workspace_members wm2 ON wm1.workspace_id = wm2.workspace_id
    WHERE wm1.user_id = profiles.id
    AND wm2.user_id = auth.uid()
    AND wm1.joined_at IS NOT NULL
    AND wm2.joined_at IS NOT NULL
  )
);
```

#### 驗證方式

```sql
-- 以用戶 A 的身份查詢
-- 應該只能看到自己和同 workspace 成員的 profile
SELECT * FROM profiles;

-- 嘗試查詢不相關用戶的 profile 應該失敗
SELECT * FROM profiles WHERE id = 'unrelated-user-uuid';
```

#### 修正內容（2026-01-19）

Migration: `20260119100001_fix_profiles_rls_security.sql`

1. 建立 `is_system_admin()` helper 函數
2. 移除舊的 `USING (true)` 政策
3. 新增三個 RLS 政策：
   - `Users can view own profile`: 只能查看自己
   - `Users can view profiles in shared workspaces`: 可查看同 workspace 成員
   - `System admins can view all profiles`: 系統管理員可查看全部

---

### SEC-C04: Scheduled Posts RLS 洩露草稿

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟢 LOW（目前無 viewer 角色） |
| **類別** | 資料庫安全 |
| **狀態** | ⏸️ 暫緩（風險可控） |

> **暫緩原因**：目前所有 workspace 成員皆為 `owner` 角色，尚未實作 `editor`/`viewer` 角色管理功能。待未來實作角色管理時再一併處理。

#### 問題描述

RLS 政策允許所有 workspace 成員（包括 viewer）查看所有貼文，包括 owner/editor 的草稿。

#### 影響範圍

- Viewer 可查看 Owner/Editor 的草稿貼文
- 未發布的內容洩露
- 違反最小權限原則

#### 檔案位置

```
supabase/migrations/20260113205224_create_scheduled_posts.sql:39-78
supabase/migrations/20260115152221_refactor_outbound_posts_architecture.sql
```

#### 問題程式碼

```sql
-- ❌ Viewer 可看所有貼文
CREATE POLICY "Users can view scheduled posts in their workspaces"
ON workspace_threads_scheduled_posts
FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);
```

#### 修復步驟

```sql
-- migrations/YYYYMMDDHHMMSS_fix_scheduled_posts_rls.sql

-- 移除舊政策
DROP POLICY IF EXISTS "Users can view scheduled posts in their workspaces"
ON workspace_threads_scheduled_posts;

-- 新政策：Owner/Editor 可看所有，Viewer 只能看已發布的
CREATE POLICY "Editors can view all scheduled posts"
ON workspace_threads_scheduled_posts
FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'editor')
    AND joined_at IS NOT NULL
  )
);

CREATE POLICY "Viewers can see published posts only"
ON workspace_threads_scheduled_posts
FOR SELECT
USING (
  publish_status = 'published'
  AND workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
    AND joined_at IS NOT NULL
  )
);
```

對 `workspace_threads_outbound_posts` 表也需要相同的修正。

---

### SEC-C05: Service Role Key 在前端 API 暴露

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟢 LOW（實際為 Server-side） |
| **類別** | 前端安全 / 密鑰管理 |
| **狀態** | ⏸️ 暫緩（風險可控） |

> **暫緩原因（2026-01-19 確認）**：
> 1. 這是 Next.js API Route（Server-side），不會洩露到前端
> 2. Server-to-Supabase 的 HTTPS 加密連線，不經過用戶瀏覽器
> 3. Edge Function 有 `verify_jwt: true` 保護
> 4. Telegram 通知發送到管理員個人聊天室，即使被濫用也僅是收到垃圾通知
> 5. 唯一問題是「權限過高」，但實際風險極低

#### 問題描述

前端 API 路由在 HTTP Header 中直接傳輸最高權限金鑰。

#### 影響範圍

- Service role key 在網路傳輸中暴露
- 可能通過 source map 洩露到前端
- 如果 API 日誌被記錄，令牌可能被洩露

#### 檔案位置

```
frontend/app/api/waitlist/route.ts:4-5, 161
```

#### 問題程式碼

```typescript
// ❌ 直接使用 service role key 作為 Bearer token
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const response = await fetch(`${SUPABASE_URL}/functions/v1/waitlist-notification`, {
  headers: {
    "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  },
});
```

#### 修復步驟

```typescript
// ✅ 改用 createServiceClient()
import { createServiceClient } from '@/lib/supabase/server';

// 在需要 service role 的地方
const serviceClient = createServiceClient();

// 或改用 Edge Function 內部調用
// 前端 API 只負責驗證用戶，然後轉發請求
```

---

### SEC-C06: 硬編碼 Supabase URL

| 項目 | 內容 |
|------|------|
| **風險等級** | 🔴 CRITICAL |
| **類別** | 密鑰管理 |
| **狀態** | ✅ 已修正（2026-01-17） |

#### 問題描述

多個前端腳本在環境變數未設定時，使用硬編碼的 Supabase URL。

#### 影響範圍

- Supabase Project ID 被暴露
- 攻擊者可以識別您的 Supabase 實例

#### 檔案位置

```
frontend/scripts/import-historical-data.ts:13
frontend/scripts/recalculate-deltas.ts:12
frontend/scripts/backfill-snapshot-rates.ts:10
```

#### 問題程式碼

```typescript
// ❌ 硬編碼 URL
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  || 'https://emlclhiaqbkuvztlkfbh.supabase.co';
```

#### 修復步驟

```typescript
// ✅ 強制要求環境變數
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (!SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
}
```

---

## 2. HIGH 問題（本週內修復）

### SEC-H01: Token 移轉缺乏目標用戶確認

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟠 HIGH |
| **類別** | 認證與授權 |
| **狀態** | ⬜ 待修正 |

#### 問題描述

Token 移轉端點只驗證目標用戶是否為 workspace 成員，但沒有驗證目標用戶是否同意接收 token。

#### 影響範圍

攻擊者可能通過偽造移轉請求來強制接收他人的 Threads token。

#### 檔案位置

```
supabase/functions/token-transfer-initiate/index.ts:72-92
```

#### 修復建議

1. 添加目標用戶的確認機制（發送確認通知）
2. 在 token_transfers 表中記錄發起者和時間戳
3. 實施審計日誌記錄所有 token 移轉操作
4. 考慮添加 2FA 確認 token 移轉

---

### SEC-H02: Token 加密金鑰無輪換機制

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟠 HIGH |
| **類別** | 認證與授權 |
| **狀態** | ⬜ 待修正 |

#### 問題描述

使用 `ENCRYPTION_SECRET` 環境變數來加密 token，但沒有：
- 金鑰輪換機制
- 加密算法版本管理文件
- 備份和恢復程序

#### 檔案位置

```
supabase/functions/_shared/crypto.ts
```

#### 修復建議

1. 實施金鑰管理系統（KMS）而非環境變數
2. 定期（每 3-6 個月）輪換加密金鑰
3. 為舊金鑰保留支援以解密舊資料
4. 文件化金鑰輪換流程
5. 考慮使用 Supabase 的 Vault 功能存儲敏感信息

---

### SEC-H03: Threads OAuth Callback 驗證不完整

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟠 HIGH |
| **類別** | 認證與授權 |
| **狀態** | ⬜ 待修正 |

#### 問題描述

Callback 端點檢查了 state 簽章，但沒有驗證 state 中嵌入的 userId 和 workspace_id 是否與當前用戶匹配。

#### 檔案位置

```
supabase/functions/threads-oauth-callback/index.ts:65-76
```

#### 修復建議

1. 驗證 state 中的 userId 與當前登入用戶一致
2. 驗證 state 中的 workspace_id 對當前用戶有效
3. 對 callback 端點實施速率限制
4. 記錄所有 callback 失敗的嘗試

---

### SEC-H04: 邀請碼 Cookie 無 HttpOnly/Secure

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟢 LOW（功能未啟用） |
| **類別** | 前端安全 |
| **狀態** | ⏸️ 暫緩（邀請碼功能暫停使用） |

#### 問題描述

邀請碼從 HTTP Cookie 中讀取，但 Cookie 設定不安全。

#### 檔案位置

```
frontend/app/login/page.tsx:65
frontend/app/auth/callback/route.ts:36-42
```

#### 問題程式碼

```typescript
// ❌ 缺少安全 flags
document.cookie = `invitation_code=${inviteCode}; path=/; max-age=3600; SameSite=Lax`;
```

#### 修復步驟

```typescript
// ✅ 改為使用安全的 HTTP-only cookie（由伺服器設定）
// 在 API route 中設定
response.cookies.set('invitation_code', code, {
  httpOnly: true,    // 防止 JavaScript 訪問
  secure: true,      // 僅 HTTPS 傳輸
  sameSite: 'strict', // 防止 CSRF
  maxAge: 3600,
  path: '/'
});
```

---

### SEC-H05: handle_new_user() 缺少 search_path

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟠 HIGH |
| **類別** | 資料庫安全 |
| **狀態** | ✅ 已修正（2026-01-19） |

#### 問題描述

SECURITY DEFINER 函數缺少 `SET search_path = public`，可能導致 SQL injection。

#### 檔案位置

```
supabase/migrations/20260115144535_create_profiles_table.sql:49
```

#### 問題程式碼

```sql
-- ❌ 缺少 search_path
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (...)
  VALUES (...)
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### 修復步驟

```sql
-- ✅ 添加 search_path
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (...)
  VALUES (...)
END;
$$;
```

---

### SEC-H06: generate_invitation_code() 缺 search_path

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟢 LOW（功能未啟用） |
| **類別** | 資料庫安全 |
| **狀態** | ⏸️ 暫緩（邀請碼功能暫停使用） |

#### 問題描述

`generate_invitation_code()` 和 `use_invitation_code()` 函數缺少 `SET search_path = public`。

#### 檔案位置

```
supabase/migrations/20260113003606_add_invitation_codes.sql
```

#### 修復步驟

同 SEC-H05，為所有 SECURITY DEFINER 函數添加 `SET search_path = public`。

---

### SEC-H07: Outbound Posts RLS 過於寬鬆

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟢 LOW（目前無 viewer 角色） |
| **類別** | 資料庫安全 |
| **狀態** | ⏸️ 暫緩（風險可控） |

> **暫緩原因**：同 SEC-C04，目前所有成員皆為 `owner`，待實作角色管理時再處理。

#### 問題描述

同 SEC-C04，`workspace_threads_outbound_posts` 表繼承了過寬鬆的 RLS 政策。

#### 檔案位置

```
supabase/migrations/20260115152221_refactor_outbound_posts_architecture.sql
```

#### 修復步驟

同 SEC-C04 的修復方式。

---

### SEC-H08: 邀請碼 Race Condition

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟢 LOW（功能未啟用） |
| **類別** | 業務邏輯 |
| **狀態** | ⏸️ 暫緩（邀請碼功能暫停使用） |

#### 問題描述

`use_invitation_code()` 函數沒有使用 `FOR UPDATE` 鎖定來防止並發讀取，兩個並發請求可能同時使用同一邀請碼。

#### 攻擊場景

```
時間線：
T1: 用戶A 呼叫 use_invitation_code('CODE123')
T2: 用戶B 呼叫 use_invitation_code('CODE123')
T1.1: A 的 validate 檢查通過（is_used=false）
T2.1: B 的 validate 檢查通過（is_used=false）
T1.2: A 更新 is_used=true
T2.2: B 更新 is_used=true（都返回 true）
結果：同一邀請碼被2個用戶使用！
```

#### 檔案位置

```
supabase/migrations/20260113003606_add_invitation_codes.sql:146-151
```

#### 修復步驟

```sql
-- ✅ 使用 FOR UPDATE 鎖定
UPDATE invitation_codes
SET is_used = TRUE,
    used_by = p_user_id,
    used_at = now()
WHERE code = upper(trim(p_code))
  AND is_used = FALSE
RETURNING id INTO v_id;

-- 或使用 SELECT FOR UPDATE 先鎖定
SELECT id INTO v_id
FROM invitation_codes
WHERE code = upper(trim(p_code))
  AND is_used = FALSE
FOR UPDATE SKIP LOCKED;

IF NOT FOUND THEN
  RETURN FALSE;
END IF;

UPDATE invitation_codes
SET is_used = TRUE, used_by = p_user_id, used_at = now()
WHERE id = v_id;
```

---

### SEC-H09: 公開驗證端點洩露邀請碼狀態

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟢 LOW（功能未啟用） |
| **類別** | 業務邏輯 |
| **狀態** | ⏸️ 暫緩（邀請碼功能暫停使用） |

#### 問題描述

`/api/invitation/validate-public` 允許任何人驗證邀請碼狀態，洩露邀請碼是否存在、是否已使用、是否過期。

#### 影響範圍

- 攻擊者可通過訊息推測邀請碼是否存在
- 可用於列舉攻擊（Enumeration Attack）
- 結合 Race Condition 可搶先使用邀請碼

#### 檔案位置

```
frontend/app/api/invitation/validate-public/route.ts
```

#### 修復步驟

1. 統一錯誤訊息，不區分原因：
   ```typescript
   if (!invitation || invitation.is_used || isExpired) {
     return { valid: false, error: "邀請碼無效或已使用" };
   }
   ```
2. 實現速率限制防止暴力破解
3. 記錄失敗的驗證嘗試

---

### SEC-H10: CSP 允許 unsafe-inline/unsafe-eval

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟡 MEDIUM（XSS 風險本身低） |
| **類別** | 前端安全 |
| **狀態** | ⏸️ 暫緩（修復成本高） |

#### 問題描述

CSP 配置允許 `'unsafe-inline'` 和 `'unsafe-eval'`，無法防止 DOM-based XSS。

#### 檔案位置

```
frontend/next.config.ts:45
```

#### 問題程式碼

```typescript
// ❌ 過於寬鬆
"script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
```

#### 修復步驟

```typescript
// ✅ 移除 unsafe-inline 和 unsafe-eval
// 使用 Nonce 或 CSP hash
"script-src 'self' https://challenges.cloudflare.com"
```

#### 暫緩原因（2026-01-19 確認）

**需要 unsafe-inline/eval 的原因**：

| 元件 | 原因 |
|------|------|
| Next.js | React hydration、開發模式需要 |
| Tailwind CSS | 動態生成的樣式 |
| Cloudflare Turnstile | 驗證碼可能用 inline script |
| Recharts | 圖表庫可能使用 eval |

**風險評估**：
1. 網站沒有用戶輸入直接渲染 HTML 的地方，XSS 風險本身就低
2. 修復需要使用 nonce/hash 機制，成本高
3. 需要逐一測試所有頁面功能，可能影響第三方套件運作
4. 屬於「錦上添花」的安全強化，非必要修復

---

### SEC-H11: CORS 預設允許 wildcard origin

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟢 LOW（已設定白名單） |
| **類別** | API 安全 |
| **狀態** | ⏸️ 暫緩（風險可控） |

> **暫緩原因（2026-01-19 確認）**：
> 1. `ALLOWED_ORIGINS` 和 `FRONTEND_URL` 已正確設定
> 2. 有 Origin header 的請求會檢查白名單，不符則拒絕
> 3. 無 Origin header 返回 `*` 是給 Cron Job、Server-to-Server 呼叫使用
> 4. 若改成嚴格模式，pg_cron 觸發的 Edge Function 會全部失敗

#### 問題描述

當 `ALLOWED_ORIGINS` 環境變數未設定時，CORS 會接受來自**任何 origin** 的請求。

#### 檔案位置

```
supabase/functions/_shared/cors.ts:40-49
```

#### 問題程式碼

```typescript
// ❌ 預設為 wildcard
let allowOrigin = '*';
if (requestOrigin) {
  if (allowedOrigins.length === 0) {
    allowOrigin = requestOrigin;  // 無條件接受任何 origin
  }
}
```

#### 修復步驟

```typescript
// ✅ 預設拒絕
let allowOrigin = 'null';
if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
  allowOrigin = requestOrigin;
}
// 永不允許 wildcard，除非明確配置
```

---

## 3. MEDIUM 問題（下月內修復）

### SEC-M01: OAuth State 過期時間過短

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟡 MEDIUM |
| **類別** | 認證與授權 |
| **狀態** | ⬜ 待修正 |

#### 問題描述

OAuth state 的有效期為 5 分鐘，對於網路較慢的用戶可能太短。

#### 檔案位置

```
supabase/functions/_shared/oauth-state.ts:9
```

#### 修復建議

考慮將 state 過期時間延長至 10-15 分鐘。

---

### SEC-M02: Session 參數通過 URL 暴露

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟡 MEDIUM |
| **類別** | 認證與授權 |
| **狀態** | ⬜ 待修正 |

#### 問題描述

workspace_id 和其他敏感參數通過 URL 查詢參數傳遞，會被記錄在瀏覽器歷史、服務器日誌中。

#### 檔案位置

```
frontend/app/auth/callback/route.ts:117, 144
```

#### 修復建議

改為通過 SessionStorage 或安全的 HTTP-only Cookie 傳遞敏感參數。

---

### SEC-M03: Workspace 成員驗證缺少幽靈成員檢查

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟡 MEDIUM |
| **類別** | 認證與授權 |
| **狀態** | ⬜ 待修正 |

#### 問題描述

授權檢查使用 `joined_at IS NOT NULL`，但沒有檢查 `deleted_at IS NULL`。

#### 檔案位置

```
supabase/functions/_shared/auth.ts:36
```

#### 修復建議

在驗證成員時同時檢查軟刪除標誌。

---

### SEC-M04: 缺乏完整審計日誌

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟡 MEDIUM |
| **類別** | 認證與授權 |
| **狀態** | ⬜ 待修正 |

#### 問題描述

缺乏完整的審計日誌記錄關鍵安全事件。

#### 修復建議

建立 `audit_logs` 表記錄：
- 用戶登入/登出
- 權限變更
- Token 的建立/刪除/移轉
- 工作區的刪除
- 資料存取

---

### SEC-M05: Token Refresh CRON_SECRET 無 timing attack 防護

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟡 MEDIUM |
| **類別** | API 安全 |
| **狀態** | ✅ 已修正（2026-01-19） |

#### 問題描述

CRON_SECRET 使用簡單字符串比較，容易受到 Timing Attack。

#### 檔案位置

```
supabase/functions/token-refresh/index.ts:46
supabase/functions/scheduled-sync/index.ts:66
```

#### 修復方式

1. 將 `constantTimeEqual` 函數抽取到 `_shared/crypto.ts` 共用模組
2. 更新 10 個使用 CRON_SECRET 的 Edge Functions：
   - `scheduled-sync`
   - `scheduled-publish`
   - `token-refresh`
   - `token-auto-revoke`
   - `workspace-cleanup`
   - `metrics-cleanup`
   - `hourly-rollup`
   - `daily-rollup`
   - `r-hat-calculator`
   - `ai-tagging`
3. 所有 CRON_SECRET 驗證改用 `constantTimeEqual(token, CRON_SECRET)` 進行常數時間比較

---

### SEC-M06: Open Redirect 防護不完整

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟡 MEDIUM |
| **類別** | 認證與授權 |
| **狀態** | ⬜ 待修正 |

#### 問題描述

Open Redirect 檢查缺少對某些 edge case 的防護（如 `///`）。

#### 檔案位置

```
frontend/app/auth/callback/route.ts:10-13
```

#### 修復建議

使用 URL 解析器而非字符串檢查來驗證重定向目標。

---

### SEC-M07: 缺乏 API 端點速率限制

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟡 MEDIUM |
| **類別** | 認證與授權 |
| **狀態** | ⬜ 待修正 |

#### 問題描述

某些關鍵 API 端點（如 workspace 刪除、user 刪除）沒有速率限制。

#### 檔案位置

```
supabase/functions/delete-workspace/index.ts
supabase/functions/delete-user-account/index.ts
```

#### 修復建議

在所有關鍵端點實施速率限制。

---

### SEC-M08: 缺少 Column-level 權限保護

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟡 MEDIUM |
| **類別** | 資料庫安全 |
| **狀態** | ⬜ 待修正 |

#### 問題描述

敏感欄位（`access_token_encrypted`）雖然透過 REVOKE ALL 阻止客戶端存取，但未使用 column-level GRANT 機制。

#### 修復建議

添加 column-level GRANT 以增加多層防護。

---

### SEC-M09: RLS 政策嵌套多層

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟡 MEDIUM |
| **類別** | 資料庫安全 |
| **狀態** | ⬜ 待修正 |

#### 問題描述

深層嵌套的 RLS 政策可能增加性能問題或遞迴風險。

#### 修復建議

使用 SECURITY DEFINER helper 函數簡化 RLS 邏輯。

---

### SEC-M10: MD5 用於邀請碼生成

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟡 MEDIUM |
| **類別** | 資料庫安全 |
| **狀態** | ⬜ 待修正 |

#### 問題描述

邀請碼生成使用 MD5（已有碰撞漏洞）。

#### 檔案位置

```
supabase/migrations/20260113003606_add_invitation_codes.sql:81
```

#### 修復步驟

```sql
-- ✅ 改用加密隨機數
v_code := upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
```

---

### SEC-M11: URL 參數直接設定用戶輸入

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟡 MEDIUM |
| **類別** | 前端安全 |
| **狀態** | ⬜ 待修正 |

#### 問題描述

直接從 URL 參數設置用戶輸入，未進行驗證。

#### 檔案位置

```
frontend/app/(auth)/compose/page.tsx:230-238
```

#### 修復建議

驗證 URL 參數的內容和格式，設定合理的長度限制。

---

### SEC-M12: 邀請碼錯誤訊息洩露狀態

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟡 MEDIUM |
| **類別** | 前端安全 |
| **狀態** | ⬜ 待修正 |

#### 問題描述

錯誤訊息區分「已使用」和「已過期」，洩露邀請碼狀態。

#### 修復建議

統一錯誤訊息為「邀請碼無效或已使用」。

---

### SEC-M13: Turnstile 驗證可被繞過

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟡 MEDIUM |
| **類別** | 前端安全 |
| **狀態** | ⬜ 待修正 |

#### 問題描述

當 `TURNSTILE_SECRET_KEY` 未設定時，所有驗證都會通過。

#### 檔案位置

```
frontend/app/api/turnstile/verify/route.ts:21-24
```

#### 修復建議

在生產環境不允許跳過驗證。

---

### SEC-M14: 中間件 RLS 查詢缺少 workspace scope

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟡 MEDIUM |
| **類別** | 前端安全 |
| **狀態** | ⬜ 待修正 |

#### 問題描述

中間件中的 Supabase 查詢未指定 `workspace_id`。

#### 檔案位置

```
frontend/lib/supabase/middleware.ts:92-95
```

#### 修復建議

添加工作區過濾。

---

### SEC-M15: Workspace 建立與邀請碼驗證存在競態

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟡 MEDIUM |
| **類別** | 業務邏輯 |
| **狀態** | ⬜ 待修正 |

#### 問題描述

邀請碼驗證和 workspace 建立之間存在時間窗口。

#### 檔案位置

```
frontend/app/auth/callback/route.ts:46-112
```

#### 修復建議

使用資料庫事務確保原子性。

---

### SEC-M16: 邀請碼無 workspace 隔離

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟡 MEDIUM |
| **類別** | 業務邏輯 |
| **狀態** | ⬜ 待修正 |

#### 問題描述

邀請碼表沒有 workspace_id，無法限制邀請碼只能在特定 workspace 中使用。

#### 修復建議

在 `invitation_codes` 表中添加 `workspace_id` 欄位。

---

### SEC-M17: Transfer ID 缺乏重放防護

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟡 MEDIUM |
| **類別** | 業務邏輯 |
| **狀態** | ⬜ 待修正 |

#### 問題描述

OAuth state 有重放防護，但 transfer_id 本身沒有。

#### 檔案位置

```
supabase/functions/threads-oauth-callback/index.ts:79-103
```

#### 修復建議

類似 state 的機制，記錄已使用的 transfer_id。

---

### SEC-M18: 敏感資料通過 URL 參數洩露

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟡 MEDIUM |
| **類別** | API 安全 |
| **狀態** | ⬜ 待修正 |

#### 問題描述

帳號用戶名在 OAuth 重定向 URL 中暴露。

#### 檔案位置

```
supabase/functions/threads-oauth-callback/index.ts:181-182
```

#### 修復建議

移除 URL 中的敏感信息，改由前端查詢獲取。

---

### SEC-M19: 錯誤訊息可能洩露內部結構

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟡 MEDIUM |
| **類別** | API 安全 |
| **狀態** | ✅ 已修正（2026-01-24） |

#### 問題描述

某些 Edge Functions 未遵循 `EXPOSE_ERROR_DETAILS` 邏輯。

#### 檔案位置

```
supabase/functions/threads-compose/index.ts:27-38
```

#### 修復內容（2026-01-24）

全面檢查並修正所有 Edge Functions 的錯誤訊息處理：

| 檔案 | 修正內容 |
|------|----------|
| `ai-weekly-report/index.ts` | 移除 `error.message`、API key 名稱、帳號 ID 暴露 |
| `api-test/index.ts` | 移除 `error.message` 暴露 |
| `ai-tagging/index.ts` | 移除 API key 設定錯誤暴露 |
| `threads-oauth/index.ts` | 移除 URL/App ID 設定錯誤暴露 |
| `_shared/claude.ts` | API 錯誤改為通用訊息，詳情記錄到 console |
| `_shared/gemini.ts` | API 錯誤改為通用訊息，詳情記錄到 console |

**新增規範**：已在 `docs/guides/coding-best-practices.md` 新增「錯誤訊息安全原則」章節。

---

### SEC-M20: Member 移除後 Token 撤銷延遲 7 天

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟡 MEDIUM |
| **類別** | API 安全 |
| **狀態** | ⬜ 待修正 |

#### 問題描述

成員被移除後，其授權的 Threads tokens 仍可在 7 天內被使用。

#### 檔案位置

```
supabase/functions/workspace-member-remove/index.ts:21
```

#### 修復建議

縮短窗口或立即撤銷。

---

### SEC-M21: RLS 中的 SECURITY DEFINER 遞歸風險

| 項目 | 內容 |
|------|------|
| **風險等級** | 🟡 MEDIUM |
| **類別** | 資料庫安全 |
| **狀態** | ⬜ 待修正 |

#### 問題描述

SECURITY DEFINER 函數 `is_workspace_member()` 若本身有漏洞，可能導致全局安全問題。

#### 修復建議

定期審計 SECURITY DEFINER 函數的安全性。

---

## 4. LOW 問題（長期改進）

### SEC-L01: Token 長度洩露

日誌中記錄了 token 長度（`session?.access_token?.length`）。

**位置**：`frontend/app/api/threads-oauth/route.ts:41`

---

### SEC-L02: v1 加密版本使用固定 Salt

v1 使用固定 salt，已棄用但仍支持。

**位置**：`supabase/functions/_shared/crypto.ts:11`

**建議**：定時遷移 v1 tokens 到 v2。

---

### SEC-L03: Rate Limiting 鍵缺乏命名空間隔離

Rate limit 鍵命名可能存在衝突。

**建議**：使用更強大的命名方案。

---

### SEC-L04: 使用者刪除時缺少事務隔離

刪除用戶帳號的多個步驟沒有在 SQL 事務中執行。

**位置**：`supabase/functions/delete-user-account/index.ts:293-332`

---

### SEC-L05: OAuth State 記錄無 TTL 清理

過期的 state 記錄永久保存，可能導致表增長。

**建議**：添加 TTL 清理策略。

---

### SEC-L06: localStorage 敏感 ID 儲存

localStorage 中存儲了 workspace ID 和帳號 ID。

**位置**：`frontend/app/(auth)/posts/page.tsx:352`

---

### SEC-L07: joined_at IDOR 風險

如果前端邏輯允許手動修改 `joined_at`，可能導致未授權訪問。

**建議**：確保 `joined_at` 只能由系統設置。

---

### SEC-L08: 過期邀請碼堆積

沒有自動清理過期邀請碼的機制。

**建議**：添加 CRON job 清理過期記錄。

---

### SEC-L09: Token Transfers 級聯刪除不完整

`token_transfers` 表沒有級聯刪除規則。

---

### SEC-L10: 配額檢查不完整

只檢查全局 workspace 數量，不檢查單個 workspace 內的配額。

**位置**：`supabase/functions/quota-check/index.ts`

---

## 5. 做得好的地方

| 項目 | 說明 |
|------|------|
| ✅ **依賴套件** | `npm audit` 報告 0 個漏洞 |
| ✅ **RLS 基礎架構** | 大部分表已正確啟用 RLS |
| ✅ **Token 加密** | 使用 AES-256-GCM 加密敏感 Token |
| ✅ **OAuth State 驗證** | 使用 HMAC-SHA256 防止偽造 |
| ✅ **Service Role 隔離** | 敏感表已 REVOKE anon/authenticated |
| ✅ **Rate Limiting** | 已實作基於 DB 的速率限制 |
| ✅ **SECURITY DEFINER** | 大部分函數已設定 search_path |
| ✅ **Open Redirect 基礎防護** | auth callback 有基本檢查 |
| ✅ **.gitignore** | 正確排除環境檔案 |

---

## 6. 修復優先順序

### 🔴 立即（24小時內）

| 編號 | 問題 | 預估時間 |
|------|------|----------|
| ~~SEC-C01~~ | ~~吊銷並重新生成 Supabase 金鑰~~ | ⏸️ 暫緩 |
| ~~SEC-C02~~ | ~~修正邀請碼欄位名稱~~ | ⏸️ 暫緩（功能未啟用）|
| ~~SEC-C03~~ | ~~限制 Profiles 表 RLS 政策~~ | ✅ 已修正 |
| ~~SEC-C04~~ | ~~限制 Scheduled/Outbound Posts RLS~~ | ⏸️ 暫緩（無 viewer 角色）|
| ~~SEC-C05~~ | ~~移除前端 API 中的 Service Role Key~~ | ⏸️ 暫緩（Server-side）|
| ~~SEC-C06~~ | ~~移除硬編碼的 Supabase URL~~ | ✅ 已修正 |

### 🟠 本週內

| 編號 | 問題 | 預估時間 |
|------|------|----------|
| ~~SEC-H05~~ | ~~handle_new_user() 添加 search_path~~ | ✅ 已修正 |
| ~~SEC-H06~~ | ~~generate_invitation_code() 添加 search_path~~ | ⏸️ 暫緩（邀請碼）|
| ~~SEC-H08~~ | ~~邀請碼 SQL 函數添加 FOR UPDATE 鎖定~~ | ⏸️ 暫緩（邀請碼）|
| ~~SEC-H09~~ | ~~限制公開邀請碼驗證端點~~ | ⏸️ 暫緩（邀請碼）|
| ~~SEC-H04~~ | ~~修復 Cookie 設定~~ | ⏸️ 暫緩（邀請碼）|
| ~~SEC-H10~~ | ~~更新 CSP 移除 unsafe-inline/eval~~ | ⏸️ 暫緩（修復成本高）|
| ~~SEC-H11~~ | ~~修復 CORS 配置~~ | ⏸️ 暫緩（Cron Job 需要）|

### 🟡 本月內

| 編號 | 問題 | 預估時間 |
|------|------|----------|
| SEC-H01-02 | Token 移轉確認機制與金鑰輪換 | 4 小時 |
| SEC-M04 | 實作完整審計日誌 | 4 小時 |
| SEC-M05 | 添加 Timing Attack 防護 | 30 分鐘 |
| SEC-M10 | 改用加密隨機數生成邀請碼 | 15 分鐘 |
| SEC-M12-13 | 統一錯誤訊息、加強 Turnstile 驗證 | 1 小時 |

---

## 附錄：驗證檢查清單

修復完成後，請執行以下驗證：

```bash
# 1. 確認 .env.local 不在 Git 追蹤中
git ls-files | grep .env.local

# 2. 確認環境變數設定
grep -r "emlclhiaqbkuvztlkfbh" frontend/

# 3. 執行依賴套件安全掃描
cd frontend && npm audit

# 4. 測試邀請碼功能
# - 使用邀請碼註冊新用戶
# - 確認邀請碼被標記為已使用
# - 嘗試重複使用同一邀請碼（應失敗）

# 5. 測試 RLS 政策
# - 以 Viewer 身份查詢 Scheduled Posts（應只看到已發布）
# - 以普通用戶查詢其他用戶的 Profile（應失敗）
```

---

> **下次審計建議日期**：2026-04-16（每季一次）
