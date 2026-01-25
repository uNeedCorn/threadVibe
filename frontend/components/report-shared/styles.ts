/**
 * 報告統一設計系統 (Design Tokens)
 *
 * 適用於：AI 週報、內容報告、人設報告
 */

// ============================================
// 顏色系統
// ============================================

/** 語意化顏色 - 用於狀態/優先級標示 */
export const semanticColors = {
  // 正面/成功
  success: {
    text: "text-emerald-600",
    textDark: "text-emerald-400",
    bg: "bg-emerald-50",
    bgSubtle: "bg-emerald-50/50",
    border: "border-emerald-200",
    borderStrong: "border-emerald-500/30",
    icon: "text-emerald-500",
    badge: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20",
  },
  // 警告/待改善
  warning: {
    text: "text-amber-600",
    textDark: "text-amber-400",
    bg: "bg-amber-50",
    bgSubtle: "bg-amber-50/50",
    border: "border-amber-200",
    borderStrong: "border-amber-500/30",
    icon: "text-amber-500",
    badge: "bg-amber-500/10 text-amber-700 border-amber-500/20",
  },
  // 資訊/建議
  info: {
    text: "text-blue-600",
    textDark: "text-blue-400",
    bg: "bg-blue-50",
    bgSubtle: "bg-blue-50/50",
    border: "border-blue-200",
    borderStrong: "border-blue-500/30",
    icon: "text-blue-500",
    badge: "bg-blue-500/10 text-blue-700 border-blue-500/20",
  },
  // 錯誤/緊急
  error: {
    text: "text-rose-600",
    textDark: "text-rose-400",
    bg: "bg-rose-50",
    bgSubtle: "bg-rose-50/50",
    border: "border-rose-200",
    borderStrong: "border-rose-500/30",
    icon: "text-rose-500",
    badge: "bg-rose-500/10 text-rose-700 border-rose-500/20",
  },
  // 主要/重點
  primary: {
    text: "text-primary",
    bg: "bg-primary/5",
    bgSubtle: "bg-primary/5",
    border: "border-primary/20",
    borderStrong: "border-primary/30",
    icon: "text-primary",
    badge: "bg-primary/10 text-primary border-primary/20",
  },
  // 次要/輔助
  muted: {
    text: "text-muted-foreground",
    bg: "bg-muted/30",
    bgSubtle: "bg-muted/20",
    border: "border-border",
    icon: "text-muted-foreground",
  },
} as const;

// ============================================
// 分數/評級顏色
// ============================================

export function getScoreStyle(score: number) {
  if (score >= 80) {
    return {
      text: "text-emerald-600",
      bg: "bg-emerald-500",
      ring: "ring-emerald-500/20",
      bgSubtle: "bg-emerald-50/50",
      border: "border-emerald-200",
      label: "優秀",
    };
  }
  if (score >= 60) {
    return {
      text: "text-blue-600",
      bg: "bg-blue-500",
      ring: "ring-blue-500/20",
      bgSubtle: "bg-blue-50/50",
      border: "border-blue-200",
      label: "良好",
    };
  }
  if (score >= 40) {
    return {
      text: "text-amber-600",
      bg: "bg-amber-500",
      ring: "ring-amber-500/20",
      bgSubtle: "bg-amber-50/50",
      border: "border-amber-200",
      label: "待加強",
    };
  }
  return {
    text: "text-rose-600",
    bg: "bg-rose-500",
    ring: "ring-rose-500/20",
    bgSubtle: "bg-rose-50/50",
    border: "border-rose-200",
    label: "需改善",
  };
}

// ============================================
// 優先級/急迫度樣式
// ============================================

export const priorityStyles = {
  high: {
    text: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-200",
    badge: "bg-rose-500/10 text-rose-600 border-rose-500/30",
    label: "高",
  },
  medium: {
    text: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    badge: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    label: "中",
  },
  low: {
    text: "text-blue-600",
    bg: "bg-blue-50",
    border: "border-blue-200",
    badge: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    label: "低",
  },
} as const;

// ============================================
// 評級配置
// ============================================

