/**
 * 中期分析工具函式
 * 供 /insights/midterm 頁面使用
 * 追蹤發文 3 小時到 7 天的中期表現
 */

import { TrendingUp, TrendingDown, Check, Sparkles, Heart, HeartCrack, Flame } from "lucide-react";

// ============================================================================
// Types
// ============================================================================

export type MidtermStatus = "growing" | "slowing" | "stabilized";

export type EngagementStatus = "active" | "healthy" | "weakening";

export interface HourlyMetric {
  bucket_ts: string;
  views: number;
  likes?: number;
  replies?: number;
  reposts?: number;
  quotes?: number;
}

export interface MidtermAnomaly {
  postId: string;
  type: "revival";
  message: string;
  recentDelta: number;
  expectedDelta: number;
  ratio: number;
}

export interface EngagementMetrics {
  engagementRate: number; // 互動率 (%)
  recent6hEngagementRate: number; // 近 6h 互動率 (%)
  engagementStatus: EngagementStatus;
  totalEngagements: number; // 總互動數
  recent6hEngagementDelta: number; // 近 6h 互動增量
}

export interface MidtermPostMetrics {
  status: MidtermStatus;
  recent6hDelta: number;
  avgHourlyDelta: number;
  recent24hDelta: number | null;
  anomaly: MidtermAnomaly | null;
  engagement: EngagementMetrics | null;
}

// ============================================================================
// Calculation Functions
// ============================================================================

/**
 * 計算中期狀態
 *
 * 判斷邏輯：
 * - 成長中 (growing): 近 6 小時時增量 > 日均時增量 × 0.5
 * - 趨緩 (slowing): 近 6 小時時增量 < 日均時增量 × 0.3
 * - 已穩定 (stabilized): 近 24 小時增量 < 總曝光 × 1%
 *
 * @param hourlyMetrics 小時級成效數據（按時間升序排列）
 * @param totalViews 當前總曝光數
 * @returns 中期狀態
 */
export function calculateMidtermStatus(
  hourlyMetrics: HourlyMetric[],
  totalViews: number
): MidtermStatus {
  // 資料不足，預設成長中
  if (hourlyMetrics.length < 6) return "growing";

  // 計算總增量和平均時增量
  const firstViews = hourlyMetrics[0].views;
  const lastViews = hourlyMetrics[hourlyMetrics.length - 1].views;
  const totalDelta = lastViews - firstViews;
  const avgHourlyDelta = totalDelta / hourlyMetrics.length;

  // 計算近 6 小時增量
  const recent6h = hourlyMetrics.slice(-6);
  const recent6hDelta = recent6h[recent6h.length - 1].views - recent6h[0].views;
  const recent6hAvgHourly = recent6hDelta / 6;

  // 計算近 24 小時增量（如果資料足夠）
  if (hourlyMetrics.length >= 24) {
    const recent24h = hourlyMetrics.slice(-24);
    const recent24hDelta =
      recent24h[recent24h.length - 1].views - recent24h[0].views;

    // 已穩定：近 24 小時增量 < 總曝光 × 1%
    if (totalViews > 0 && recent24hDelta < totalViews * 0.01) {
      return "stabilized";
    }
  }

  // 趨緩：近 6 小時時增量 < 日均時增量 × 0.3
  if (avgHourlyDelta > 0 && recent6hAvgHourly < avgHourlyDelta * 0.3) {
    return "slowing";
  }

  // 成長中：近 6 小時時增量 > 日均時增量 × 0.5（或資料不足以判斷趨緩）
  return "growing";
}

/**
 * 計算中期指標詳情
 *
 * @param hourlyMetrics 小時級成效數據（按時間升序排列）
 * @param totalViews 當前總曝光數
 * @returns 中期指標詳情
 */
export function calculateMidtermMetrics(
  hourlyMetrics: HourlyMetric[],
  totalViews: number
): Omit<MidtermPostMetrics, "anomaly" | "engagement"> {
  const status = calculateMidtermStatus(hourlyMetrics, totalViews);

  // 計算各項數值
  let recent6hDelta = 0;
  let avgHourlyDelta = 0;
  let recent24hDelta: number | null = null;

  if (hourlyMetrics.length >= 6) {
    const recent6h = hourlyMetrics.slice(-6);
    recent6hDelta = recent6h[recent6h.length - 1].views - recent6h[0].views;

    const firstViews = hourlyMetrics[0].views;
    const lastViews = hourlyMetrics[hourlyMetrics.length - 1].views;
    const totalDelta = lastViews - firstViews;
    avgHourlyDelta = totalDelta / hourlyMetrics.length;
  }

  if (hourlyMetrics.length >= 24) {
    const recent24h = hourlyMetrics.slice(-24);
    recent24hDelta =
      recent24h[recent24h.length - 1].views - recent24h[0].views;
  }

  return {
    status,
    recent6hDelta,
    avgHourlyDelta,
    recent24hDelta,
  };
}

