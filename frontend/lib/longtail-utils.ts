/**
 * 長尾分析工具函式
 * 供 /insights/longtail 頁面使用
 */

// ============================================================================
// Types
// ============================================================================

export type LongtailStatus =
  | "evergreen"
  | "growing"
  | "dormant"
  | "revived"
  | "burst";

export interface DailyMetric {
  day: number;
  views: number;
}

export interface PostLongtailMetrics {
  longtailRatio: number;
  evergreenIndex: number;
  halfLifeDays: number | null;
  status: LongtailStatus;
}

export interface AccountLongtailData {
  avgLongtailRatio: number;
  evergreenPostCount: number;
  totalPostCount: number;
  recent4wLongtailRatio: number;
  prev4wLongtailRatio: number;
}

export interface LongtailContribution {
  burstViews: number; // 0-7 天
  growthViews: number; // 7-30 天
  longtailViews: number; // 30-90 天
  deepLongtailViews: number; // 90+ 天
  totalViews: number;
}

// ============================================================================
// Calculation Functions
// ============================================================================

/**
 * 計算長尾比例
 * @param totalViews 總曝光數
 * @param first7dViews 前 7 天曝光數
 * @returns 長尾比例 (0-100)
 */
export function calculateLongtailRatio(
  totalViews: number,
  first7dViews: number
): number {
  if (totalViews === 0) return 0;
  return ((totalViews - first7dViews) / totalViews) * 100;
}

/**
 * 計算常青指數
 * @param recent30dViews 近 30 天總曝光
 * @param first7dViews 前 7 天總曝光
 * @returns 常青指數 (比值)
 */
export function calculateEvergreenIndex(
  recent30dViews: number,
  first7dViews: number
): number {
  const recent30dDaily = recent30dViews / 30;
  const first7dDaily = first7dViews / 7;
  if (first7dDaily === 0) return 0;
  return recent30dDaily / first7dDaily;
}

/**
 * 計算半衰期
 * @param dailyMetrics 每日曝光數據（按天排序）
 * @param totalViews 總曝光數
 * @returns 半衰期天數或 null
 */
export function calculateHalfLife(
  dailyMetrics: DailyMetric[],
  totalViews: number
): number | null {
  if (totalViews === 0 || dailyMetrics.length < 7) return null;

  const halfTarget = totalViews * 0.5;
  let cumulative = 0;

  for (const metric of dailyMetrics) {
    cumulative += metric.views;
    if (cumulative >= halfTarget) {
      const prevCumulative = cumulative - metric.views;
      if (metric.views === 0) return metric.day;
      const fraction = (halfTarget - prevCumulative) / metric.views;
      return Math.max(0, metric.day - 1 + fraction);
    }
  }

  return null;
}

/**
 * 判斷貼文長尾狀態
 */
export function getPostLongtailStatus(
  evergreenIndex: number,
  halfLifeDays: number | null,
  first24hRatio: number,
  daysSincePublish: number
): LongtailStatus {
  // 舊文復活（優先判斷）
  if (evergreenIndex > 1.0) return "revived";

  // 常青
  if (evergreenIndex > 0.3) return "evergreen";

  // 成長中
  if (evergreenIndex >= 0.15) return "growing";

  // 短效爆發
  if (halfLifeDays !== null && halfLifeDays < 3 && first24hRatio > 0.7) {
    return "burst";
  }

  // 休眠
  if (evergreenIndex < 0.05 && daysSincePublish > 30) {
    return "dormant";
  }

  // 預設
  return "growing";
}

/**
 * 計算長尾潛力評分（帳號層級）
 * @returns 0-100 分
 */
export function calculateLongtailPotentialScore(
  data: AccountLongtailData
): number {
  // 帳號長尾比例權重 (40%)
  const ratioWeight = Math.min(data.avgLongtailRatio / 30, 1);

  // 常青貼文比例權重 (30%)
  const evergreenRatio =
    data.totalPostCount > 0
      ? data.evergreenPostCount / data.totalPostCount
      : 0;
  const evergreenWeight = Math.min(evergreenRatio / 0.2, 1);

  // 長尾趨勢權重 (30%)
  const trendDiff = data.recent4wLongtailRatio - data.prev4wLongtailRatio;
  const trendWeight = Math.max(0, Math.min((trendDiff + 10) / 20, 1));

  // 綜合計算
  const score =
    (ratioWeight * 0.4 + evergreenWeight * 0.3 + trendWeight * 0.3) * 100;

  return Math.round(score);
}

/**
 * 計算長尾貢獻分佈
 * @param publishedAt 發布時間
 * @param dailyViews 每日曝光數據 { date: string, views: number }[]
 * @returns 各階段曝光分佈
 */