export const ratingStyles = {
  excellent: {
    label: "表現優異",
    text: "text-emerald-600",
    bg: "bg-emerald-50/50",
    border: "border-emerald-200",
    borderStrong: "border-emerald-500/30",
    ring: "ring-emerald-500/20",
    gradient: "from-emerald-500/20 via-emerald-500/10 to-transparent",
    iconBg: "bg-emerald-500/20",
    scoreBg: "bg-gradient-to-br from-emerald-500 to-emerald-600",
  },
  good: {
    label: "表現良好",
    text: "text-blue-600",
    bg: "bg-blue-50/50",
    border: "border-blue-200",
    borderStrong: "border-blue-500/30",
    ring: "ring-blue-500/20",
    gradient: "from-blue-500/20 via-blue-500/10 to-transparent",
    iconBg: "bg-blue-500/20",
    scoreBg: "bg-gradient-to-br from-blue-500 to-blue-600",
  },
  average: {
    label: "表現普通",
    text: "text-amber-600",
    bg: "bg-amber-50/50",
    border: "border-amber-200",
    borderStrong: "border-amber-500/30",
    ring: "ring-amber-500/20",
    gradient: "from-amber-500/20 via-amber-500/10 to-transparent",
    iconBg: "bg-amber-500/20",
    scoreBg: "bg-gradient-to-br from-amber-500 to-amber-600",
  },
  needs_improvement: {
    label: "待加強",
    text: "text-rose-600",
    bg: "bg-rose-50/50",
    border: "border-rose-200",
    borderStrong: "border-rose-500/30",
    ring: "ring-rose-500/20",
    gradient: "from-rose-500/20 via-rose-500/10 to-transparent",
    iconBg: "bg-rose-500/20",
    scoreBg: "bg-gradient-to-br from-rose-500 to-rose-600",
  },
} as const;

// ============================================
// 卡片樣式
// ============================================

export const cardStyles = {
  /** 主要卡片容器 */
  container: "rounded-xl border bg-card",

  /** 特色卡片（重點區塊） */
  featured: "rounded-xl border-2",

  /** 內容區塊 */
  section: "rounded-xl border p-4",

  /** 強調區塊 */
  highlight: "rounded-xl border-2 p-4",

  /** 統計卡片 */
  stat: "rounded-xl border bg-muted/30 p-4",
} as const;

// ============================================
// 間距系統
// ============================================

export const spacing = {
  /** 區塊間距 */
  section: "space-y-8",

  /** 卡片內容間距 */
  content: "space-y-6",

  /** 項目列表間距 */
  list: "space-y-3",

  /** 緊湊列表間距 */
  listCompact: "space-y-2",

  /** 標籤/Badge 間距 */
  tags: "gap-2",

  /** 網格間距 */
  grid: "gap-4",
} as const;

// ============================================
// 文字樣式
// ============================================

export const typography = {
  /** 卡片標題 */
  cardTitle: "text-lg font-semibold",

  /** 區塊標題 */
  sectionTitle: "text-base font-semibold",

  /** 小標籤 */
  label: "text-xs font-semibold uppercase tracking-wide",

  /** 正文 */
  body: "text-sm leading-relaxed",

  /** 輔助文字 */
  caption: "text-sm text-muted-foreground",

  /** 數值（使用 tabular-nums） */
  number: "tabular-nums",

  /** 大數值 */
  bigNumber: "text-2xl font-bold tabular-nums",

  /** 超大數值 */
  heroNumber: "text-4xl font-bold tabular-nums",
} as const;

// ============================================
// 圖示容器樣式
// ============================================

export const iconContainerStyles = {
  /** 卡片標題圖示 */
  cardIcon: "p-2.5 rounded-xl shadow-lg",

  /** 區塊標題圖示 */
  sectionIcon: "size-5",

  /** 小圖示（列表項目） */
  small: "size-4",
} as const;

// ============================================
// 圖示背景漸層
// ============================================

export const iconGradients = {
  purple: "bg-gradient-to-br from-violet-500 to-purple-600 shadow-violet-500/25",
  blue: "bg-gradient-to-br from-blue-500 to-indigo-500 shadow-blue-500/25",
  amber: "bg-gradient-to-br from-amber-500 to-orange-500 shadow-amber-500/25",
  emerald: "bg-gradient-to-br from-emerald-500 to-green-500 shadow-emerald-500/25",
  rose: "bg-gradient-to-br from-rose-500 to-pink-500 shadow-rose-500/25",
} as const;

// ============================================
// 進度條顏色
// ============================================

export const progressColors = {
  default: "bg-primary",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
  error: "bg-rose-500",
} as const;