/**
 * 偵測中期異常成長（舊文復活）
 *
 * 偵測條件：
 * - 發布超過 72 小時（已過爆發期）
 * - 近 6 小時增量 > 前 24 小時平均增量 × 3 倍
 * - 增量 > 100（過濾雜訊）
 *
 * @param postId 貼文 ID
 * @param hourlyMetrics 小時級成效數據（按時間升序排列）
 * @param ageHours 貼文發布後的小時數
 * @returns 異常物件或 null
 */
export function detectMidtermAnomaly(
  postId: string,
  hourlyMetrics: HourlyMetric[],
  ageHours: number
): MidtermAnomaly | null {
  // 只檢測超過 72 小時的貼文
  if (ageHours < 72) return null;

  // 需要足夠的資料點
  if (hourlyMetrics.length < 30) return null;

  // 計算近 6 小時增量
  const recent6h = hourlyMetrics.slice(-6);
  const recent6hDelta = recent6h[recent6h.length - 1].views - recent6h[0].views;

  // 增量太小，不算異常
  if (recent6hDelta < 100) return null;

  // 計算 6-30 小時前的平均時增量
  const pastPeriod = hourlyMetrics.slice(-30, -6);
  if (pastPeriod.length < 18) return null;

  const pastDelta =
    pastPeriod[pastPeriod.length - 1].views - pastPeriod[0].views;
  const avgHourlyDelta = pastDelta / pastPeriod.length;

  // 避免除以零
  if (avgHourlyDelta <= 0) return null;

  // 計算近 6 小時的平均時增量
  const recentAvgHourly = recent6hDelta / 6;

  // 異常判斷：近期增量 > 平均增量 × 3 倍
  const ratio = recentAvgHourly / avgHourlyDelta;

  if (ratio >= 3) {
    return {
      postId,
      type: "revival",
      message: `舊文復活！近 6 小時曝光增量是平均值的 ${ratio.toFixed(1)} 倍`,
      recentDelta: recent6hDelta,
      expectedDelta: Math.round(avgHourlyDelta * 6),
      ratio,
    };
  }

  return null;
}

// ============================================================================
// Engagement Calculation Functions
// ============================================================================

/**
 * 計算單一數據點的互動數
 */
function getEngagementCount(metric: HourlyMetric): number {
  return (
    (metric.likes || 0) +
    (metric.replies || 0) +
    (metric.reposts || 0) +
    (metric.quotes || 0)
  );
}

/**
 * 計算互動率
 * @param engagements 互動數
 * @param views 曝光數
 * @returns 互動率 (%)
 */
export function calculateEngagementRate(
  engagements: number,
  views: number
): number {
  if (views <= 0) return 0;
  return (engagements / views) * 100;
}

/**
 * 計算互動狀態
 *
 * 判斷邏輯：
 * - 活躍 (active): 近 6h 互動率 > 整體互動率 × 1.2（互動率上升）
 * - 健康 (healthy): 近 6h 互動率 在整體互動率 ±20% 範圍內（互動率穩定）
 * - 疲軟 (weakening): 近 6h 互動率 < 整體互動率 × 0.5（曝光增但互動不增）
 *
 * @param overallRate 整體互動率
 * @param recent6hRate 近 6h 互動率
 * @returns 互動狀態
 */
export function calculateEngagementStatus(
  overallRate: number,
  recent6hRate: number
): EngagementStatus {
  // 避免除以零或極小值
  if (overallRate < 0.1) {
    return recent6hRate > 0.1 ? "active" : "healthy";
  }

  const ratio = recent6hRate / overallRate;

  if (ratio >= 1.2) return "active";
  if (ratio < 0.5) return "weakening";
  return "healthy";
}

/**
 * 計算互動指標
 *
 * @param hourlyMetrics 小時級成效數據（按時間升序排列，需含互動欄位）
 * @param currentViews 當前總曝光數
 * @param currentEngagements 當前總互動數
 * @returns 互動指標或 null（資料不足時）
 */
