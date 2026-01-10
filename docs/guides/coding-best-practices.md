# 程式設計最佳實踐

本文件整理專案開發過程中累積的最佳實踐與規範。

## 核心原則

### DRY 原則（Don't Repeat Yourself）

**重要：避免程式碼重複，但不要過度抽象。**

#### Rule of Three

```
重複次數    處理方式
─────────────────────
1 次        直接寫
2 次        可以接受
3 次以上    考慮抽取
```

當程式碼重複 **三次以上** 時，才考慮抽取為共用函式或元件。

#### Schema-Driven 設計

```typescript
// ❌ 錯誤：欄位特定邏輯
switch (fieldName) {
  case 'roles': return item.roles?.[0];
  case 'company': return item.company?.name;
  case 'status': return item.status;
}

// ✅ 正確：型態驅動邏輯
const fieldDef = Schema.fields[fieldName];
if (fieldDef.accessor) return getByPath(item, fieldDef.accessor);
if (fieldDef.type === 'array') return item[fieldName]?.[0];
return item[fieldName];
```

#### 共用函式設計原則

| 原則 | 說明 |
|------|------|
| 通用性 | 函式應適用於多種情境，而非單一用例 |
| 參數化 | 透過參數控制行為差異，而非建立多個類似函式 |
| 單一職責 | 每個函式只做一件事 |

### 單一職責原則（SRP）

```
一個檔案 = 一個職責
一個函式 = 一個功能
一個元件 = 一個 UI 區塊
```

#### 檔案行數限制

| 類型 | 限制 | 說明 |
|------|------|------|
| 一般元件 | < 150 行 | 嚴格遵守 |
| 複雜表單 | < 400 行 | 可接受，但應考慮拆分 |
| 頁面 (Page) | < 300 行 | 頁面應為薄層，只做組合 |
| Hook | < 150 行 | 邏輯複雜時拆分 |
| Edge Function | < 200 行 | 使用 shared modules 拆分 |

### 單向依賴原則

```
app/ → features/ → shared/ → lib/

✅ 合法方向
❌ 禁止反向依賴
❌ 禁止同層跨模組依賴
```

### 最小獨立運作原則（Minimum Independent Operation）

**重要：每個功能必須保持最小獨立運作，確保單一功能的維護不影響其他功能。**

#### 功能隔離檢查清單

```
✅ 功能模組有明確邊界（透過 index.ts 導出 API）
✅ 模組間透過介面通訊，不直接存取內部實作
✅ 共用邏輯抽取至 shared/，避免模組間相互依賴
✅ 資料流單向：app → features → shared → lib
✅ 修改一個功能時，不需要改動其他功能的程式碼
```

#### 模組邊界設計

```typescript
// features/posts/index.ts - 明確的公開介面
export { PostsPage } from './pages/PostsPage';
export { usePostMetrics } from './hooks/usePostMetrics';
export type { Post, PostMetrics } from './types';

// ❌ 禁止直接 import 內部檔案
import { formatPostDate } from '@/features/posts/utils/formatters';

// ✅ 透過 index.ts 公開或使用 shared
import { formatDate } from '@/shared/utils/date';
```

#### 功能資料夾結構

```
features/
├── posts/
│   ├── index.ts              # 公開介面（唯一入口）
│   ├── pages/                # 頁面元件
│   ├── components/           # 內部元件
│   ├── hooks/                # 內部 hooks
│   ├── utils/                # 內部工具
│   └── types.ts              # 型別定義
│
├── insights/
│   ├── index.ts
│   └── ...
│
└── watchlist/
    ├── index.ts
    └── ...
```

#### 判斷是否違反原則

| 情況 | 是否違反 | 處理方式 |
|------|----------|----------|
| Feature A 直接 import Feature B 內部檔案 | ✅ 違反 | 透過 index.ts 或抽取至 shared |
| Feature A 修改後，Feature B 需要同步修改 | ✅ 違反 | 重新設計介面或抽取共用 |
| 多個 Feature 依賴相同邏輯 | ⚠️ 可能 | 抽取至 shared/ |
| Feature 透過 shared 取得共用邏輯 | ✅ 正確 | 繼續保持 |

---

## 命名規範

### 檔案命名

| 類型 | 規則 | 範例 |
|------|------|------|
| React 元件 | PascalCase | `StatsCard.tsx` |
| Hook | camelCase + use 前綴 | `useAccountInsights.ts` |
| 工具函式 | camelCase | `formatNumber.ts` |
| 常數 | UPPER_SNAKE_CASE | `constants.ts` |
| Edge Function | kebab-case | `sync-metrics/index.ts` |
| 資料表 | snake_case | `workspace_threads_posts` |

### 變數命名

```typescript
// 布林值：is/has/can/should 前綴
const isLoading = true;
const hasError = false;
const canEdit = user.role === 'owner';

// 事件處理：handle 前綴
const handleClick = () => {};
const handleSubmit = () => {};

// 狀態更新：set 前綴
const [count, setCount] = useState(0);

// 列表：複數名詞
const posts = [];
const selectedAccounts = [];
```

### 元件命名

```typescript
// 頁面元件：Page 後綴
DashboardPage.tsx
PostDetailPage.tsx

// 視圖組合：Section/Panel/View 後綴
InsightsSection.tsx
MetricsPanel.tsx
PostsTableView.tsx

// UI 元件：描述性名稱
StatsCard.tsx
TrendChart.tsx
AccountSwitcher.tsx
```

