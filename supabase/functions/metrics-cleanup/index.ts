/**
 * Metrics Cleanup Job
 * ADR-002: 資料保留與 Rollup 策略
 *
 * 執行時機：每日 UTC 05:00（台灣時間 13:00）
 * 功能：清除過期的分層資料
 *
 * 保留策略：
 * ┌─────────────────┬──────────────────┬──────────────────┐
 * │ 層級            │ Post Metrics     │ Account Insights │
 * ├─────────────────┼──────────────────┼──────────────────┤
 * │ 15m（系統保留） │ 168h（7 天）     │ 168h（7 天）     │
 * │ hourly          │ 90 天（3 個月）  │ 30 天            │
 * │ daily           │ 365 天           │ 365 天           │
 * └─────────────────┴──────────────────┴──────────────────┘
 *
 * 注意：15m 用戶存取限制為 72h，額外的 96h 是系統緩衝，用於異常回滾。
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { corsHeaders, handleCors } from '../_shared/cors.ts';

// ============================================
// 保留期設定（小時）
// ============================================

const RETENTION = {
  // Post Metrics
  post_metrics_15m: 168,       // 7 天（系統保留，用戶存取 72h）
  post_metrics_hourly: 90 * 24, // 90 天
  post_metrics_daily: 365,      // 365 天（以天為單位）

  // Account Insights
  account_insights_15m: 168,    // 7 天
  account_insights_hourly: 30 * 24, // 30 天
  account_insights_daily: 365,   // 365 天（以天為單位）
} as const;

interface CleanupResult {
  post_metrics_15m: { deleted: number; error?: string };
  post_metrics_hourly: { deleted: number; error?: string };
  post_metrics_daily: { deleted: number; error?: string };
  account_insights_15m: { deleted: number; error?: string };
  account_insights_hourly: { deleted: number; error?: string };
  account_insights_daily: { deleted: number; error?: string };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return handleCors();
  }

  try {
    const serviceClient = createServiceClient();
    const now = new Date();

    console.log(`Starting metrics cleanup at ${now.toISOString()}`);

    const result: CleanupResult = {
      post_metrics_15m: { deleted: 0 },
      post_metrics_hourly: { deleted: 0 },
      post_metrics_daily: { deleted: 0 },
      account_insights_15m: { deleted: 0 },
      account_insights_hourly: { deleted: 0 },
      account_insights_daily: { deleted: 0 },
    };

    // ============================================
    // Post Metrics 15m：刪除 bucket_ts < (now - 168h)
    // ============================================
    try {
      const cutoff15m = new Date(now.getTime() - RETENTION.post_metrics_15m * 60 * 60 * 1000);
      const { data, error } = await serviceClient
        .from('workspace_threads_post_metrics_15m')
        .delete()
        .lt('bucket_ts', cutoff15m.toISOString())
        .select('id');

      if (error) {
        result.post_metrics_15m.error = error.message;
        console.error('Failed to cleanup post_metrics_15m:', error);
      } else {
        result.post_metrics_15m.deleted = data?.length ?? 0;
        console.log(`Deleted ${result.post_metrics_15m.deleted} rows from post_metrics_15m (cutoff: ${cutoff15m.toISOString()})`);
      }
    } catch (e) {
      result.post_metrics_15m.error = e instanceof Error ? e.message : 'Unknown error';
    }

    // ============================================
    // Post Metrics hourly：刪除 bucket_ts < (now - 90 days)
    // ============================================
    try {
      const cutoffHourly = new Date(now.getTime() - RETENTION.post_metrics_hourly * 60 * 60 * 1000);
      const { data, error } = await serviceClient
        .from('workspace_threads_post_metrics_hourly')
        .delete()
        .lt('bucket_ts', cutoffHourly.toISOString())
        .select('id');

      if (error) {
        result.post_metrics_hourly.error = error.message;
        console.error('Failed to cleanup post_metrics_hourly:', error);
      } else {
        result.post_metrics_hourly.deleted = data?.length ?? 0;
        console.log(`Deleted ${result.post_metrics_hourly.deleted} rows from post_metrics_hourly (cutoff: ${cutoffHourly.toISOString()})`);
      }
    } catch (e) {
      result.post_metrics_hourly.error = e instanceof Error ? e.message : 'Unknown error';
    }

    // ============================================
    // Post Metrics daily：刪除 bucket_date < (now - 365 days)
    // ============================================
    try {
      const cutoffDaily = new Date(now);
      cutoffDaily.setUTCDate(cutoffDaily.getUTCDate() - RETENTION.post_metrics_daily);
      const cutoffDateStr = cutoffDaily.toISOString().split('T')[0];

      const { data, error } = await serviceClient
        .from('workspace_threads_post_metrics_daily')
        .delete()
        .lt('bucket_date', cutoffDateStr)
        .select('id');

      if (error) {
        result.post_metrics_daily.error = error.message;
        console.error('Failed to cleanup post_metrics_daily:', error);
      } else {
        result.post_metrics_daily.deleted = data?.length ?? 0;
        console.log(`Deleted ${result.post_metrics_daily.deleted} rows from post_metrics_daily (cutoff: ${cutoffDateStr})`);
      }
    } catch (e) {
      result.post_metrics_daily.error = e instanceof Error ? e.message : 'Unknown error';
    }

    // ============================================
    // Account Insights 15m：刪除 bucket_ts < (now - 168h)
    // ============================================
    try {
      const cutoff15m = new Date(now.getTime() - RETENTION.account_insights_15m * 60 * 60 * 1000);
      const { data, error } = await serviceClient
        .from('workspace_threads_account_insights_15m')
        .delete()
        .lt('bucket_ts', cutoff15m.toISOString())
        .select('id');

      if (error) {
        result.account_insights_15m.error = error.message;
        console.error('Failed to cleanup account_insights_15m:', error);
      } else {
        result.account_insights_15m.deleted = data?.length ?? 0;
        console.log(`Deleted ${result.account_insights_15m.deleted} rows from account_insights_15m (cutoff: ${cutoff15m.toISOString()})`);
      }
    } catch (e) {
      result.account_insights_15m.error = e instanceof Error ? e.message : 'Unknown error';
    }

    // ============================================
    // Account Insights hourly：刪除 bucket_ts < (now - 30 days)
    // ============================================
    try {
      const cutoffHourly = new Date(now.getTime() - RETENTION.account_insights_hourly * 60 * 60 * 1000);
      const { data, error } = await serviceClient
        .from('workspace_threads_account_insights_hourly')
        .delete()
        .lt('bucket_ts', cutoffHourly.toISOString())
        .select('id');

      if (error) {
        result.account_insights_hourly.error = error.message;
        console.error('Failed to cleanup account_insights_hourly:', error);
      } else {
        result.account_insights_hourly.deleted = data?.length ?? 0;
        console.log(`Deleted ${result.account_insights_hourly.deleted} rows from account_insights_hourly (cutoff: ${cutoffHourly.toISOString()})`);
      }
    } catch (e) {
      result.account_insights_hourly.error = e instanceof Error ? e.message : 'Unknown error';
    }

    // ============================================
    // Account Insights daily：刪除 bucket_date < (now - 365 days)
    // ============================================
    try {
      const cutoffDaily = new Date(now);
      cutoffDaily.setUTCDate(cutoffDaily.getUTCDate() - RETENTION.account_insights_daily);
      const cutoffDateStr = cutoffDaily.toISOString().split('T')[0];

      const { data, error } = await serviceClient
        .from('workspace_threads_account_insights_daily')
        .delete()
        .lt('bucket_date', cutoffDateStr)
        .select('id');

      if (error) {
        result.account_insights_daily.error = error.message;
        console.error('Failed to cleanup account_insights_daily:', error);
      } else {
        result.account_insights_daily.deleted = data?.length ?? 0;
        console.log(`Deleted ${result.account_insights_daily.deleted} rows from account_insights_daily (cutoff: ${cutoffDateStr})`);
      }
    } catch (e) {
      result.account_insights_daily.error = e instanceof Error ? e.message : 'Unknown error';
    }

    // ============================================
    // 計算總結
    // ============================================
    const totalDeleted =
      result.post_metrics_15m.deleted +
      result.post_metrics_hourly.deleted +
      result.post_metrics_daily.deleted +
      result.account_insights_15m.deleted +
      result.account_insights_hourly.deleted +
      result.account_insights_daily.deleted;

    const hasErrors = Object.values(result).some((r) => r.error);

    console.log(`Metrics cleanup completed. Total deleted: ${totalDeleted}, Has errors: ${hasErrors}`);

    return new Response(
      JSON.stringify({
        success: !hasErrors,
        timestamp: now.toISOString(),
        total_deleted: totalDeleted,
        result,
        retention_config: {
          post_metrics_15m: `${RETENTION.post_metrics_15m}h (user access: 72h)`,
          post_metrics_hourly: `${RETENTION.post_metrics_hourly / 24} days`,
          post_metrics_daily: `${RETENTION.post_metrics_daily} days`,
          account_insights_15m: `${RETENTION.account_insights_15m}h`,
          account_insights_hourly: `${RETENTION.account_insights_hourly / 24} days`,
          account_insights_daily: `${RETENTION.account_insights_daily} days`,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: hasErrors ? 207 : 200, // 207 Multi-Status if partial success
      }
    );
  } catch (error) {
    console.error('Metrics cleanup failed:', error);
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
