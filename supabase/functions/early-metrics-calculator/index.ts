/**
 * Early Metrics Calculator - 計算貼文早期表現指標
 *
 * POST /early-metrics-calculator
 * Headers: Authorization: Bearer <CRON_SECRET | SERVICE_ROLE_KEY>
 *
 * 功能：
 * 1. first_hour_views: 發布後 1 小時內的曝光數
 * 2. first_24h_views: 發布後 24 小時內的曝光數
 * 3. peak_hour: 曝光增量最大的小時（發布後第幾小時）
 *
 * 執行時機：每小時執行一次
 */

import { handleCors } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.ts';
import { constantTimeEqual } from '../_shared/crypto.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface EarlyMetricsRequest {
  mode?: 'normal' | 'backfill';
  limit?: number;
}

interface HourlyMetric {
  bucket_ts: string;
  views: number;
}

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return errorResponse(req, 'Method not allowed', 405);
  }

  try {
    // 驗證 CRON_SECRET 或 SERVICE_ROLE_KEY
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const isValidCronSecret = CRON_SECRET && token && constantTimeEqual(token, CRON_SECRET);
    const isValidServiceRole = SERVICE_ROLE_KEY && token && constantTimeEqual(token, SERVICE_ROLE_KEY);

    if (!isValidCronSecret && !isValidServiceRole) {
      return unauthorizedResponse(req, 'Invalid authorization');
    }

    const serviceClient = createServiceClient();
    const body: EarlyMetricsRequest = await req.json().catch(() => ({}));
    const { mode = 'normal', limit = 100 } = body;

    const now = new Date();
    const results = {
      first_hour: { processed: 0, updated: 0 },
      first_24h: { processed: 0, updated: 0 },
      peak_hour: { processed: 0, updated: 0 },
    };

    // ============================================
    // 1. Calculate first_hour_views
    // ============================================
    // 找出發布超過 1 小時但還沒有 first_hour_views 的貼文
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const { data: postsNeedFirstHour } = await serviceClient
      .from('workspace_threads_posts')
      .select('id, published_at')
      .is('first_hour_views', null)
      .lt('published_at', oneHourAgo.toISOString())
      .order('published_at', { ascending: false })
      .limit(limit);

    if (postsNeedFirstHour && postsNeedFirstHour.length > 0) {
      results.first_hour.processed = postsNeedFirstHour.length;

      for (const post of postsNeedFirstHour) {
        const publishedAt = new Date(post.published_at);
        const targetTime = new Date(publishedAt.getTime() + 60 * 60 * 1000); // +1 hour

        // 找最接近 1 小時的 hourly 數據
        const { data: hourlyData } = await serviceClient
          .from('workspace_threads_post_metrics_hourly')
          .select('views, bucket_ts')
          .eq('workspace_threads_post_id', post.id)
          .lte('bucket_ts', targetTime.toISOString())
          .order('bucket_ts', { ascending: false })
          .limit(1)
          .single();

        if (hourlyData) {
          await serviceClient
            .from('workspace_threads_posts')
            .update({ first_hour_views: hourlyData.views })
            .eq('id', post.id);
          results.first_hour.updated++;
        }
      }
    }

    // ============================================
    // 2. Calculate first_24h_views
    // ============================================
    // 找出發布超過 24 小時但還沒有 first_24h_views 的貼文
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data: postsNeedFirst24h } = await serviceClient
      .from('workspace_threads_posts')
      .select('id, published_at')
      .is('first_24h_views', null)
      .lt('published_at', twentyFourHoursAgo.toISOString())
      .order('published_at', { ascending: false })
      .limit(limit);

    if (postsNeedFirst24h && postsNeedFirst24h.length > 0) {
      results.first_24h.processed = postsNeedFirst24h.length;

      for (const post of postsNeedFirst24h) {
        const publishedAt = new Date(post.published_at);
        const targetTime = new Date(publishedAt.getTime() + 24 * 60 * 60 * 1000); // +24 hours

        // 找最接近 24 小時的 hourly 數據
        const { data: hourlyData } = await serviceClient
          .from('workspace_threads_post_metrics_hourly')
          .select('views, bucket_ts')
          .eq('workspace_threads_post_id', post.id)
          .lte('bucket_ts', targetTime.toISOString())
          .order('bucket_ts', { ascending: false })
          .limit(1)
          .single();

        if (hourlyData) {
          await serviceClient
            .from('workspace_threads_posts')
            .update({ first_24h_views: hourlyData.views })
            .eq('id', post.id);
          results.first_24h.updated++;
        }
      }
    }

    // ============================================
    // 3. Calculate peak_hour
    // ============================================
    // 找出 7 天內還沒有 peak_hour 的貼文（或在 backfill 模式下處理更多）
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // 在 backfill 模式下，處理 3 個月內的貼文
    const peakHourCutoff = mode === 'backfill' ? threeMonthsAgo : sevenDaysAgo;

    const { data: postsNeedPeakHour } = await serviceClient
      .from('workspace_threads_posts')
      .select('id, published_at')
      .is('peak_hour', null)
      .gt('published_at', peakHourCutoff.toISOString())
      .order('published_at', { ascending: false })
      .limit(limit);

    if (postsNeedPeakHour && postsNeedPeakHour.length > 0) {
      results.peak_hour.processed = postsNeedPeakHour.length;

      for (const post of postsNeedPeakHour) {
        const publishedAt = new Date(post.published_at);

        // 取得所有 hourly 數據
        const { data: hourlyMetrics } = await serviceClient
          .from('workspace_threads_post_metrics_hourly')
          .select('bucket_ts, views')
          .eq('workspace_threads_post_id', post.id)
          .order('bucket_ts', { ascending: true });

        if (hourlyMetrics && hourlyMetrics.length >= 2) {
          // 計算每小時的曝光增量
          let maxDelta = 0;
          let peakBucketTs: string | null = null;

          for (let i = 1; i < hourlyMetrics.length; i++) {
            const delta = hourlyMetrics[i].views - hourlyMetrics[i - 1].views;
            if (delta > maxDelta) {
              maxDelta = delta;
              peakBucketTs = hourlyMetrics[i].bucket_ts;
            }
          }

          if (peakBucketTs) {
            // 計算是發布後第幾小時
            const peakTime = new Date(peakBucketTs);
            const hoursAfterPublish = Math.round(
              (peakTime.getTime() - publishedAt.getTime()) / (60 * 60 * 1000)
            );

            await serviceClient
              .from('workspace_threads_posts')
              .update({ peak_hour: hoursAfterPublish })
              .eq('id', post.id);
            results.peak_hour.updated++;
          }
        }
      }
    }

    return jsonResponse(req, {
      success: true,
      mode,
      results,
    });
  } catch (error) {
    console.error('Early metrics calculator error:', error);
    return errorResponse(req, 'Failed to calculate early metrics', 500);
  }
});
