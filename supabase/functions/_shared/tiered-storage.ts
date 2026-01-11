/**
 * 分層儲存輔助模組
 * ADR-002: 資料保留與 Rollup 策略
 */

// ============================================
// Types
// ============================================

export type PostMetricsTable =
  | 'workspace_threads_post_metrics_15m'
  | 'workspace_threads_post_metrics_hourly'
  | 'workspace_threads_post_metrics_daily';

export type AccountInsightsTable =
  | 'workspace_threads_account_insights_15m'
  | 'workspace_threads_account_insights_hourly'
  | 'workspace_threads_account_insights_daily';

export type SyncFrequency = '15m' | 'hourly' | 'daily' | 'weekly' | 'skip';

export interface PostAgeInfo {
  ageInHours: number;
  ageInDays: number;
  ageInMonths: number;
}

// ============================================
// Constants
// ============================================

// 貼文生命週期閾值
const POST_LIFECYCLE = {
  GOLDEN_PERIOD_HOURS: 72,        // 0-72h: 15分鐘同步
  HOURLY_PERIOD_DAYS: 90,         // 72h-3個月: 每小時同步
  DAILY_PERIOD_DAYS: 180,         // 3-6個月: 每日同步
  WEEKLY_PERIOD_DAYS: 365,        // 6-12個月: 每週同步
  MAX_RETENTION_DAYS: 365,        // 超過365天: 不再同步
} as const;

// ============================================
// Helper Functions
// ============================================

/**
 * 計算貼文年齡
 */
export function getPostAge(publishedAt: Date | string, now: Date = new Date()): PostAgeInfo {
  const published = typeof publishedAt === 'string' ? new Date(publishedAt) : publishedAt;
  const diffMs = now.getTime() - published.getTime();
  const ageInHours = diffMs / (1000 * 60 * 60);
  const ageInDays = ageInHours / 24;
  const ageInMonths = ageInDays / 30;

  return {
    ageInHours,
    ageInDays,
    ageInMonths,
  };
}

/**
 * 根據貼文年齡決定同步頻率
 *
 * 0-72h: 每 15 分鐘
 * 72h-3個月: 每小時
 * 3-6個月: 每日
 * 6-12個月: 每週
 * >12個月: 不同步
 */
export function getSyncFrequency(publishedAt: Date | string, now: Date = new Date()): SyncFrequency {
  const { ageInHours, ageInDays } = getPostAge(publishedAt, now);

  if (ageInDays > POST_LIFECYCLE.MAX_RETENTION_DAYS) {
    return 'skip';
  }

  if (ageInDays > POST_LIFECYCLE.DAILY_PERIOD_DAYS) {
    return 'weekly';
  }

  if (ageInDays > POST_LIFECYCLE.HOURLY_PERIOD_DAYS) {
    return 'daily';
  }

  if (ageInHours > POST_LIFECYCLE.GOLDEN_PERIOD_HOURS) {
    return 'hourly';
  }

  return '15m';
}

/**
 * 根據貼文年齡決定寫入目標表
 *
 * 0-72h: 15m 表
 * 72h-3個月: hourly 表
 * >3個月: daily 表
 */
export function getPostMetricsTargetTable(publishedAt: Date | string, now: Date = new Date()): PostMetricsTable {
  const { ageInHours, ageInDays } = getPostAge(publishedAt, now);

  if (ageInDays > POST_LIFECYCLE.HOURLY_PERIOD_DAYS) {
    return 'workspace_threads_post_metrics_daily';
  }

  if (ageInHours > POST_LIFECYCLE.GOLDEN_PERIOD_HOURS) {
    return 'workspace_threads_post_metrics_hourly';
  }

  return 'workspace_threads_post_metrics_15m';
}

/**
 * 將時間對齊到 15 分鐘桶
 */
export function alignTo15Min(timestamp: Date | string): Date {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  const minutes = date.getMinutes();
  const alignedMinutes = Math.floor(minutes / 15) * 15;
  date.setMinutes(alignedMinutes, 0, 0);
  return date;
}

/**
 * 將時間對齊到小時桶
 */
export function alignToHour(timestamp: Date | string): Date {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  date.setMinutes(0, 0, 0);
  return date;
}

/**
 * 將時間對齊到日期（UTC）
 */
export function alignToDate(timestamp: Date | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  return date.toISOString().split('T')[0]; // YYYY-MM-DD
}

/**
 * 根據目標表取得對應的時間桶欄位值
 */
export function getBucketValue(
  table: PostMetricsTable | AccountInsightsTable,
  timestamp: Date | string
): { bucket_ts?: string; bucket_date?: string } {
  if (table.endsWith('_daily')) {
    return { bucket_date: alignToDate(timestamp) };
  }

  if (table.endsWith('_hourly')) {
    return { bucket_ts: alignToHour(timestamp).toISOString() };
  }

  // 15m
  return { bucket_ts: alignTo15Min(timestamp).toISOString() };
}

/**
 * 檢查貼文是否需要同步（根據上次同步時間和同步頻率）
 */
export function shouldSyncPost(
  publishedAt: Date | string,
  lastSyncAt: Date | string | null,
  now: Date = new Date()
): boolean {
  const frequency = getSyncFrequency(publishedAt, now);

  if (frequency === 'skip') {
    return false;
  }

  if (!lastSyncAt) {
    return true;
  }

  const lastSync = typeof lastSyncAt === 'string' ? new Date(lastSyncAt) : lastSyncAt;
  const diffMs = now.getTime() - lastSync.getTime();
  const diffMinutes = diffMs / (1000 * 60);

  switch (frequency) {
    case '15m':
      return diffMinutes >= 15;
    case 'hourly':
      return diffMinutes >= 60;
    case 'daily':
      return diffMinutes >= 24 * 60;
    case 'weekly':
      return diffMinutes >= 7 * 24 * 60;
    default:
      return false;
  }
}

// ============================================
// Account Insights Functions
// ============================================

/**
 * Account Insights 固定使用 15m 表（不像 Post Metrics 需根據年齡判斷）
 * Rollup Job 會負責將 15m → hourly → daily
 */
export function getAccountInsightsTargetTable(): AccountInsightsTable {
  return 'workspace_threads_account_insights_15m';
}
