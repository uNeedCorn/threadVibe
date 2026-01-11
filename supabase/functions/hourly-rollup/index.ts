/**
 * Hourly Rollup Job
 * ADR-002: 資料保留與 Rollup 策略
 *
 * 執行時機：每小時 :05 分
 * 功能：
 * 1. 將 15m 資料 rollup 到 hourly 表（取最後一筆）
 * 2. 比對同步時 upsert 的值 vs Rollup 計算的值，記錄差異
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';
import { alignToHour } from '../_shared/tiered-storage.ts';

interface DiffRecord {
  id: string;
  field: string;
  existing: number;
  calculated: number;
  diff: number;
  diff_percent: number;
}

interface RollupResult {
  post_metrics: {
    processed: number;
    errors: number;
    diffs: DiffRecord[];
  };
  account_insights: {
    processed: number;
    errors: number;
    diffs: DiffRecord[];
  };
}

// 差異閾值：超過此百分比視為異常
const DIFF_THRESHOLD_PERCENT = 5;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  try {
    const serviceClient = createServiceClient();
    const now = new Date();

    // Rollup 前一個小時的資料
    const targetHour = new Date(now);
    targetHour.setHours(targetHour.getHours() - 1);
    const hourBucket = alignToHour(targetHour).toISOString();
    const nextHourBucket = new Date(new Date(hourBucket).getTime() + 60 * 60 * 1000).toISOString();

    console.log(`Starting hourly rollup for bucket: ${hourBucket}`);

    const result: RollupResult = {
      post_metrics: { processed: 0, errors: 0, diffs: [] },
      account_insights: { processed: 0, errors: 0, diffs: [] },
    };

    // ============================================
    // Post Metrics: 15m → hourly (with diff check)
    // ============================================

    const { data: postMetrics15m, error: pmError } = await serviceClient
      .from('workspace_threads_post_metrics_15m')
      .select('*')
      .gte('bucket_ts', hourBucket)
      .lt('bucket_ts', nextHourBucket)
      .order('bucket_ts', { ascending: false });

    if (pmError) {
      console.error('Failed to fetch post metrics 15m:', pmError);
    } else if (postMetrics15m && postMetrics15m.length > 0) {
      // 按 post_id 分組，取每個 post 的最後一筆
      const latestByPost = new Map<string, typeof postMetrics15m[0]>();
      for (const record of postMetrics15m) {
        const existing = latestByPost.get(record.workspace_threads_post_id);
        if (!existing || new Date(record.bucket_ts) > new Date(existing.bucket_ts)) {
          latestByPost.set(record.workspace_threads_post_id, record);
        }
      }

      for (const [postId, calculated] of latestByPost) {
        try {
          // 1. 先取得現有的 hourly 資料（如果有）
          const { data: existingHourly } = await serviceClient
            .from('workspace_threads_post_metrics_hourly')
            .select('*')
            .eq('workspace_threads_post_id', postId)
            .eq('bucket_ts', hourBucket)
            .single();

          // 2. 比對差異（如果現有資料存在）
          if (existingHourly) {
            const fields = ['views', 'likes', 'replies', 'reposts', 'quotes', 'shares'] as const;
            for (const field of fields) {
              const existingVal = existingHourly[field] as number;
              const calculatedVal = calculated[field] as number;
              const diff = calculatedVal - existingVal;
              const diffPercent = existingVal > 0 ? (diff / existingVal) * 100 : (calculatedVal > 0 ? 100 : 0);

              if (Math.abs(diffPercent) > DIFF_THRESHOLD_PERCENT) {
                result.post_metrics.diffs.push({
                  id: postId,
                  field,
                  existing: existingVal,
                  calculated: calculatedVal,
                  diff,
                  diff_percent: Math.round(diffPercent * 100) / 100,
                });
              }
            }
          }

          // 3. Upsert（以 Rollup 計算值為準）
          const { error } = await serviceClient
            .from('workspace_threads_post_metrics_hourly')
            .upsert({
              workspace_threads_post_id: postId,
              views: calculated.views,
              likes: calculated.likes,
              replies: calculated.replies,
              reposts: calculated.reposts,
              quotes: calculated.quotes,
              shares: calculated.shares,
              bucket_ts: hourBucket,
              captured_at: new Date().toISOString(),
            }, {
              onConflict: 'workspace_threads_post_id,bucket_ts',
            });

          if (error) {
            console.error(`Failed to upsert hourly post metrics for ${postId}:`, error);
            result.post_metrics.errors++;
          } else {
            result.post_metrics.processed++;
          }
        } catch (e) {
          console.error(`Exception processing post ${postId}:`, e);
          result.post_metrics.errors++;
        }
      }
    }

    // ============================================
    // Account Insights: 15m → hourly (with diff check)
    // ============================================

    const { data: accountInsights15m, error: aiError } = await serviceClient
      .from('workspace_threads_account_insights_15m')
      .select('*')
      .gte('bucket_ts', hourBucket)
      .lt('bucket_ts', nextHourBucket)
      .order('bucket_ts', { ascending: false });

    if (aiError) {
      console.error('Failed to fetch account insights 15m:', aiError);
    } else if (accountInsights15m && accountInsights15m.length > 0) {
      const latestByAccount = new Map<string, typeof accountInsights15m[0]>();
      for (const record of accountInsights15m) {
        const existing = latestByAccount.get(record.workspace_threads_account_id);
        if (!existing || new Date(record.bucket_ts) > new Date(existing.bucket_ts)) {
          latestByAccount.set(record.workspace_threads_account_id, record);
        }
      }

      for (const [accountId, calculated] of latestByAccount) {
        try {
          // 1. 先取得現有的 hourly 資料
          const { data: existingHourly } = await serviceClient
            .from('workspace_threads_account_insights_hourly')
            .select('*')
            .eq('workspace_threads_account_id', accountId)
            .eq('bucket_ts', hourBucket)
            .single();

          // 2. 比對差異
          if (existingHourly) {
            const fields = ['followers_count', 'profile_views', 'likes_count_7d', 'views_count_7d'] as const;
            for (const field of fields) {
              const existingVal = existingHourly[field] as number;
              const calculatedVal = calculated[field] as number;
              const diff = calculatedVal - existingVal;
              const diffPercent = existingVal > 0 ? (diff / existingVal) * 100 : (calculatedVal > 0 ? 100 : 0);

              if (Math.abs(diffPercent) > DIFF_THRESHOLD_PERCENT) {
                result.account_insights.diffs.push({
                  id: accountId,
                  field,
                  existing: existingVal,
                  calculated: calculatedVal,
                  diff,
                  diff_percent: Math.round(diffPercent * 100) / 100,
                });
              }
            }
          }

          // 3. Upsert
          const { error } = await serviceClient
            .from('workspace_threads_account_insights_hourly')
            .upsert({
              workspace_threads_account_id: accountId,
              followers_count: calculated.followers_count,
              profile_views: calculated.profile_views,
              likes_count_7d: calculated.likes_count_7d,
              views_count_7d: calculated.views_count_7d,
              demographics: calculated.demographics,
              bucket_ts: hourBucket,
              captured_at: new Date().toISOString(),
            }, {
              onConflict: 'workspace_threads_account_id,bucket_ts',
            });

          if (error) {
            console.error(`Failed to upsert hourly account insights for ${accountId}:`, error);
            result.account_insights.errors++;
          } else {
            result.account_insights.processed++;
          }
        } catch (e) {
          console.error(`Exception processing account ${accountId}:`, e);
          result.account_insights.errors++;
        }
      }
    }

    // ============================================
    // 記錄差異警告
    // ============================================

    const totalDiffs = result.post_metrics.diffs.length + result.account_insights.diffs.length;
    if (totalDiffs > 0) {
      console.warn(`⚠️ Found ${totalDiffs} discrepancies exceeding ${DIFF_THRESHOLD_PERCENT}% threshold:`);
      console.warn('Post Metrics diffs:', JSON.stringify(result.post_metrics.diffs, null, 2));
      console.warn('Account Insights diffs:', JSON.stringify(result.account_insights.diffs, null, 2));
    }

    console.log('Hourly rollup completed:', {
      bucket: hourBucket,
      post_metrics: { processed: result.post_metrics.processed, errors: result.post_metrics.errors, diffs: result.post_metrics.diffs.length },
      account_insights: { processed: result.account_insights.processed, errors: result.account_insights.errors, diffs: result.account_insights.diffs.length },
    });

    return new Response(
      JSON.stringify({
        success: true,
        bucket: hourBucket,
        result: {
          post_metrics: {
            processed: result.post_metrics.processed,
            errors: result.post_metrics.errors,
            diffs_count: result.post_metrics.diffs.length,
            diffs: result.post_metrics.diffs,
          },
          account_insights: {
            processed: result.account_insights.processed,
            errors: result.account_insights.errors,
            diffs_count: result.account_insights.diffs.length,
            diffs: result.account_insights.diffs,
          },
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Hourly rollup failed:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
