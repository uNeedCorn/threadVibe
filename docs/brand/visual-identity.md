# ThreadsVibe 視覺識別規範

> 基於 Zenivy 品牌規範，適配 ThreadsVibe 產品

**建立日期**：2026-01-10
**狀態**：正式版

---

## 品牌色彩

### 主要色彩（Teal）

| 名稱 | Hex | oklch | 用途 |
|------|-----|-------|------|
| **Teal 500** | `#14B8A6` | `oklch(0.696 0.137 175.8)` | 主要強調色、CTA 按鈕 |
| **Teal 400** | `#2DD4BF` | `oklch(0.77 0.138 175)` | 深色模式主色、Hover 狀態 |
| **Teal 600** | `#0D9488` | `oklch(0.60 0.130 175)` | Active 狀態 |

### 中性色（Stone）

| 名稱 | Hex | oklch | 用途 |
|------|-----|-------|------|
| Stone 50 | `#FAFAF9` | `oklch(0.985 0.001 106)` | 頁面背景（淺色） |
| Stone 100 | `#F5F5F4` | `oklch(0.97 0.001 106)` | 卡片背景、次要背景 |
| Stone 200 | `#E7E5E4` | `oklch(0.923 0.003 48)` | 邊框、分隔線 |
| Stone 300 | `#D6D3D1` | `oklch(0.869 0.005 56)` | 輸入框邊框 |
| Stone 400 | `#A8A29E` | `oklch(0.709 0.010 56)` | 禁用狀態 |
| Stone 500 | `#78716C` | `oklch(0.553 0.013 58)` | 次要文字 |
| Stone 600 | `#57534E` | `oklch(0.444 0.011 73)` | 圖示 |
| Stone 700 | `#44403C` | `oklch(0.37 0.013 67)` | 主要文字 |
| Stone 800 | `#292524` | `oklch(0.268 0.007 34)` | 標題文字 |
| Stone 900 | `#1C1917` | `oklch(0.216 0.006 56)` | 深色背景 |
| Stone 950 | `#0C0A09` | `oklch(0.147 0.004 49)` | 最深背景 |

### 語意色

| 名稱 | Hex | oklch | 用途 |
|------|-----|-------|------|
| Success | `#22C55E` | `oklch(0.723 0.191 142)` | 成功訊息、正增長 |
| Warning | `#F59E0B` | `oklch(0.768 0.165 75)` | 警告訊息 |
| Destructive | `#EF4444` | `oklch(0.637 0.237 25)` | 錯誤、危險操作 |
| Info | `#3B82F6` | `oklch(0.623 0.214 259)` | 資訊提示 |

### 圖表色

| Token | Hex | oklch | 用途 |
|-------|-----|-------|------|
| chart-1 | `#14B8A6` | `oklch(0.696 0.137 175.8)` | 主要數據（Teal） |
| chart-2 | `#F59E0B` | `oklch(0.768 0.165 75)` | 次要數據（Amber） |
| chart-3 | `#8B5CF6` | `oklch(0.585 0.233 292)` | 第三數據（Violet） |
| chart-4 | `#EC4899` | `oklch(0.638 0.238 350)` | 第四數據（Pink） |
| chart-5 | `#06B6D4` | `oklch(0.715 0.143 211)` | 第五數據（Cyan） |

---

## 色彩配對

### 淺色模式

| 元素 | Token | 值 |
|------|-------|-----|
| 頁面背景 | `--background` | Stone 50 |
| 卡片背景 | `--card` | White |
| 主要文字 | `--foreground` | Stone 900 |
| 次要文字 | `--muted-foreground` | Stone 500 |
| 邊框 | `--border` | Stone 200 |
| 主色 | `--primary` | Teal 500 |
| 主色上的文字 | `--primary-foreground` | White |

### 深色模式

| 元素 | Token | 值 |
|------|-------|-----|
| 頁面背景 | `--background` | Stone 950 |
| 卡片背景 | `--card` | Stone 900 |
| 主要文字 | `--foreground` | Stone 100 |
| 次要文字 | `--muted-foreground` | Stone 400 |
| 邊框 | `--border` | Stone 800 |
| 主色 | `--primary` | Teal 400 |
| 主色上的文字 | `--primary-foreground` | Stone 950 |

---

## CSS Variables 對應

```css
:root {
  /* 品牌色 */
  --primary: oklch(0.696 0.137 175.8);        /* Teal 500 */
  --primary-foreground: oklch(1 0 0);          /* White */

  /* 中性色 */
  --background: oklch(0.985 0.001 106);        /* Stone 50 */
  --foreground: oklch(0.216 0.006 56);         /* Stone 900 */
  --card: oklch(1 0 0);                        /* White */
  --card-foreground: oklch(0.216 0.006 56);    /* Stone 900 */
  --muted: oklch(0.97 0.001 106);              /* Stone 100 */
  --muted-foreground: oklch(0.553 0.013 58);   /* Stone 500 */
  --border: oklch(0.923 0.003 48);             /* Stone 200 */
  --input: oklch(0.923 0.003 48);              /* Stone 200 */
  --ring: oklch(0.696 0.137 175.8);            /* Teal 500 */

  /* 語意色 */
  --destructive: oklch(0.637 0.237 25);        /* Red */
  --success: oklch(0.723 0.191 142);           /* Green */
  --warning: oklch(0.768 0.165 75);            /* Amber */
}

.dark {
  /* 品牌色 */
  --primary: oklch(0.77 0.138 175);            /* Teal 400 */
  --primary-foreground: oklch(0.147 0.004 49); /* Stone 950 */

  /* 中性色 */
  --background: oklch(0.147 0.004 49);         /* Stone 950 */
  --foreground: oklch(0.97 0.001 106);         /* Stone 100 */
  --card: oklch(0.216 0.006 56);               /* Stone 900 */
  --card-foreground: oklch(0.97 0.001 106);    /* Stone 100 */
  --muted: oklch(0.268 0.007 34);              /* Stone 800 */
  --muted-foreground: oklch(0.709 0.010 56);   /* Stone 400 */
  --border: oklch(0.268 0.007 34);             /* Stone 800 */
  --input: oklch(0.268 0.007 34);              /* Stone 800 */
  --ring: oklch(0.77 0.138 175);               /* Teal 400 */
}
```

---

## 使用指南

### 主色使用

```tsx
// 主要 CTA 按鈕
<Button variant="default">立即同步</Button>

// 強調連結
<a className="text-primary hover:text-primary/80">查看詳情</a>

// 選中狀態
<div className="border-primary bg-primary/10">已選取</div>
```

### 文字層級

| 層級 | Class | 用途 |
|------|-------|------|
| 主要文字 | `text-foreground` | 標題、內文 |
| 次要文字 | `text-muted-foreground` | 說明、時間戳 |
| 禁用文字 | `text-muted-foreground/50` | 禁用狀態 |
| 強調文字 | `text-primary` | 連結、重要數字 |

### 數據呈現

| 數據類型 | 色彩建議 |
|----------|----------|
| 正增長 | Success (`text-green-500`) |
| 負增長 | Destructive (`text-red-500`) |
| 主要指標 | Primary (`text-primary`) |
| 次要指標 | Muted (`text-muted-foreground`) |

---

## 來源與參考

本規範基於 **Zenivy 品牌規範**，詳見：
- `~/Developments/zenivy/foundation/brand/visual-identity.md`
- `~/Developments/zenivy/principles/design/color-system.md`

UI 元件系統：
- Square UI（shadcn/ui + Tailwind v4）
- `~/Developments/square-ui-master/templates/leads`
