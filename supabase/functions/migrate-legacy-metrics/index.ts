/**
 * Legacy Metrics Migration
 * 將舊表資料遷移到新分層表
 *
 * 合併策略：取每個時間桶內的最後一筆（與 Rollup 策略一致）
 * 避免重疊：只遷移新表最早資料之前的舊資料
 *
 * 使用方式：
 * - GET: 檢查資料範圍（不執行遷移）
 * - POST: 執行遷移
 * - POST { "dry_run": true }: 模擬遷移（不實際寫入）
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse } from '../_shared/response.ts';
import { alignTo15Min, alignToHour, alignToDate } from '../_shared/tiered-storage.ts';

interface DataRange {
  earliest: string | null;
  latest: string | null;
  count: number;
}

interface MigrationResult {
  post_metrics: {
    '15m': { migrated: number; skipped: number };
    hourly: { migrated: number; skipped: number };
    daily: { migrated: number; skipped: number };
  };
  account_insights: {
    '15m': { migrated: number; skipped: number };
    hourly: { migrated: number; skipped: number };
    daily: { migrated: number; skipped: number };
  };
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const serviceClient = createServiceClient();

    // ============================================
    // Step 1: 檢查資料範圍
    // ============================================

    // 舊表範圍
    const { data: legacyPostMetricsRange } = await serviceClient
      .from('workspace_threads_post_metrics')
      .select('captured_at')
      .order('captured_at', { ascending: true })
      .limit(1)
      .single();

    const { data: legacyPostMetricsLatest } = await serviceClient
      .from('workspace_threads_post_metrics')
      .select('captured_at')
      .order('captured_at', { ascending: false })
      .limit(1)
      .single();

    const { count: legacyPostMetricsCount } = await serviceClient
      .from('workspace_threads_post_metrics')
      .select('*', { count: 'exact', head: true });

    const { data: legacyAccountInsightsRange } = await serviceClient
      .from('workspace_threads_account_insights')
      .select('captured_at')
      .order('captured_at', { ascending: true })
      .limit(1)
      .single();

    const { data: legacyAccountInsightsLatest } = await serviceClient
      .from('workspace_threads_account_insights')
      .select('captured_at')
      .order('captured_at', { ascending: false })
      .limit(1)
      .single();

    const { count: legacyAccountInsightsCount } = await serviceClient
      .from('workspace_threads_account_insights')
      .select('*', { count: 'exact', head: true });

    // 新表範圍（檢查是否已有資料）
    const { data: new15mEarliest } = await serviceClient
      .from('workspace_threads_post_metrics_15m')
      .select('bucket_ts')
      .order('bucket_ts', { ascending: true })
      .limit(1)
      .single();

    const { data: new15mLatest } = await serviceClient
      .from('workspace_threads_post_metrics_15m')
      .select('bucket_ts')
      .order('bucket_ts', { ascending: false })
      .limit(1)
      .single();

    const { count: new15mCount } = await serviceClient
      .from('workspace_threads_post_metrics_15m')
      .select('*', { count: 'exact', head: true });

    // 檢查 hourly 表
    const { count: newHourlyCount } = await serviceClient
      .from('workspace_threads_post_metrics_hourly')
      .select('*', { count: 'exact', head: true });

    const { data: newHourlyLatest } = await serviceClient
      .from('workspace_threads_post_metrics_hourly')
      .select('bucket_ts')
      .order('bucket_ts', { ascending: false })
      .limit(1)
      .single();

    // 檢查 daily 表
    const { count: newDailyCount } = await serviceClient
      .from('workspace_threads_post_metrics_daily')
      .select('*', { count: 'exact', head: true });

    const { data: newDailyLatest } = await serviceClient
      .from('workspace_threads_post_metrics_daily')
      .select('bucket_date')
      .order('bucket_date', { ascending: false })
      .limit(1)
      .single();

    // 檢查 account insights 分層表
    const { count: aiNew15mCount } = await serviceClient
      .from('workspace_threads_account_insights_15m')
      .select('*', { count: 'exact', head: true });

    const { count: aiNewHourlyCount } = await serviceClient
      .from('workspace_threads_account_insights_hourly')
      .select('*', { count: 'exact', head: true });

    const { count: aiNewDailyCount } = await serviceClient
      .from('workspace_threads_account_insights_daily')
      .select('*', { count: 'exact', head: true });

    const dataRanges = {
      legacy: {
        post_metrics: {
          earliest: legacyPostMetricsRange?.captured_at ?? null,
          latest: legacyPostMetricsLatest?.captured_at ?? null,
          count: legacyPostMetricsCount ?? 0,
        } as DataRange,
        account_insights: {
          earliest: legacyAccountInsightsRange?.captured_at ?? null,
          latest: legacyAccountInsightsLatest?.captured_at ?? null,
          count: legacyAccountInsightsCount ?? 0,
        } as DataRange,
      },
      new_tables: {
        post_metrics: {
          count_15m: new15mCount ?? 0,
          count_hourly: newHourlyCount ?? 0,
          count_daily: newDailyCount ?? 0,
          earliest_15m: new15mEarliest?.bucket_ts ?? null,
          latest_15m: new15mLatest?.bucket_ts ?? null,
          latest_hourly: newHourlyLatest?.bucket_ts ?? null,
          latest_daily: newDailyLatest?.bucket_date ?? null,
        },
        account_insights: {
          count_15m: aiNew15mCount ?? 0,
          count_hourly: aiNewHourlyCount ?? 0,
          count_daily: aiNewDailyCount ?? 0,
        },
        earliest_15m: new15mEarliest?.bucket_ts ?? null,
        count_15m: new15mCount ?? 0,
      },
      migration_cutoff: new15mEarliest?.bucket_ts ?? new Date().toISOString(),
    };

    // GET 請求：只回傳資料範圍
    if (req.method === 'GET') {
      // 檢查 hourly bucket 分佈（最近 24 小時）
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: hourlyBuckets } = await serviceClient
        .from('workspace_threads_post_metrics_hourly')
        .select('bucket_ts')
        .gte('bucket_ts', twentyFourHoursAgo)
        .order('bucket_ts', { ascending: false });

      const hourlyBucketCounts = new Map<string, number>();
      for (const row of hourlyBuckets ?? []) {
        const bucket = row.bucket_ts;
        hourlyBucketCounts.set(bucket, (hourlyBucketCounts.get(bucket) ?? 0) + 1);
      }

      return jsonResponse(req, {
        success: true,
        action: 'check_ranges',
        data_ranges: dataRanges,
        hourly_distribution_24h: Object.fromEntries(hourlyBucketCounts),
        message: '使用 POST 執行遷移，POST { "dry_run": true } 模擬遷移',
      });
    }

    // ============================================
    // Step 2: 執行遷移 (POST)
    // ============================================

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const batchSize = body.batch_size ?? 500;
    const maxBatches = body.max_batches ?? 5; // 每次請求處理的最大批次數
    const startOffset = body.offset ?? 0;
    const startPhase = body.phase ?? 'post_metrics'; // 'post_metrics' | 'account_insights'

    console.log(`Starting migration (dry_run: ${dryRun}, batch_size: ${batchSize}, max_batches: ${maxBatches}, phase: ${startPhase}, offset: ${startOffset})`);
    console.log('Migration cutoff:', dataRanges.migration_cutoff);

    const result: MigrationResult = {
      post_metrics: {
        '15m': { migrated: 0, skipped: 0 },
        hourly: { migrated: 0, skipped: 0 },
        daily: { migrated: 0, skipped: 0 },
      },
      account_insights: {
        '15m': { migrated: 0, skipped: 0 },
        hourly: { migrated: 0, skipped: 0 },
        daily: { migrated: 0, skipped: 0 },
      },
    };

    // ============================================
    // 遷移 Post Metrics
    // 注意：使用 upsert 處理重複，不需要 cutoff 過濾
    // ============================================

    let offset = startPhase === 'post_metrics' ? startOffset : 0;
    let hasMore = true;
    let batchCount = 0;
    let postMetricsCompleted = startPhase === 'account_insights'; // 如果從 account_insights 開始，跳過 post_metrics

    while (hasMore && batchCount < maxBatches && !postMetricsCompleted) {
      const { data: legacyData, error } = await serviceClient
        .from('workspace_threads_post_metrics')
        .select('*')
        .order('captured_at', { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error('Error fetching legacy post metrics:', error);
        break;
      }

      if (!legacyData || legacyData.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`Processing post metrics batch: offset=${offset}, count=${legacyData.length}`);

      // 按時間桶分組
      const buckets15m = new Map<string, typeof legacyData[0]>();
      const bucketsHourly = new Map<string, typeof legacyData[0]>();
      const bucketsDaily = new Map<string, typeof legacyData[0]>();

      for (const record of legacyData) {
        const capturedAt = new Date(record.captured_at);
        const postId = record.workspace_threads_post_id;

        // 15m 桶（使用 | 作為分隔符，避免與 ISO 時間的 : 衝突）
        const bucket15m = alignTo15Min(capturedAt).toISOString();
        const key15m = `${postId}|${bucket15m}`;
        const existing15m = buckets15m.get(key15m);
        if (!existing15m || new Date(record.captured_at) > new Date(existing15m.captured_at)) {
          buckets15m.set(key15m, record);
        }

        // hourly 桶
        const bucketHourly = alignToHour(capturedAt).toISOString();
        const keyHourly = `${postId}|${bucketHourly}`;
        const existingHourly = bucketsHourly.get(keyHourly);
        if (!existingHourly || new Date(record.captured_at) > new Date(existingHourly.captured_at)) {
          bucketsHourly.set(keyHourly, record);
        }

        // daily 桶
        const bucketDaily = alignToDate(capturedAt);
        const keyDaily = `${postId}|${bucketDaily}`;
        const existingDaily = bucketsDaily.get(keyDaily);
        if (!existingDaily || new Date(record.captured_at) > new Date(existingDaily.captured_at)) {
          bucketsDaily.set(keyDaily, record);
        }
      }

      // 寫入 15m 表
      if (!dryRun) {
        for (const [key, record] of buckets15m) {
          const [postId, bucket_ts] = key.split('|');
          const { error } = await serviceClient
            .from('workspace_threads_post_metrics_15m')
            .upsert({
              workspace_threads_post_id: postId,
              views: record.views,
              likes: record.likes,
              replies: record.replies,
              reposts: record.reposts,
              quotes: record.quotes,
              shares: record.shares,
              bucket_ts,
              captured_at: record.captured_at,
            }, {
              onConflict: 'workspace_threads_post_id,bucket_ts',
            });

          if (error) {
            result.post_metrics['15m'].skipped++;
          } else {
            result.post_metrics['15m'].migrated++;
          }
        }

        // 寫入 hourly 表
        for (const [key, record] of bucketsHourly) {
          const [postId, bucket_ts] = key.split('|');
          const { error } = await serviceClient
            .from('workspace_threads_post_metrics_hourly')
            .upsert({
              workspace_threads_post_id: postId,
              views: record.views,
              likes: record.likes,
              replies: record.replies,
              reposts: record.reposts,
              quotes: record.quotes,
              shares: record.shares,
              bucket_ts,
              captured_at: record.captured_at,
            }, {
              onConflict: 'workspace_threads_post_id,bucket_ts',
            });

          if (error) {
            result.post_metrics.hourly.skipped++;
          } else {
            result.post_metrics.hourly.migrated++;
          }
        }

        // 寫入 daily 表
        for (const [key, record] of bucketsDaily) {
          const [postId, bucket_date] = key.split('|');
          const { error } = await serviceClient
            .from('workspace_threads_post_metrics_daily')
            .upsert({
              workspace_threads_post_id: postId,
              views: record.views,
              likes: record.likes,
              replies: record.replies,
              reposts: record.reposts,
              quotes: record.quotes,
              shares: record.shares,
              bucket_date,
              captured_at: record.captured_at,
            }, {
              onConflict: 'workspace_threads_post_id,bucket_date',
            });

          if (error) {
            result.post_metrics.daily.skipped++;
          } else {
            result.post_metrics.daily.migrated++;
          }
        }
      } else {
        // Dry run: 只計數
        result.post_metrics['15m'].migrated += buckets15m.size;
        result.post_metrics.hourly.migrated += bucketsHourly.size;
        result.post_metrics.daily.migrated += bucketsDaily.size;
      }

      offset += batchSize;
      batchCount++;
      if (legacyData.length < batchSize) {
        hasMore = false;
        postMetricsCompleted = true;
      }
    }

    // 如果 Post Metrics 尚未完成，返回當前進度
    if (!postMetricsCompleted) {
      return jsonResponse(req, {
        success: true,
        action: dryRun ? 'dry_run' : 'migrated',
        phase: 'post_metrics',
        completed: false,
        next_offset: offset,
        data_ranges: dataRanges,
        result,
      });
    }

    // ============================================
    // 遷移 Account Insights
    // 注意：使用 upsert 處理重複，不需要 cutoff 過濾
    // ============================================

    offset = startPhase === 'account_insights' ? startOffset : 0;
    hasMore = true;
    batchCount = 0;
    let accountInsightsCompleted = false;

    while (hasMore && batchCount < maxBatches) {
      const { data: legacyData, error } = await serviceClient
        .from('workspace_threads_account_insights')
        .select('*')
        .order('captured_at', { ascending: true })
        .range(offset, offset + batchSize - 1);

      if (error) {
        console.error('Error fetching legacy account insights:', error);
        break;
      }

      if (!legacyData || legacyData.length === 0) {
        hasMore = false;
        break;
      }

      console.log(`Processing account insights batch: offset=${offset}, count=${legacyData.length}`);

      const buckets15m = new Map<string, typeof legacyData[0]>();
      const bucketsHourly = new Map<string, typeof legacyData[0]>();
      const bucketsDaily = new Map<string, typeof legacyData[0]>();

      for (const record of legacyData) {
        const capturedAt = new Date(record.captured_at);
        const accountId = record.workspace_threads_account_id;

        // 15m 桶（使用 | 作為分隔符，避免與 ISO 時間的 : 衝突）
        const bucket15m = alignTo15Min(capturedAt).toISOString();
        const key15m = `${accountId}|${bucket15m}`;
        const existing15m = buckets15m.get(key15m);
        if (!existing15m || new Date(record.captured_at) > new Date(existing15m.captured_at)) {
          buckets15m.set(key15m, record);
        }

        // hourly 桶
        const bucketHourly = alignToHour(capturedAt).toISOString();
        const keyHourly = `${accountId}|${bucketHourly}`;
        const existingHourly = bucketsHourly.get(keyHourly);
        if (!existingHourly || new Date(record.captured_at) > new Date(existingHourly.captured_at)) {
          bucketsHourly.set(keyHourly, record);
        }

        // daily 桶
        const bucketDaily = alignToDate(capturedAt);
        const keyDaily = `${accountId}|${bucketDaily}`;
        const existingDaily = bucketsDaily.get(keyDaily);
        if (!existingDaily || new Date(record.captured_at) > new Date(existingDaily.captured_at)) {
          bucketsDaily.set(keyDaily, record);
        }
      }

      // 寫入表
      if (!dryRun) {
        for (const [key, record] of buckets15m) {
          const [accountId, bucket_ts] = key.split('|');
          const { error } = await serviceClient
            .from('workspace_threads_account_insights_15m')
            .upsert({
              workspace_threads_account_id: accountId,
              followers_count: record.followers_count,
              profile_views: record.profile_views ?? 0,
              likes_count_7d: record.likes_count_7d ?? 0,
              views_count_7d: record.views_count_7d ?? 0,
              demographics: record.demographics,
              bucket_ts,
              captured_at: record.captured_at,
            }, {
              onConflict: 'workspace_threads_account_id,bucket_ts',
            });

          if (error) {
            result.account_insights['15m'].skipped++;
          } else {
            result.account_insights['15m'].migrated++;
          }
        }

        for (const [key, record] of bucketsHourly) {
          const [accountId, bucket_ts] = key.split('|');
          const { error } = await serviceClient
            .from('workspace_threads_account_insights_hourly')
            .upsert({
              workspace_threads_account_id: accountId,
              followers_count: record.followers_count,
              profile_views: record.profile_views ?? 0,
              likes_count_7d: record.likes_count_7d ?? 0,
              views_count_7d: record.views_count_7d ?? 0,
              demographics: record.demographics,
              bucket_ts,
              captured_at: record.captured_at,
            }, {
              onConflict: 'workspace_threads_account_id,bucket_ts',
            });

          if (error) {
            result.account_insights.hourly.skipped++;
          } else {
            result.account_insights.hourly.migrated++;
          }
        }

        for (const [key, record] of bucketsDaily) {
          const [accountId, bucket_date] = key.split('|');
          const { error } = await serviceClient
            .from('workspace_threads_account_insights_daily')
            .upsert({
              workspace_threads_account_id: accountId,
              followers_count: record.followers_count,
              profile_views: record.profile_views ?? 0,
              likes_count_7d: record.likes_count_7d ?? 0,
              views_count_7d: record.views_count_7d ?? 0,
              demographics: record.demographics,
              bucket_date,
              captured_at: record.captured_at,
            }, {
              onConflict: 'workspace_threads_account_id,bucket_date',
            });

          if (error) {
            result.account_insights.daily.skipped++;
          } else {
            result.account_insights.daily.migrated++;
          }
        }
      } else {
        result.account_insights['15m'].migrated += buckets15m.size;
        result.account_insights.hourly.migrated += bucketsHourly.size;
        result.account_insights.daily.migrated += bucketsDaily.size;
      }

      offset += batchSize;
      batchCount++;
      if (legacyData.length < batchSize) {
        hasMore = false;
        accountInsightsCompleted = true;
      }
    }

    // 如果 Account Insights 尚未完成，返回當前進度
    if (!accountInsightsCompleted) {
      return jsonResponse(req, {
        success: true,
        action: dryRun ? 'dry_run' : 'migrated',
        phase: 'account_insights',
        completed: false,
        next_offset: offset,
        data_ranges: dataRanges,
        result,
      });
    }

    console.log('Migration completed:', result);

    return jsonResponse(req, {
      success: true,
      action: dryRun ? 'dry_run' : 'migrated',
      phase: 'completed',
      completed: true,
      data_ranges: dataRanges,
      result,
    });
  } catch (error) {
    console.error('Migration failed:', error);
    return errorResponse(
      req,
      error instanceof Error ? error.message : 'Unknown error',
      500,
      'MIGRATION_ERROR'
    );
  }
});
