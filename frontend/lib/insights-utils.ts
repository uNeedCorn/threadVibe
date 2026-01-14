/**
 * Insights 頁面共用工具函式
 * 供 engagement 和 reach 頁面使用
 */

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
// Constants
// ============================================================================

export const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];
export const WEEKDAY_NAMES = ["週日", "週一", "週二", "週三", "週四", "週五", "週六"];
export const HOUR_LABELS_24 = Array.from({ length: 24 }, (_, i) => i);

export const TEAL_SHADES = [
  "#0F766E",
  "#0D9488",
  "#14B8A6",
  "#2DD4BF",
  "#5EEAD4",
  "#99F6E4",
];

export const TAG_COLORS = [
  "#14B8A6",
  "#8B5CF6",
  "#F59E0B",
  "#EF4444",
  "#3B82F6",
  "#10B981",
  "#EC4899",
  "#6366F1",
];

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
 */
export function getHeatmapColor(value: number, max: number): string {
  if (value === 0) return "bg-muted";
  const intensity = value / max;
  if (intensity > 0.75) return "bg-teal-500";
  if (intensity > 0.5) return "bg-teal-400";
  if (intensity > 0.25) return "bg-teal-300";
  return "bg-teal-200";
}
