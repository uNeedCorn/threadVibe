# 元件清單

## 元件架構

```
components/
├── ui/                     # shadcn/ui 基礎元件
│   ├── button.tsx
│   ├── card.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── dialog.tsx
│   ├── dropdown-menu.tsx
│   ├── avatar.tsx
│   ├── badge.tsx
│   ├── skeleton.tsx
│   └── ...
│
├── layout/                 # 版面元件
│   ├── sidebar.tsx
│   ├── header.tsx
│   ├── workspace-switcher.tsx
│   └── account-switcher.tsx
│
├── dashboard/              # Dashboard 相關
│   ├── kpi-card.tsx
│   ├── trend-chart.tsx
│   ├── top-posts.tsx
│   └── recent-posts.tsx
│
├── posts/                  # 貼文相關
│   ├── posts-table.tsx
│   ├── post-detail.tsx
│   ├── post-metrics.tsx
│   └── post-filters.tsx
│
├── insights/               # Insights 相關
│   ├── followers-chart.tsx
│   ├── demographics-chart.tsx
│   └── growth-card.tsx
│
├── settings/               # 設定相關
│   ├── member-list.tsx
│   ├── member-invite.tsx
│   ├── account-list.tsx
│   └── workspace-settings.tsx
│
└── shared/                 # 共用元件
    ├── data-table.tsx
    ├── date-range-picker.tsx
    ├── empty-state.tsx
    ├── error-state.tsx
    └── loading-state.tsx
```

---

## Layout 元件

### Sidebar

```typescript
interface SidebarProps {
  currentPath: string;
}

// 功能
// - Logo
// - 導航連結（Dashboard, Posts, Insights, Settings）
// - Workspace 切換器
// - 使用者選單
```

### Header

```typescript
interface HeaderProps {
  title: string;
  actions?: React.ReactNode;
}

// 功能
// - 頁面標題
// - 操作按鈕區
// - 帳號切換器（多帳號時）
```

### WorkspaceSwitcher

```typescript
interface WorkspaceSwitcherProps {
  workspaces: Workspace[];
  currentWorkspace: Workspace;
  onSelect: (workspace: Workspace) => void;
}

// 功能
// - 下拉選單顯示所有 Workspace
// - 標示當前選中
// - 建立新 Workspace 入口
```

### AccountSwitcher

```typescript
interface AccountSwitcherProps {
  accounts: ThreadsAccount[];
  currentAccount: ThreadsAccount | null;
  onSelect: (account: ThreadsAccount) => void;
}

// 功能
// - 下拉選單顯示 Workspace 內所有帳號
// - 顯示帳號狀態（有效/過期）
// - 連結新帳號入口
```

---

## Dashboard 元件

### KPICard

```typescript
interface KPICardProps {
  title: string;
  value: number | string;
  change?: number;        // 變化百分比
  changeLabel?: string;   // "vs last week"
  icon?: React.ReactNode;
}

// 功能
// - 數值顯示
// - 趨勢指標（上升/下降）
// - 圖示
```

### TrendChart

```typescript
interface TrendChartProps {
  data: {
    date: string;
    value: number;
  }[];
  metric: 'views' | 'likes' | 'followers';
  dateRange: '7d' | '30d' | 'custom';
}

// 功能
// - 折線圖
// - 時間範圍切換
// - Tooltip 顯示詳細數值
```

### TopPosts

```typescript
interface TopPostsProps {
  posts: Post[];
  metric: 'views' | 'likes' | 'engagement';
  limit?: number;
}

// 功能
// - 排行列表
// - 縮圖 + 摘要
// - 關鍵指標
```

---

## Posts 元件

### PostsTable

```typescript
interface PostsTableProps {
  posts: Post[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (column: string) => void;
}

// 顯示欄位
// - 內容預覽（文字截斷）
// - 媒體縮圖
// - 帳號名稱（多帳號區分）
// - 發布時間
// - Views / Likes / Replies / Reposts / Quotes
// - 最後更新時間

// 功能
// - 表格式列表
// - 無限捲動
// - 各欄位可排序
// - Loading / Empty 狀態
```

### PostFilters

```typescript
interface PostFiltersProps {
  filters: {
    dateRange: DateRange;
    accountId?: string;      // 帳號篩選
    mediaType?: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };
  accounts: ThreadsAccount[];  // 可選帳號列表
  onChange: (filters) => void;
}

// 功能
// - 日期範圍選擇（7天/30天/自訂）
// - 帳號篩選（多帳號時）
// - 媒體類型篩選（全部/文字/圖片/影片）
// - 排序選擇（發布時間 + 各項指標）
```

---

## Settings 元件

### MemberList

```typescript
interface MemberListProps {
  members: WorkspaceMember[];
  currentUserId: string;
  isOwner: boolean;
  onRoleChange?: (userId: string, role: string) => void;
  onRemove?: (userId: string) => void;
}

// 功能
// - 成員列表
// - 角色 Badge
// - 角色變更下拉（Owner 可操作）
// - 移除按鈕（Owner 可操作）
```

### MemberInvite

```typescript
interface MemberInviteProps {
  onInvite: (email: string, role: string) => Promise<void>;
}

// 功能
// - Email 輸入
// - 角色選擇
// - 發送按鈕
// - 驗證提示
```

### AccountList

```typescript
interface AccountListProps {
  accounts: ThreadsAccount[];
  onReauthorize: (accountId: string) => void;
  onUnlink: (accountId: string) => void;
}

// 功能
// - 帳號卡片列表
// - Token 狀態顯示
// - 重新授權按鈕
// - 解除連結按鈕
```

---

## Shared 元件

### DateRangePicker

```typescript
interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  presets?: ('7d' | '30d' | '90d')[];
}
```

### EmptyState

```typescript
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}
```

### ErrorState

```typescript
interface ErrorStateProps {
  error: Error;
  onRetry?: () => void;
}
```

---

## 狀態管理

### React Query Keys

```typescript
const queryKeys = {
  workspaces: ['workspaces'],
  workspace: (id: string) => ['workspace', id],
  members: (workspaceId: string) => ['members', workspaceId],
  accounts: (workspaceId: string) => ['accounts', workspaceId],
  posts: (accountId: string) => ['posts', accountId],
  post: (postId: string) => ['post', postId],
  metrics: (postId: string) => ['metrics', postId],
  insights: (accountId: string) => ['insights', accountId],
};
```
