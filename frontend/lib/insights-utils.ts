/**
 * Insights 頁面共用工具函式
 * 供 engagement 和 reach 頁面使用
 */

import {
  TAG_COLORS as DESIGN_TAG_COLORS,
  ACCENT,
  STONE,
} from "./design-tokens";

// ============================================================================
// Types
// ============================================================================

export type Period = "week" | "month";

export interface DateRange {
  start: Date;
  end: Date;
  label: string;
}

// ============================================================================
// Constants (從 design-tokens 重新導出)
// ============================================================================

export const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];
export const WEEKDAY_NAMES = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
export const HOUR_LABELS_24 = Array.from({ length: 24 }, (_, i) => i);

// 橘色色階（用於熱力圖等需要漸層的場景）
export const TEAL_SHADES = [
  "#C2410C", // Orange 700 (最深)
  ACCENT.hover, // #D66A2B
  ACCENT.DEFAULT, // #E97A3B
  "#FB923C", // Orange 400
  ACCENT.muted, // #FDBA9A
  ACCENT.light, // #FEF3EC (最淺)
];

export const TAG_COLORS = DESIGN_TAG_COLORS;

// ============================================================================
// Formatting Functions
// ============================================================================

/**
 * 格式化數字為易讀格式（K, M）
 */
export function formatNumber(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

/**
 * 截斷文字並加上省略號
 */
export function truncateText(text: string, maxLength: number = 20): string {
  if (!text) return "(無文字內容)";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * 格式化日期為 YYYY-MM-DD（本地時區）
 * 避免 toISOString() 轉換為 UTC 造成日期偏移
 */
export function formatDateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// ============================================================================
// Date Range Functions
// ============================================================================

/**
 * 取得日期的結束時間（23:59:59.999）用於時間戳查詢
 */
export function getEndOfDay(date: Date): Date {
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  return endOfDay;
}

/**
 * 根據期間和偏移量計算日期範圍
 */
export function getDateRange(period: Period, offset: number = 0): DateRange {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  if (period === "week") {
    const dayOfWeek = now.getDay();
    const thisWeekSunday = new Date(now);
    thisWeekSunday.setDate(now.getDate() - dayOfWeek);

    const targetSunday = new Date(thisWeekSunday);
    targetSunday.setDate(thisWeekSunday.getDate() + offset * 7);

    const start = new Date(targetSunday);
    const end = offset === 0
      ? new Date(now)
      : new Date(targetSunday.getTime() + 6 * 24 * 60 * 60 * 1000);

    let label: string;
    if (offset === 0) {
      label = "本週";
    } else if (offset === -1) {
      label = "上週";
    } else {
      const startLabel = `${start.getMonth() + 1}/${start.getDate()}`;
      const endLabel = `${end.getMonth() + 1}/${end.getDate()}`;
      label = `${startLabel} - ${endLabel}`;
    }

    return { start, end, label };
  }

  // month
  const targetMonth = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const start = new Date(targetMonth);
  const end = offset === 0
    ? new Date(now)
    : new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0);

  let label: string;
  if (offset === 0) {
    label = "本月";
  } else if (offset === -1) {
    label = "上月";
  } else {
    label = `${targetMonth.getFullYear()}/${targetMonth.getMonth() + 1}`;
  }

  return { start, end, label };
}

/**
 * 取得比較期間的標籤
 */
export function getPreviousPeriodLabel(period: Period): string {
  return period === "week" ? "上週" : "上月";
}

// ============================================================================
// Calculation Functions
// ============================================================================

/**
 * 計算成長率
 */
export function calcGrowth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

// ============================================================================
// UI Helper Functions
// ============================================================================

/**
 * 取得熱力圖格子的 CSS 類別
 * 使用 primary 語意色彩的透明度變化
 */
export function getHeatmapColor(value: number, max: number): string {
  if (value === 0) return "bg-muted";
  const intensity = value / max;
  if (intensity > 0.75) return "bg-primary";
  if (intensity > 0.5) return "bg-primary/70";
  if (intensity > 0.25) return "bg-primary/40";
  return "bg-primary/20";
}
