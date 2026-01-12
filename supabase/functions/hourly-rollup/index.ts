/**
 * Hourly Rollup Job
 * ADR-002: 資料保留與 Rollup 策略
 *
 * 執行時機：每小時 :05 分
 * 功能：
 * 1. 將 15m 資料 rollup 到 hourly 表（取最後一筆）
 * 2. 比對同步時 upsert 的值 vs Rollup 計算的值，記錄差異
 * 3. 計算 R̂_t（即時再生數）用於擴散預測
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.ts';
import { alignToHour } from '../_shared/tiered-storage.ts';
import { calculateRates, calculateRHat } from '../_shared/metrics.ts';
import {
  DiffRecord,
  compareDiffs,
  getLatestByKey,
  POST_METRICS_FIELDS,
  ACCOUNT_INSIGHTS_FIELDS,
} from '../_shared/rollup-utils.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET');

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

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // 驗證 CRON_SECRET
  const authHeader = req.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!CRON_SECRET || token !== CRON_SECRET) {
    return unauthorizedResponse(req, 'Invalid cron secret');
  }

  const serviceClient = createServiceClient();
  let jobLogId: string | null = null;

  try {
    const now = new Date();

    // 記錄任務開始
    const { data: jobLog } = await serviceClient
      .from('system_job_logs')
      .insert({
        job_type: 'hourly_rollup',
        status: 'running',
      })
      .select('id')
      .single();
    jobLogId = jobLog?.id ?? null;

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
    // Post Metrics: 15m → hourly (with diff check + R̂_t)
    // ============================================

    // 計算需要回看的時間範圍（當前小時 + 前 2 小時，確保有足夠的 15m 資料）
    const lookbackStart = new Date(new Date(hourBucket).getTime() - (R_HAT_LOOKBACK + 4) * 15 * 60 * 1000).toISOString();

    const { data: postMetrics15m, error: pmError } = await serviceClient
      .from('workspace_threads_post_metrics_15m')
      .select('*')
      .gte('bucket_ts', lookbackStart)
      .lt('bucket_ts', nextHourBucket)
      .order('bucket_ts', { ascending: true });  // 由舊到新排序

    if (pmError) {
      console.error('Failed to fetch post metrics 15m:', pmError);
    } else if (postMetrics15m && postMetrics15m.length > 0) {
      // 按 post_id 分組，保留完整時間序列
      const seriesByPost = new Map<string, typeof postMetrics15m>();
      for (const record of postMetrics15m) {
        const list = seriesByPost.get(record.workspace_threads_post_id) ?? [];
        list.push(record);
        seriesByPost.set(record.workspace_threads_post_id, list);
      }

      // 找出每個 post 在目標小時內的最後一筆（用於 rollup）
      const latestByPost = new Map<string, typeof postMetrics15m[0]>();
      for (const record of postMetrics15m) {
        if (record.bucket_ts >= hourBucket && record.bucket_ts < nextHourBucket) {
          const existing = latestByPost.get(record.workspace_threads_post_id);
          if (!existing || new Date(record.bucket_ts) > new Date(existing.bucket_ts)) {
            latestByPost.set(record.workspace_threads_post_id, record);
          }
        }
      }

      for (const [postId, calculated] of latestByPost) {
        try {
          const { data: existingHourly } = await serviceClient
            .from('workspace_threads_post_metrics_hourly')
            .select('*')
            .eq('workspace_threads_post_id', postId)
            .eq('bucket_ts', hourBucket)
            .single();

          if (existingHourly) {
            const diffs = compareDiffs(postId, existingHourly, calculated, POST_METRICS_FIELDS);
            result.post_metrics.diffs.push(...diffs);
          }

          // 計算 rate/score
          const rates = calculateRates({
            views: calculated.views ?? 0,
            likes: calculated.likes ?? 0,
            replies: calculated.replies ?? 0,
            reposts: calculated.reposts ?? 0,
            quotes: calculated.quotes ?? 0,
            shares: calculated.shares ?? 0,
          });

          // 4. 計算 R̂_t（從時間序列取得 ΔReposts）
          const series = seriesByPost.get(postId) ?? [];
          const deltaReposts: number[] = [];
          for (let i = 1; i < series.length; i++) {
            const delta = Math.max(0, (series[i].reposts ?? 0) - (series[i - 1].reposts ?? 0));
            deltaReposts.push(delta);
          }
          const rHatResult = calculateRHat(deltaReposts);
          const rHat = rHatResult.rHat;
          const rHatStatus = rHatResult.status;

          // 5. Upsert（以 Rollup 計算值為準，含 rate/score 和 R̂_t）
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
              engagement_rate: rates.engagementRate,
              reply_rate: rates.replyRate,
              repost_rate: rates.repostRate,
              quote_rate: rates.quoteRate,
              virality_score: rates.viralityScore,
              r_hat: rHat,
              r_hat_status: rHatStatus,
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

          // 6. 同步更新 L3 Current（workspace_threads_posts）
          if (rHat !== null || rHatStatus !== 'insufficient') {
            await serviceClient
              .from('workspace_threads_posts')
              .update({
                current_r_hat: rHat,
                current_r_hat_status: rHatStatus,
              })
              .eq('id', postId);
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
      const latestByAccount = getLatestByKey(
        accountInsights15m,
        (r) => r.workspace_threads_account_id
      );

      for (const [accountId, calculated] of latestByAccount) {
        try {
          const { data: existingHourly } = await serviceClient
            .from('workspace_threads_account_insights_hourly')
            .select('*')
            .eq('workspace_threads_account_id', accountId)
            .eq('bucket_ts', hourBucket)
            .single();

          if (existingHourly) {
            const diffs = compareDiffs(accountId, existingHourly, calculated, ACCOUNT_INSIGHTS_FIELDS);
            result.account_insights.diffs.push(...diffs);
          }

          // Upsert
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

    // 更新任務日誌為完成
    const totalErrors = result.post_metrics.errors + result.account_insights.errors;
    if (jobLogId) {
      await serviceClient
        .from('system_job_logs')
        .update({
          status: totalErrors > 0 ? 'partial' : 'completed',
          completed_at: new Date().toISOString(),
          metadata: {
            bucket: hourBucket,
            post_metrics: {
              processed: result.post_metrics.processed,
              errors: result.post_metrics.errors,
              diffs_count: result.post_metrics.diffs.length,
            },
            account_insights: {
              processed: result.account_insights.processed,
              errors: result.account_insights.errors,
              diffs_count: result.account_insights.diffs.length,
            },
          },
        })
        .eq('id', jobLogId);
    }

    return jsonResponse(req, {
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
    });
  } catch (error) {
    console.error('Hourly rollup failed:', error);

    // 更新任務日誌為失敗
    if (jobLogId) {
      await serviceClient
        .from('system_job_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          metadata: {
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        })
        .eq('id', jobLogId);
    }

    return errorResponse(
      req,
      error instanceof Error ? error.message : 'Unknown error',
      500,
      'ROLLUP_ERROR'
    );
  }
});
