/**
 * Daily Rollup Job
 * ADR-002: 資料保留與 Rollup 策略
 *
 * 執行時機：每日 01:00 UTC
 * 功能：
 * 1. 將 hourly 資料 rollup 到 daily 表（取最後一筆）
 * 2. 比對同步時 upsert 的值 vs Rollup 計算的值，記錄差異
 * 3. 保留 R̂_t（當日最後值）用於歷史分析
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { handleCors } from '../_shared/cors.ts';
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.ts';
import { calculateRates } from '../_shared/metrics.ts';
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
        job_type: 'daily_rollup',
        status: 'running',
      })
      .select('id')
      .single();
    jobLogId = jobLog?.id ?? null;

    // Rollup 前一天的資料
    const yesterday = new Date(now);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const targetDate = yesterday.toISOString().split('T')[0]; // YYYY-MM-DD

    const dayStart = `${targetDate}T00:00:00.000Z`;
    const dayEnd = `${targetDate}T23:59:59.999Z`;

    console.log(`Starting daily rollup for date: ${targetDate}`);

    const result: RollupResult = {
      post_metrics: { processed: 0, errors: 0, diffs: [] },
      account_insights: { processed: 0, errors: 0, diffs: [] },
    };

    // ============================================
    // Post Metrics: hourly → daily (with diff check)
    // ============================================

    const { data: postMetricsHourly, error: pmError } = await serviceClient
      .from('workspace_threads_post_metrics_hourly')
      .select('*')
      .gte('bucket_ts', dayStart)
      .lte('bucket_ts', dayEnd)
      .order('bucket_ts', { ascending: false });

    if (pmError) {
      console.error('Failed to fetch post metrics hourly:', pmError);
    } else if (postMetricsHourly && postMetricsHourly.length > 0) {
      const latestByPost = getLatestByKey(
        postMetricsHourly,
        (r) => r.workspace_threads_post_id
      );

      for (const [postId, calculated] of latestByPost) {
        try {
          const { data: existingDaily } = await serviceClient
            .from('workspace_threads_post_metrics_daily')
            .select('*')
            .eq('workspace_threads_post_id', postId)
            .eq('bucket_date', targetDate)
            .single();

          if (existingDaily) {
            const diffs = compareDiffs(postId, existingDaily, calculated, POST_METRICS_FIELDS);
            result.post_metrics.diffs.push(...diffs);
          }

          // 3. 計算 rate/score
          const rates = calculateRates({
            views: calculated.views ?? 0,
            likes: calculated.likes ?? 0,
            replies: calculated.replies ?? 0,
            reposts: calculated.reposts ?? 0,
            quotes: calculated.quotes ?? 0,
            shares: calculated.shares ?? 0,
          });

          // 4. Upsert（以 Rollup 計算值為準，含 rate/score）
          const { error } = await serviceClient
            .from('workspace_threads_post_metrics_daily')
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
              bucket_date: targetDate,
              captured_at: new Date().toISOString(),
            }, {
              onConflict: 'workspace_threads_post_id,bucket_date',
            });

          if (error) {
            console.error(`Failed to upsert daily post metrics for ${postId}:`, error);
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
    // Account Insights: hourly → daily (with diff check)
    // ============================================

    const { data: accountInsightsHourly, error: aiError } = await serviceClient
      .from('workspace_threads_account_insights_hourly')
      .select('*')
      .gte('bucket_ts', dayStart)
      .lte('bucket_ts', dayEnd)
      .order('bucket_ts', { ascending: false });

    if (aiError) {
      console.error('Failed to fetch account insights hourly:', aiError);
    } else if (accountInsightsHourly && accountInsightsHourly.length > 0) {
      const latestByAccount = getLatestByKey(
        accountInsightsHourly,
        (r) => r.workspace_threads_account_id
      );

      for (const [accountId, calculated] of latestByAccount) {
        try {
          const { data: existingDaily } = await serviceClient
            .from('workspace_threads_account_insights_daily')
            .select('*')
            .eq('workspace_threads_account_id', accountId)
            .eq('bucket_date', targetDate)
            .single();

          if (existingDaily) {
            const diffs = compareDiffs(accountId, existingDaily, calculated, ACCOUNT_INSIGHTS_FIELDS);
            result.account_insights.diffs.push(...diffs);
          }

          // Upsert
          const { error } = await serviceClient
            .from('workspace_threads_account_insights_daily')
            .upsert({
              workspace_threads_account_id: accountId,
              followers_count: calculated.followers_count,
              profile_views: calculated.profile_views,
              likes_count_7d: calculated.likes_count_7d,
              views_count_7d: calculated.views_count_7d,
              demographics: calculated.demographics,
              bucket_date: targetDate,
              captured_at: new Date().toISOString(),
            }, {
              onConflict: 'workspace_threads_account_id,bucket_date',
            });

          if (error) {
            console.error(`Failed to upsert daily account insights for ${accountId}:`, error);
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

    console.log('Daily rollup completed:', {
      date: targetDate,
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
            date: targetDate,
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
      date: targetDate,
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
    console.error('Daily rollup failed:', error);

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