export function calculateLongtailContribution(
  publishedAt: Date,
  dailyViews: { date: string; views: number }[]
): LongtailContribution {
  const result: LongtailContribution = {
    burstViews: 0,
    growthViews: 0,
    longtailViews: 0,
    deepLongtailViews: 0,
    totalViews: 0,
  };

  const publishDate = new Date(publishedAt);
  publishDate.setHours(0, 0, 0, 0);

  for (const { date, views } of dailyViews) {
    const currentDate = new Date(date);
    const daysDiff = Math.floor(
      (currentDate.getTime() - publishDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysDiff < 0) continue;

    if (daysDiff <= 7) {
      result.burstViews += views;
    } else if (daysDiff <= 30) {
      result.growthViews += views;
    } else if (daysDiff <= 90) {
      result.longtailViews += views;
    } else {
      result.deepLongtailViews += views;
    }

    result.totalViews += views;
  }

  return result;
}

// ============================================================================
// Status Display Helpers
// ============================================================================

export const LONGTAIL_STATUS_CONFIG = {
  evergreen: {
    label: "常青",
    icon: "🌲",
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/10",
    description: "持續活躍，真正的內容資產",
  },
  growing: {
    label: "成長中",
    icon: "📈",
    color: "text-primary",
    bgColor: "bg-primary/10",
    description: "衰減緩慢，有長尾潛力",
  },
  dormant: {
    label: "休眠",
    icon: "💤",
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    description: "幾乎無新流量",
  },
  revived: {
    label: "舊文復活",
    icon: "🔥",
    color: "text-amber-600",
    bgColor: "bg-amber-500/10",
    description: "近期突然爆發",
  },
  burst: {
    label: "短效爆發",
    icon: "⚡",
    color: "text-violet-600",
    bgColor: "bg-violet-500/10",
    description: "爆發後快速衰減",
  },
} as const;

export const LONGTAIL_RATING_CONFIG = {
  excellent: {
    label: "卓越",
    range: [80, 100] as const,
    color: "text-emerald-600",
    bgColor: "bg-emerald-500",
    description: "常青內容高手",
  },
  good: {
    label: "優秀",
    range: [60, 79] as const,
    color: "text-primary",
    bgColor: "bg-primary",
    description: "長尾策略成熟",
  },
  normal: {
    label: "一般",
    range: [40, 59] as const,
    color: "text-amber-600",
    bgColor: "bg-amber-500",
    description: "有優化空間",
  },
  poor: {
    label: "待加強",
    range: [0, 39] as const,
    color: "text-destructive",
    bgColor: "bg-destructive",
    description: "過度依賴新流量",
  },
} as const;

export type LongtailRating = keyof typeof LONGTAIL_RATING_CONFIG;

/**
 * 根據評分取得評級
 */
export function getLongtailRating(
  score: number
): (typeof LONGTAIL_RATING_CONFIG)[LongtailRating] {
  if (score >= 80) return LONGTAIL_RATING_CONFIG.excellent;
  if (score >= 60) return LONGTAIL_RATING_CONFIG.good;
  if (score >= 40) return LONGTAIL_RATING_CONFIG.normal;
  return LONGTAIL_RATING_CONFIG.poor;
}

// ============================================================================
// Chart Color Helpers
// ============================================================================

/**
 * 長尾貢獻圓餅圖顏色
 */
export const LONGTAIL_CONTRIBUTION_COLORS = {
  burst: "#0D9488", // teal-600
  growth: "#14B8A6", // teal-500
  longtail: "#5EEAD4", // teal-300
  deepLongtail: "#99F6E4", // teal-200
} as const;

/**
 * 常青指數顏色漸層
 */
export function getEvergreenColor(index: number): string {
  if (index > 1.0) return "#F59E0B"; // amber - 復活
  if (index > 0.3) return "#10B981"; // emerald - 常青
  if (index >= 0.15) return "#14B8A6"; // teal - 成長中
  if (index >= 0.05) return "#94A3B8"; // slate - 一般
  return "#CBD5E1"; // slate-300 - 休眠
}

// ============================================================================
// Time Period Helpers
// ============================================================================

/**
 * 計算發布後天數
 */
export function getDaysSincePublish(publishedAt: Date | string): number {
  const published = new Date(publishedAt);
  const now = new Date();
  return Math.floor(
    (now.getTime() - published.getTime()) / (1000 * 60 * 60 * 24)
  );
}

/**
 * 判斷貼文是否適合長尾分析（發布超過 7 天）
 */
export function isEligibleForLongtailAnalysis(
  publishedAt: Date | string
): boolean {
  return getDaysSincePublish(publishedAt) >= 7;
}

/**
 * 判斷貼文是否適合常青分析（發布超過 37 天）
 */
export function isEligibleForEvergreenAnalysis(
  publishedAt: Date | string
): boolean {
  return getDaysSincePublish(publishedAt) >= 37;
}
