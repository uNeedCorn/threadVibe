/**
 * Design Tokens - Postlyzer 統一設計規範
 * 基於 Zenivy 設計規範，所有色彩和樣式的 Single Source of Truth
 *
 * 使用方式：
 * - 在 TypeScript 中 import { COLORS, SEMANTIC_COLORS } from "@/lib/design-tokens"
 * - 在 Tailwind 中使用 CSS 變數 (bg-primary, text-success 等)
 */

// ============================================================================
// 品牌色彩 (Brand Colors)
// ============================================================================

/**
 * 主色系 - Teal
 * 用於品牌識別、主要 CTA、重點元素
 */
export const TEAL = {
  50: "#F0FDFA",
  100: "#CCFBF1",
  200: "#99F6E4",
  300: "#5EEAD4",
  400: "#2DD4BF",
  500: "#14B8A6", // 主色
  600: "#0D9488",
  700: "#0F766E",
  800: "#115E59",
  900: "#134E4A",
  950: "#042F2E",
} as const;

/**
 * 中性色系 - Stone
 * 用於文字、背景、邊框
 */
export const STONE = {
  50: "#FAFAF9",
  100: "#F5F5F4",
  200: "#E7E5E4",
  300: "#D6D3D1",
  400: "#A8A29E",
  500: "#78716C",
  600: "#57534E",
  700: "#44403C",
  800: "#292524",
  900: "#1C1917",
  950: "#0C0A09",
} as const;

// ============================================================================
// 語意色彩 (Semantic Colors)
// ============================================================================

/**
 * 語意色彩 - 用於狀態表示
 * 對應 globals.css 中的 CSS 變數
 */
export const SEMANTIC_COLORS = {
  // 主色 (Teal)
  primary: TEAL[500],
  primaryLight: TEAL[400],
  primaryDark: TEAL[600],

  // 成功 (Green)
  success: "#22C55E",
  successLight: "#4ADE80",
  successDark: "#16A34A",

  // 警告 (Amber)
  warning: "#F59E0B",
  warningLight: "#FBBF24",
  warningDark: "#D97706",

  // 危險 (Red)
  destructive: "#EF4444",
  destructiveLight: "#F87171",
  destructiveDark: "#DC2626",

  // 資訊 (Blue) - 新增
  info: "#3B82F6",
  infoLight: "#60A5FA",
  infoDark: "#2563EB",

  // 禁用/中性
  muted: STONE[100],
  mutedForeground: STONE[500],
} as const;

// ============================================================================
// 圖表色彩 (Chart Colors)
// ============================================================================

/**
 * 圖表主要色彩 - 5 色調色盤
 * 用於 Recharts, 圓餅圖, 折線圖等
 */
export const CHART_COLORS = {
  // 對應 CSS 變數 --chart-1 ~ --chart-5
  chart1: TEAL[500], // 主要 - Teal
  chart2: "#F59E0B", // 次要 - Amber
  chart3: "#8B5CF6", // Violet
  chart4: "#EC4899", // Pink
  chart5: "#06B6D4", // Cyan
} as const;

/**
 * 圖表擴展色彩 - 12 色調色盤
 * 用於需要更多顏色區分的場景（如多線圖、多系列資料）
 */
export const CHART_COLORS_EXTENDED = [
  TEAL[500], // Teal
  "#F59E0B", // Amber
  "#8B5CF6", // Violet
  "#EC4899", // Pink
  "#3B82F6", // Blue
  "#10B981", // Emerald
  "#F97316", // Orange
  "#6366F1", // Indigo
  "#EF4444", // Red
  "#06B6D4", // Cyan
  "#84CC16", // Lime
  "#A855F7", // Purple
] as const;

/**
 * Teal 色階 - 用於熱力圖、漸層等
 * 從深到淺排列
 */
export const TEAL_SHADES = [
  TEAL[700], // 最深
  TEAL[600],
  TEAL[500], // 主色
  TEAL[400],
  TEAL[300],
  TEAL[200],
  TEAL[100],
  TEAL[50], // 最淺
] as const;

/**
 * 互動類型專用色彩
 * 用於讚、回覆、轉發、引用的區分
 */
export const INTERACTION_COLORS = {
  likes: TEAL[500], // 讚
  replies: TEAL[600], // 回覆
  reposts: TEAL[400], // 轉發
  quotes: TEAL[300], // 引用
} as const;

// ============================================================================
// 標籤色彩 (Tag Colors)
// ============================================================================

/**
 * 標籤預設顏色
 * 用於 ColorPicker 元件的預設選項
 */
