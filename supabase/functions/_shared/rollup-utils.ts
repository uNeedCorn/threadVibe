/**
 * Rollup 工具模組
 * 共用的 rollup 比對與處理邏輯
 */

export interface DiffRecord {
  id: string;
  field: string;
  existing: number;
  calculated: number;
  diff: number;
  diff_percent: number;
}

const DIFF_THRESHOLD_PERCENT = 5;

/**
 * 比對兩筆記錄的數值差異
 * 超過閾值的差異會被記錄
 */
export function compareDiffs<T extends Record<string, unknown>>(
  id: string,
  existing: T,
  calculated: T,
  fields: readonly string[]
): DiffRecord[] {
  const diffs: DiffRecord[] = [];

  for (const field of fields) {
    const existingVal = existing[field] as number;
    const calculatedVal = calculated[field] as number;
    const diff = calculatedVal - existingVal;
    const diffPercent = existingVal > 0
      ? (diff / existingVal) * 100
      : (calculatedVal > 0 ? 100 : 0);

    if (Math.abs(diffPercent) > DIFF_THRESHOLD_PERCENT) {
      diffs.push({
        id,
        field,
        existing: existingVal,
        calculated: calculatedVal,
        diff,
        diff_percent: Math.round(diffPercent * 100) / 100,
      });
    }
  }

  return diffs;
}

/**
 * 取得 Map 中每個 key 的最新記錄
 */
export function getLatestByKey<T extends { bucket_ts?: string }>(
  records: T[],
  keyFn: (record: T) => string
): Map<string, T> {
  const latestMap = new Map<string, T>();

  for (const record of records) {
    const key = keyFn(record);
    const existing = latestMap.get(key);
    if (!existing || new Date(record.bucket_ts ?? '') > new Date(existing.bucket_ts ?? '')) {
      latestMap.set(key, record);
    }
  }

  return latestMap;
}

export const POST_METRICS_FIELDS = ['views', 'likes', 'replies', 'reposts', 'quotes', 'shares'] as const;
export const ACCOUNT_INSIGHTS_FIELDS = ['followers_count', 'profile_views', 'likes_count_7d', 'views_count_7d'] as const;
