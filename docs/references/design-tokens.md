# 設計 Tokens

本文件定義專案的設計系統基礎 tokens，包含色彩、字型、間距、圓角與陰影。

---

## 色彩系統

### 品牌色（Primary）

採用 oklch 色彩空間（來自 Square UI / Tailwind v4）：

| Token | 用途 | CSS Variable |
|-------|------|--------------|
| primary | 主色 | `var(--color-primary)` |
| primary-foreground | 主色上的文字 | `var(--color-primary-foreground)` |

### 中性色（Neutral）

| Token | Tailwind | 用途 |
|-------|----------|------|
| background | `bg-background` | 頁面背景 |
| foreground | `text-foreground` | 主要文字 |
| muted | `bg-muted` | 次要背景 |
| muted-foreground | `text-muted-foreground` | 次要文字 |
| border | `border-border` | 邊框 |

### 語意色（Semantic）

| Token | 用途 | CSS Variable |
|-------|------|--------------|
| destructive | 危險/刪除 | `var(--color-destructive)` |
| success | 成功 | 自訂 |
| warning | 警告 | 自訂 |

### 圖表色

| Token | CSS Variable | 用途 |
|-------|--------------|------|
| chart-1 | `var(--color-chart-1)` | 第一資料系列 |
| chart-2 | `var(--color-chart-2)` | 第二資料系列 |
| chart-3 | `var(--color-chart-3)` | 第三資料系列 |
| chart-4 | `var(--color-chart-4)` | 第四資料系列 |
| chart-5 | `var(--color-chart-5)` | 第五資料系列 |

---

## 字型系統

### 字型家族

| Token | 值 | 用途 |
|-------|-----|------|
| font-sans | system-ui, sans-serif | 主要字型 |
| font-mono | 'Fira Code', monospace | 程式碼 |

### 字型大小

| Token | 值 | Tailwind | 用途 |
|-------|-----|----------|------|
| text-xs | 12px | `text-xs` | 小標籤 |
| text-sm | 14px | `text-sm` | 次要文字 |
| text-base | 16px | `text-base` | 主要文字 |
| text-lg | 18px | `text-lg` | 小標題 |
| text-xl | 20px | `text-xl` | 標題 |
| text-2xl | 24px | `text-2xl` | 大標題 |
| text-3xl | 30px | `text-3xl` | 頁面標題 |

### 字重

| Token | 值 | Tailwind | 用途 |
|-------|-----|----------|------|
| font-normal | 400 | `font-normal` | 內文 |
| font-medium | 500 | `font-medium` | 強調 |
| font-semibold | 600 | `font-semibold` | 標題 |
| font-bold | 700 | `font-bold` | 重要標題 |

---

## 間距系統

### 基礎間距

| Token | 值 | Tailwind | 用途 |
|-------|-----|----------|------|
| space-1 | 4px | `p-1`, `m-1` | 極小間距 |
| space-2 | 8px | `p-2`, `m-2` | 小間距 |
| space-3 | 12px | `p-3`, `m-3` | 中小間距 |
| space-4 | 16px | `p-4`, `m-4` | 標準間距 |
| space-5 | 20px | `p-5`, `m-5` | 中間距 |
| space-6 | 24px | `p-6`, `m-6` | 大間距 |
| space-8 | 32px | `p-8`, `m-8` | 特大間距 |

### 常用組合

```tsx
// 卡片內距
<div className="p-4">

// 列表項目間距
<div className="space-y-2">

// 表單欄位間距
<div className="space-y-4">

// 區塊間距
<section className="mb-8">
```

---

## 圓角系統

| Token | 值 | Tailwind | 用途 |
|-------|-----|----------|------|
| radius-sm | 6px | `rounded-md` | 小元素 |
| radius-md | 8px | `rounded-lg` | 按鈕、Badge |
| radius-lg | 12px | `rounded-xl` | 卡片 |
| radius-xl | 16px | `rounded-2xl` | Modal |
| radius-full | 9999px | `rounded-full` | 圓形 |

### 常用元件圓角

| 元件 | Tailwind |
|------|----------|
| 按鈕 | `rounded-lg` |
| 輸入框 | `rounded-lg` |
| 卡片 | `rounded-xl` |
| Modal | `rounded-2xl` |
| Badge | `rounded-md` |
| Avatar | `rounded-full` |

---

## 陰影系統

| Token | Tailwind | 用途 |
|-------|----------|------|
| shadow-sm | `shadow-sm` | 微小提升 |
| shadow | `shadow` | 標準陰影 |
| shadow-md | `shadow-md` | 卡片 |
| shadow-lg | `shadow-lg` | 下拉選單 |
| shadow-xl | `shadow-xl` | Modal |

---

## 動畫系統

### 過渡時間

| Token | 值 | Tailwind | 用途 |
|-------|-----|----------|------|
| duration-fast | 150ms | `duration-150` | 快速回饋 |
| duration-normal | 200ms | `duration-200` | 標準過渡 |
| duration-slow | 300ms | `duration-300` | 慢速過渡 |

### 常用動畫

```tsx
// 按鈕 hover
className="transition-colors duration-150"

// Modal 進入
className="transition-all duration-200 ease-out"

// 展開/收合
className="transition-all duration-300 ease-in-out"
```

---

## Focus 樣式

### 標準 Focus Ring

```tsx
// 按鈕 focus
className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"

// 輸入框 focus
className="focus:outline-none focus:ring-2 focus:ring-ring"
```

---

## 響應式斷點

| Token | 值 | Tailwind | 用途 |
|-------|-----|----------|------|
| sm | 640px | `sm:` | 手機橫向 |
| md | 768px | `md:` | 平板 |
| lg | 1024px | `lg:` | 小筆電 |
| xl | 1280px | `xl:` | 桌面 |
| 2xl | 1536px | `2xl:` | 大螢幕 |

---

## 深色模式

使用 CSS 變數自動切換，所有 token 在深色模式下自動對應：

```tsx
// 自動適應深色模式
className="bg-background text-foreground"
className="border-border"
className="bg-muted text-muted-foreground"
```