export const TAG_PRESET_COLORS = [
  { name: "灰色", value: STONE[500] },
  { name: "紅色", value: SEMANTIC_COLORS.destructive },
  { name: "橙色", value: "#F97316" },
  { name: "黃色", value: "#EAB308" },
  { name: "綠色", value: SEMANTIC_COLORS.success },
  { name: "藍色", value: SEMANTIC_COLORS.info },
  { name: "紫色", value: "#8B5CF6" },
  { name: "粉色", value: "#EC4899" },
] as const;

/**
 * 標籤色彩調色盤
 * 用於自動分配標籤顏色
 */
export const TAG_COLORS = [
  TEAL[500],
  "#8B5CF6",
  "#F59E0B",
  "#EF4444",
  "#3B82F6",
  "#10B981",
  "#EC4899",
  "#6366F1",
] as const;

// ============================================================================
// 狀態色彩 (Status Colors)
// ============================================================================

/**
 * 成長指標色彩
 * 用於 GrowthBadge 等顯示正負成長的元件
 */
export const GROWTH_COLORS = {
  positive: SEMANTIC_COLORS.success,
  negative: SEMANTIC_COLORS.destructive,
  neutral: STONE[400],
} as const;

/**
 * 基準比較色彩
 * 用於與歷史平均值比較的 Badge
 */
export const BENCHMARK_COLORS = {
  above: SEMANTIC_COLORS.info, // 高於基準
  below: SEMANTIC_COLORS.warning, // 低於基準
} as const;

/**
 * 病毒式傳播等級色彩
 */
export const VIRALITY_COLORS = {
  viral: SEMANTIC_COLORS.destructive, // 爆紅中
  excellent: SEMANTIC_COLORS.warning, // 表現優異
  good: TEAL[500], // 表現良好
  normal: STONE[100], // 一般
} as const;

// ============================================================================
// 熱力圖色彩 (Heatmap Colors)
// ============================================================================

/**
 * 熱力圖強度色彩
 * 用於早期訊號熱力圖等
 */
export const HEATMAP_INTENSITY_COLORS = {
  none: STONE[100], // 無資料
  veryLow: "#FEF3C7", // Amber 100
  low: "#FDE68A", // Amber 200
  medium: "#FCD34D", // Amber 300
  high: "#FBBF24", // Amber 400
  veryHigh: "#F59E0B", // Amber 500
} as const;

/**
 * 根據強度取得熱力圖顏色
 */
export function getHeatmapIntensityColor(intensity: number): string {
  if (intensity <= 0) return HEATMAP_INTENSITY_COLORS.none;
  if (intensity < 0.2) return HEATMAP_INTENSITY_COLORS.veryLow;
  if (intensity < 0.4) return HEATMAP_INTENSITY_COLORS.low;
  if (intensity < 0.6) return HEATMAP_INTENSITY_COLORS.medium;
  if (intensity < 0.8) return HEATMAP_INTENSITY_COLORS.high;
  return HEATMAP_INTENSITY_COLORS.veryHigh;
}

/**
 * 根據數值和最大值取得 Teal 色階顏色
 */
export function getTealShadeColor(value: number, max: number): string {
  if (value === 0 || max === 0) return STONE[100];
  const ratio = value / max;
  const shadeIndex = Math.min(
    Math.floor((1 - ratio) * (TEAL_SHADES.length - 1)),
    TEAL_SHADES.length - 1
  );
  return TEAL_SHADES[shadeIndex];
}

/**
 * 根據索引取得圖表顏色
 */
export function getChartColor(index: number): string {
  return CHART_COLORS_EXTENDED[index % CHART_COLORS_EXTENDED.length];
}

// ============================================================================
// Tailwind CSS 類別映射
// ============================================================================

/**
 * 語意色彩對應的 Tailwind 類別
 * 用於需要動態設定類別的場景
 */
export const TAILWIND_SEMANTIC_CLASSES = {
  success: {
    text: "text-success",
    bg: "bg-success",
    bgLight: "bg-success/10",
    border: "border-success",
  },
  warning: {
    text: "text-warning",
    bg: "bg-warning",
    bgLight: "bg-warning/10",
    border: "border-warning",
  },
  destructive: {
    text: "text-destructive",
    bg: "bg-destructive",
    bgLight: "bg-destructive/10",
    border: "border-destructive",
  },
  info: {
    text: "text-info",
    bg: "bg-info",
    bgLight: "bg-info/10",
    border: "border-info",
  },
  muted: {
    text: "text-muted-foreground",
    bg: "bg-muted",
    bgLight: "bg-muted/50",
    border: "border-muted",
  },
} as const;