---

## 元件設計

### Props 設計

```typescript
// ✅ 好的 Props 設計
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';  // 有預設值
  size?: 'sm' | 'md' | 'lg';                    // 有預設值
  disabled?: boolean;                            // 布林有預設值
  onClick?: () => void;                          // 事件處理器
  children: React.ReactNode;                     // 內容
}

// ❌ 避免的設計
interface ButtonProps {
  isPrimary?: boolean;    // 避免多個布林變體
  isSecondary?: boolean;  // 使用 variant 代替
  isLarge?: boolean;      // 使用 size 代替
}
```

### 狀態管理

```typescript
// 狀態放置位置
// 1. 只有一個元件用 → useState
// 2. 父子元件共享 → 提升到父元件
// 3. 多處使用 → Zustand store
// 4. 伺服器資料 → React Query

// ❌ 避免 props drilling
<A data={data}>
  <B data={data}>
    <C data={data}>  {/* 太深了 */}
    </C>
  </B>
</A>

// ✅ 使用 Zustand
const useStore = create((set) => ({
  data: null,
  setData: (data) => set({ data }),
}));
```

---

## Hook 設計

### 自訂 Hook 原則

```typescript
// ✅ 好的 Hook
function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Hook 應該：
// 1. 以 use 開頭
// 2. 只做一件事
// 3. 回傳穩定的介面
// 4. 處理清理邏輯
```

### 依賴陣列

```typescript
// ✅ 正確：包含所有依賴
useEffect(() => {
  fetchData(accountId);
}, [accountId]);

// ❌ 錯誤：遺漏依賴
useEffect(() => {
  fetchData(accountId);  // accountId 變化時不會重新執行
}, []);

// 如果確定不需要依賴，加註解說明
useEffect(() => {
  initializeOnce();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // 只在 mount 時執行一次
```

---

## 錯誤處理

### Try-Catch 原則

```typescript
// ✅ 適當的錯誤處理
async function fetchInsights(accountId: string) {
  try {
    const { data, error } = await supabase
      .from('workspace_threads_account_insights')
      .select('*')
      .eq('workspace_threads_account_id', accountId);

    if (error) throw error;
    return { data, error: null };
  } catch (error) {
    console.error('Failed to fetch insights:', error);
    return { data: null, error: error.message };
  }
}

// ✅ 在 UI 層處理錯誤
function InsightsPanel() {
  const { data, error, isLoading } = useInsights();

  if (isLoading) return <Skeleton />;
  if (error) return <ErrorState message={error} />;
  if (!data) return <EmptyState />;

  return <InsightsChart data={data} />;
}
```

---

## 效能優化

### 避免不必要的重新渲染

```typescript
// ✅ 使用 useMemo 快取計算結果
const sortedPosts = useMemo(() => {
  return posts.sort((a, b) =>
    new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  );
}, [posts]);

// ✅ 使用 useCallback 快取函式
const handleSelect = useCallback((id: string) => {
  setSelectedId(id);
}, []);

// ⚠️ 不要過度優化
// 只在確認有效能問題時才使用 memo
```

### 列表優化

```typescript
// ✅ 使用穩定的 key
{posts.map(post => (
  <PostCard key={post.id} data={post} />  // 使用唯一 ID
))}

// ❌ 避免使用 index 作為 key
{posts.map((post, index) => (
  <PostCard key={index} data={post} />  // 重新排序時會出問題
))}
```

---

## Supabase 最佳實踐

### Query 設計

```typescript
// ✅ 明確指定欄位（避免 SELECT *）
const { data } = await supabase
  .from('workspace_threads_posts')
  .select('id, text, published_at, current_views, current_likes')
  .eq('workspace_threads_account_id', accountId)
  .order('published_at', { ascending: false })
  .limit(50);

// ❌ 避免 SELECT *
const { data } = await supabase
  .from('workspace_threads_posts')
  .select('*');  // 可能包含敏感欄位、效能問題
```

### RLS 意識

```typescript
// ✅ 所有查詢都帶 scope
const { data } = await supabase
  .from('workspace_threads_posts')
  .select('*')
  .eq('workspace_id', workspaceId);  // 必須帶 workspace scope

// ❌ 依賴 RLS 但不帶 scope（可能造成意外行為）
const { data } = await supabase
  .from('workspace_threads_posts')
  .select('*');
```

---

## 程式碼整潔

### 立即移除未使用的程式碼

```bash
# 檢查未使用的 exports
npm run lint

# 搜尋特定檔案的引用
grep -rn "ComponentName" --include="*.ts" --include="*.tsx" src/
```

### 避免註解掉的程式碼

```typescript
// ❌ 避免
// const oldImplementation = () => {
//   // 舊的實作...
// };

// ✅ 直接刪除，版控會保留歷史
```

### Import 整理

```typescript
// 建議順序
// 1. React
import React, { useState, useEffect } from 'react';

// 2. 第三方套件
import { format } from 'date-fns';

// 3. 專案內部（絕對路徑）
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';

// 4. 相對路徑
import { PostCard } from '../components/PostCard';
import { CONSTANTS } from './constants';
```