export function calculateEngagementMetrics(
  hourlyMetrics: HourlyMetric[],
  currentViews: number,
  currentEngagements: number
): EngagementMetrics | null {
  // 資料不足
  if (hourlyMetrics.length < 6) return null;

  // 檢查是否有互動數據
  const hasEngagementData = hourlyMetrics.some(
    (m) => m.likes !== undefined || m.replies !== undefined
  );
  if (!hasEngagementData) return null;

  // 計算整體互動率
  const engagementRate = calculateEngagementRate(
    currentEngagements,
    currentViews
  );

  // 計算近 6h 數據
  const recent6h = hourlyMetrics.slice(-6);
  const recent6hFirstMetric = recent6h[0];
  const recent6hLastMetric = recent6h[recent6h.length - 1];

  const recent6hViewsDelta =
    recent6hLastMetric.views - recent6hFirstMetric.views;
  const recent6hEngagementDelta =
    getEngagementCount(recent6hLastMetric) -
    getEngagementCount(recent6hFirstMetric);

  // 計算近 6h 互動率（基於增量）
  const recent6hEngagementRate = calculateEngagementRate(
    recent6hEngagementDelta,
    recent6hViewsDelta
  );

  // 判斷互動狀態
  const engagementStatus = calculateEngagementStatus(
    engagementRate,
    recent6hEngagementRate
  );

  return {
    engagementRate,
    recent6hEngagementRate,
    engagementStatus,
    totalEngagements: currentEngagements,
    recent6hEngagementDelta: Math.max(0, recent6hEngagementDelta),
  };
}

// ============================================================================
// Status Display Helpers
// ============================================================================

export const MIDTERM_STATUS_CONFIG = {
  growing: {
    label: "成長中",
    icon: TrendingUp,
    color: "text-green-600",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-200",
    description: "曝光仍在持續增加",
  },
  slowing: {
    label: "趨緩",
    icon: TrendingDown,
    color: "text-amber-600",
    bgColor: "bg-amber-500/10",
    borderColor: "border-amber-200",
    description: "增長速度明顯下降",
  },
  stabilized: {
    label: "已穩定",
    icon: Check,
    color: "text-stone-500",
    bgColor: "bg-stone-500/10",
    borderColor: "border-stone-200",
    description: "幾乎無新增曝光",
  },
} as const;

export const MIDTERM_ANOMALY_CONFIG = {
  revival: {
    label: "舊文復活",
    icon: Sparkles,
    color: "text-violet-600",
    bgColor: "bg-violet-500/10",
    borderColor: "border-violet-200",
    description: "非爆發期突然暴漲",
  },
} as const;

export const ENGAGEMENT_STATUS_CONFIG = {
  active: {
    label: "活躍",
    icon: Flame,
    color: "text-orange-600",
    bgColor: "bg-orange-500/10",
    borderColor: "border-orange-200",
    description: "互動率上升中",
  },
  healthy: {
    label: "健康",
    icon: Heart,
    color: "text-rose-500",
    bgColor: "bg-rose-500/10",
    borderColor: "border-rose-200",
    description: "互動率穩定",
  },
  weakening: {
    label: "疲軟",
    icon: HeartCrack,
    color: "text-stone-500",
    bgColor: "bg-stone-500/10",
    borderColor: "border-stone-200",
    description: "曝光增但互動不增",
  },
} as const;

// ============================================================================
// Time Helpers
// ============================================================================

/**
 * 計算發布後小時數
 */
export function getHoursSincePublish(publishedAt: Date | string): number {
  const published = new Date(publishedAt);
  const now = new Date();
  return Math.floor(
    (now.getTime() - published.getTime()) / (1000 * 60 * 60)
  );
}

/**
 * 判斷貼文是否在中期追蹤範圍內（3 小時 - 7 天）
 */
export function isInMidtermRange(publishedAt: Date | string): boolean {
  const hours = getHoursSincePublish(publishedAt);
  return hours >= 3 && hours <= 7 * 24; // 3hr - 168hr (7 days)
}

/**
 * 格式化發布時間為相對時間
 */
export function formatAgeText(hours: number): string {
  if (hours < 24) {
    return `${hours} 小時前`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours === 0) {
    return `${days} 天前`;
  }
  return `${days} 天 ${remainingHours} 小時前`;
}

// ============================================================================
// Chart Data Helpers
// ============================================================================

/**
 * 將小時級數據轉換為生命週期圖表數據
 *
 * @param hourlyMetrics 小時級成效數據
 * @param publishedAt 發布時間
 * @returns 圖表數據點陣列
 */
export function toLifecycleChartData(
  hourlyMetrics: HourlyMetric[],
  publishedAt: Date | string
): Array<{ hour: number; views: number; label: string }> {
  const published = new Date(publishedAt);

  return hourlyMetrics.map((metric) => {
    const metricTime = new Date(metric.bucket_ts);
    const hoursSincePublish = Math.round(
      (metricTime.getTime() - published.getTime()) / (1000 * 60 * 60)
    );

    // 格式化標籤
    let label = `${hoursSincePublish}h`;
    if (hoursSincePublish === 24) label = "1d";
    else if (hoursSincePublish === 48) label = "2d";
    else if (hoursSincePublish === 72) label = "3d";
    else if (hoursSincePublish === 168) label = "7d";
    else if (hoursSincePublish % 24 === 0) label = `${hoursSincePublish / 24}d`;

    return {
      hour: hoursSincePublish,
      views: metric.views,
      label,
    };
  });
}
