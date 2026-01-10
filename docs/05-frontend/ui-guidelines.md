# UI 開發指引

## 概述

本專案 UI 基於 **Square UI** 元件庫，採用 Next.js + shadcn/ui + Tailwind CSS 架構。

---

## 技術堆疊

| 技術 | 版本 | 說明 |
|------|------|------|
| Next.js | 16.x | React 框架 |
| React | 19.x | UI 函式庫 |
| TypeScript | 5.x | 型別系統 |
| Tailwind CSS | 4.x | 樣式框架 |
| shadcn/ui | new-york | UI 元件（拷貝式） |
| Recharts | 2.15+ | 圖表 |
| Zustand | 5.x | 狀態管理 |
| Lucide | 0.55+ | 圖示 |

---

## shadcn/ui 配置

```json
{
  "style": "new-york",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "baseColor": "neutral",
    "cssVariables": true
  },
  "iconLibrary": "lucide"
}
```

---

## 色彩系統

採用 **oklch** 色彩空間，支援深色模式：

```css
@theme inline {
  --color-background: oklch(1 0 0);
  --color-foreground: oklch(0.145 0 0);
  --color-primary: oklch(0.205 0 0);
  --color-primary-foreground: oklch(0.985 0 0);
  --color-secondary: oklch(0.97 0 0);
  --color-muted: oklch(0.97 0 0);
  --color-accent: oklch(0.97 0 0);
  --color-destructive: oklch(0.577 0.245 27.325);
  --color-border: oklch(0.922 0 0);
  --color-ring: oklch(0.708 0 0);
  --color-chart-1: oklch(0.646 0.222 41.116);
  --color-chart-2: oklch(0.6 0.118 184.704);
  --color-chart-3: oklch(0.398 0.07 227.392);
  --color-chart-4: oklch(0.828 0.189 84.429);
  --color-chart-5: oklch(0.769 0.188 70.08);
}
```

---

## 元件選用指南

### Dashboard 元件

| 用途 | 推薦元件 | 來源 |
|------|----------|------|
| 統計卡片 | `StatsCards` | leads/dashboard |
| 趨勢圖表 | `MonthlyGrowthChart` | leads/dashboard |
| 資料表格 | `DataTable` | leads/dashboard |
| 側邊欄 | `DashboardSidebar` | leads/dashboard |

### 基礎 UI 元件

| 元件 | 用途 |
|------|------|
| `Button` | 按鈕（多種 variant） |
| `Badge` | 狀態標籤 |
| `Avatar` | 用戶頭像 |
| `Card` | 卡片容器 |
| `Dialog` | 彈窗 |
| `DropdownMenu` | 下拉選單 |
| `Input` | 輸入框 |
| `Select` | 選擇器 |
| `Table` | 表格 |
| `Tabs` | 分頁 |
| `Tooltip` | 提示 |

---

## 圖表使用

### 基本結構

```tsx
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from "recharts";

const chartConfig = {
  followers: {
    label: "粉絲數",
    color: "var(--color-chart-1)",
  },
};

export function FollowersChart({ data }) {
  return (
    <ChartContainer config={chartConfig}>
      <AreaChart data={data}>
        <XAxis dataKey="date" />
        <YAxis />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          type="monotone"
          dataKey="followers"
          stroke="var(--color-chart-1)"
          fill="var(--color-chart-1)"
          fillOpacity={0.2}
        />
      </AreaChart>
    </ChartContainer>
  );
}
```

### 圖表類型對應

| 數據類型 | 推薦圖表 |
|----------|----------|
| 粉絲成長趨勢 | AreaChart |
| 互動數比較 | BarChart |
| 比例分佈 | PieChart |
| 多指標對比 | LineChart（多線） |

---

## 表格使用

### 基本結構

```tsx
import { DataTable } from "@/components/dashboard/data-table";

const columns = [
  { accessorKey: "text", header: "內容" },
  { accessorKey: "views", header: "觀看數" },
  { accessorKey: "likes", header: "按讚數" },
  { accessorKey: "published_at", header: "發布時間" },
];

export function PostsTable({ posts }) {
  return <DataTable columns={columns} data={posts} />;
}
```

### 表格功能

- 搜尋過濾
- 多欄位排序
- 分頁
- 批次選取
- 狀態篩選

---

## 響應式設計

### 斷點

| 斷點 | 寬度 | 用途 |
|------|------|------|
| `sm` | 640px | 手機橫向 |
| `md` | 768px | 平板 |
| `lg` | 1024px | 小筆電 |
| `xl` | 1280px | 桌面 |
| `2xl` | 1536px | 大螢幕 |

### 側邊欄行為

- 桌面：固定展開
- 平板：可收合
- 手機：隱藏（漢堡選單）

---

## 深色模式

使用 CSS 變數自動切換：

```tsx
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      切換主題
    </Button>
  );
}
```

---

## 狀態管理

### Zustand Store 範例

```tsx
import { create } from "zustand";

interface DashboardStore {
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;
  dateRange: { from: Date; to: Date };
  setDateRange: (range: { from: Date; to: Date }) => void;
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  selectedAccountId: null,
  setSelectedAccountId: (id) => set({ selectedAccountId: id }),
  dateRange: { from: new Date(), to: new Date() },
  setDateRange: (range) => set({ dateRange: range }),
}));
```

---

## 檔案結構

```
frontend/
├── app/                    # Next.js App Router
│   ├── layout.tsx
│   ├── page.tsx
│   ├── dashboard/
│   ├── posts/
│   └── settings/
├── components/
│   ├── ui/                 # shadcn/ui 基礎元件
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── chart.tsx
│   │   └── ...
│   ├── dashboard/          # Dashboard 專用元件
│   │   ├── sidebar.tsx
│   │   ├── stats-cards.tsx
│   │   ├── growth-chart.tsx
│   │   └── posts-table.tsx
│   └── shared/             # 共用元件
│       ├── header.tsx
│       └── theme-toggle.tsx
├── lib/
│   ├── utils.ts            # 工具函式
│   └── supabase.ts         # Supabase client
├── stores/                 # Zustand stores
│   └── dashboard.ts
└── styles/
    └── globals.css         # 全域樣式 + Tailwind
```

---

## 命名規範

| 類型 | 規範 | 範例 |
|------|------|------|
| 元件檔案 | kebab-case | `stats-cards.tsx` |
| 元件名稱 | PascalCase | `StatsCards` |
| 函式 | camelCase | `formatNumber` |
| CSS 變數 | kebab-case | `--color-primary` |
| Store | camelCase | `useDashboardStore` |

---

## 效能優化

### 圖表

- 使用 `ResponsiveContainer` 自適應
- 大量數據時啟用 `isAnimationActive={false}`
- 考慮分頁或虛擬滾動

### 表格

- 使用 `@tanstack/react-table` 虛擬化
- 啟用伺服器端分頁
- 避免一次載入超過 100 筆

### 圖片

- 使用 `next/image` 優化
- 設定適當的 `width` 和 `height`
- 使用 `placeholder="blur"` 載入效果

---

## 參考資源

| 資源 | 連結 |
|------|------|
| Square UI | `/Developments/square-ui-master` |
| shadcn/ui 文件 | https://ui.shadcn.com |
| Tailwind CSS | https://tailwindcss.com |
| Recharts | https://recharts.org |
| Zustand | https://zustand-demo.pmnd.rs |
