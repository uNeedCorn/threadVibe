# Postlyzer Design Tokens

> 基於「溫暖極簡」風格的設計系統

---

## 色彩系統

### Primary（主色 - 橘色系，僅用於強調）

| Token | 值 | 預覽 | 用途 |
|-------|-----|------|------|
| `--accent` | `#E97A3B` | 🟠 | 按鈕、連結、重點 |
| `--accent-hover` | `#D66A2B` | 🟠 | Hover 狀態 |
| `--accent-light` | `#FEF3EC` | 🟡 | Icon 背景、淺底色 |
| `--accent-muted` | `#FDBA9A` | 🟡 | 進度條、標籤 |

### Neutral - Light Mode（中性色 - 淺色模式）

| Token | 值 | 用途 |
|-------|-----|------|
| `--bg` | `#FAFAF9` | 頁面背景 |
| `--bg-card` | `#FFFFFF` | 卡片背景 |
| `--bg-muted` | `#F5F5F4` | 次要背景 |
| `--border` | `#E7E5E4` | 邊框 |
| `--border-light` | `#F5F5F4` | 淺邊框 |
| `--text` | `#44403C` | 主要文字 |
| `--text-light` | `#78716C` | 次要文字 |
| `--text-muted` | `#A8A29E` | 提示文字 |
| `--text-dark` | `#292524` | 標題 |

### Neutral - Dark Mode（中性色 - 深色模式）

| Token | 值 | 用途 |
|-------|-----|------|
| `--bg` | `#1C1917` | 頁面背景 |
| `--bg-card` | `#292524` | 卡片背景 |
| `--bg-muted` | `#44403C` | 次要背景 |
| `--border` | `#44403C` | 邊框 |
| `--border-light` | `#3D3835` | 淺邊框 |
| `--text` | `#E7E5E4` | 主要文字 |
| `--text-light` | `#A8A29E` | 次要文字 |
| `--text-muted` | `#78716C` | 提示文字 |
| `--text-dark` | `#FAFAF9` | 標題 |

### Semantic（語意色 - 狀態反饋）

| Token | Light | Dark | 用途 |
|-------|-------|------|------|
| `--success` | `#22C55E` | `#4ADE80` | 成功 |
| `--success-light` | `#F0FDF4` | `#14532D` | 成功背景 |
| `--warning` | `#EAB308` | `#FACC15` | 警告 |
| `--warning-light` | `#FEFCE8` | `#422006` | 警告背景 |
| `--error` | `#EF4444` | `#F87171` | 錯誤 |
| `--error-light` | `#FEF2F2` | `#450A0A` | 錯誤背景 |
| `--info` | `#3B82F6` | `#60A5FA` | 資訊 |
| `--info-light` | `#EFF6FF` | `#1E3A5F` | 資訊背景 |

---

## 排版

### 字體

| Token | 值 | 用途 |
|-------|-----|------|
| `--font-sans` | `Inter, system-ui, -apple-system, sans-serif` | 主要字體 |
| `--font-mono` | `JetBrains Mono, Menlo, monospace` | 程式碼 |

### 字級

| Token | 值 | 行高 | 用途 |
|-------|-----|------|------|
| `--text-xs` | 12px | 1.5 | 標籤、註解 |
| `--text-sm` | 14px | 1.5 | 輔助文字 |
| `--text-base` | 16px | 1.6 | 內文 |
| `--text-lg` | 18px | 1.6 | 強調內文 |
| `--text-xl` | 20px | 1.5 | 小標題 |
| `--text-2xl` | 24px | 1.4 | 區塊標題 |
| `--text-3xl` | 30px | 1.3 | 頁面標題 |
| `--text-4xl` | 36px | 1.2 | Hero 標題 |

### 字重

| Token | 值 | 用途 |
|-------|-----|------|
| `--font-normal` | 400 | 內文 |
| `--font-medium` | 500 | 強調 |
| `--font-semibold` | 600 | 按鈕、標籤 |
| `--font-bold` | 700 | 標題 |

---

## 間距

| Token | 值 | 用途範例 |
|-------|-----|----------|
| `--space-1` | 4px | 緊密間距 |
| `--space-2` | 8px | 元素內部 |
| `--space-3` | 12px | 小間距 |
| `--space-4` | 16px | 標準間距 |
| `--space-5` | 20px | 中間距 |
| `--space-6` | 24px | 區塊內 |
| `--space-8` | 32px | 區塊間 |
| `--space-10` | 40px | 大區塊 |
| `--space-12` | 48px | Section |
| `--space-16` | 64px | Hero |

---

## 圓角

| Token | 值 | 用途 |
|-------|-----|------|
| `--radius-sm` | 6px | 小按鈕、標籤 |
| `--radius-md` | 8px | 按鈕、輸入框 |
| `--radius-lg` | 12px | 卡片 |
| `--radius-xl` | 16px | 大卡片、Modal |
| `--radius-full` | 9999px | 圓形、膠囊 |

---

## 陰影

| Token | Light Mode | Dark Mode | 用途 |
|-------|------------|-----------|------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.04)` | `0 1px 2px rgba(0,0,0,0.2)` | 微陰影 |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.06)` | `0 4px 12px rgba(0,0,0,0.3)` | 卡片 hover |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.08)` | `0 8px 24px rgba(0,0,0,0.4)` | 彈窗 |

---

## 過渡動畫

| Token | 值 | 用途 |
|-------|-----|------|
| `--transition-fast` | `150ms ease` | 快速反饋 |
| `--transition-base` | `200ms ease` | 標準過渡 |
| `--transition-slow` | `300ms ease` | 平滑過渡 |

---

## CSS Variables 範例

```css
:root {
  /* Primary */
  --accent: #E97A3B;
  --accent-hover: #D66A2B;
  --accent-light: #FEF3EC;
  --accent-muted: #FDBA9A;

  /* Neutral - Light */
  --bg: #FAFAF9;
  --bg-card: #FFFFFF;
  --bg-muted: #F5F5F4;
  --border: #E7E5E4;
  --border-light: #F5F5F4;
  --text: #44403C;
  --text-light: #78716C;
  --text-muted: #A8A29E;
  --text-dark: #292524;

  /* Semantic */
  --success: #22C55E;
  --warning: #EAB308;
  --error: #EF4444;
  --info: #3B82F6;
}

[data-theme="dark"] {
  --bg: #1C1917;
  --bg-card: #292524;
  --bg-muted: #44403C;
  --border: #44403C;
  --border-light: #3D3835;
  --text: #E7E5E4;
  --text-light: #A8A29E;
  --text-muted: #78716C;
  --text-dark: #FAFAF9;

  --success: #4ADE80;
  --warning: #FACC15;
  --error: #F87171;
  --info: #60A5FA;
}
```

---

## Tailwind Config 範例

```js
module.exports = {
  theme: {
    extend: {
      colors: {
        accent: {
          DEFAULT: '#E97A3B',
          hover: '#D66A2B',
          light: '#FEF3EC',
          muted: '#FDBA9A',
        },
        stone: {
          // 使用 Tailwind 內建的 stone 色系
        }
      },
      borderRadius: {
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
      }
    }
  }
}
```
