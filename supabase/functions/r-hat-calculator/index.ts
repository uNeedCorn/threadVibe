/**
 * R̂_t Calculator - 計算再生數估計
 * ADR: diffusion-model-recommendations.md
 *
 * POST /r-hat-calculator
 * Headers: Authorization: Bearer <CRON_SECRET>
 *
 * 從 r_hat_queue 取得待處理任務，計算 R̂_t 並更新表
 */

import { handleCors } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import {
  jsonResponse,
  errorResponse,
  unauthorizedResponse,
} from '../_shared/response.ts';

const BATCH_SIZE = 50;
const CRON_SECRET = Deno.env.get('CRON_SECRET');

// R̂_t 計算所需的最小歷史資料點數
const MIN_DATA_POINTS = 3;
// 感染核權重（對數衰減，越近的影響越大）
const KERNEL_WEIGHTS = [0.5, 0.25, 0.15, 0.07, 0.03]; // 加總 = 1.0

interface QueueJob {
  id: string;
  workspace_threads_post_id: string;
  priority: number;
  attempts: number;
  max_attempts: number;
}

interface MetricsSnapshot {
  reposts: number;
  captured_at: string;
  bucket_ts: string;
}

interface RHatResult {
  r_hat: number | null;
  r_hat_status: string;
  deltas: number[];
}

function getRHatStatusFromValue(rHat: number): string {
  if (rHat > 1.5) return 'viral';
  if (rHat > 1.2) return 'accelerating';
  if (rHat >= 0.8) return 'stable';
  if (rHat >= 0.3) return 'decaying';
  return 'fading';
}

/**
 * 計算 R̂_t (再生數估計)
 *
 * R̂_t = ΔReposts_t / Σ w_k × ΔReposts_{t-k}
 *
 * - r_hat > 1.5: viral（病毒式傳播）
 * - r_hat > 1.2: accelerating（加速擴散）
 * - 0.8 ≤ r_hat ≤ 1.2: stable（穩定）
 * - 0.3 ≤ r_hat < 0.8: decaying（衰退）
 * - r_hat < 0.3: fading（消退）
 */
function calculateRHat(snapshots: MetricsSnapshot[]): RHatResult {
  if (snapshots.length < MIN_DATA_POINTS) {
    return { r_hat: null, r_hat_status: 'insufficient', deltas: [] };
  }

  // 按時間排序（最新的在前）
  const sorted = [...snapshots].sort(
    (a, b) => new Date(b.bucket_ts).getTime() - new Date(a.bucket_ts).getTime()
  );

  // 計算 delta（與前一個時間點的差異）
  const deltas: number[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const delta = sorted[i].reposts - sorted[i + 1].reposts;
    deltas.push(Math.max(0, delta)); // 確保非負
  }

  if (deltas.length === 0 || deltas[0] === 0) {
    // 當前週期沒有新轉發
    return { r_hat: 0, r_hat_status: 'fading', deltas };
  }

  // 計算加權分母：Σ w_k × ΔReposts_{t-k}
  let weightedSum = 0;
  for (let k = 1; k < deltas.length && k < KERNEL_WEIGHTS.length + 1; k++) {
    weightedSum += KERNEL_WEIGHTS[k - 1] * deltas[k];
  }

  // 避免除以零
  if (weightedSum === 0) {
    // 歷史沒有轉發，但當前有 → 初始爆發
    return { r_hat: 999, r_hat_status: 'viral', deltas };
  }

  const rHat = deltas[0] / weightedSum;
  const status = getRHatStatusFromValue(rHat);

  return {
    r_hat: Math.round(rHat * 1000) / 1000, // 保留 3 位小數
    r_hat_status: status,
    deltas,
  };
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return errorResponse(req, 'Method not allowed', 405);
  }

  try {
    // 驗證 CRON_SECRET
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!CRON_SECRET || token !== CRON_SECRET) {
      return unauthorizedResponse(req, 'Invalid cron secret');
    }

    const serviceClient = createServiceClient();
    const now = new Date().toISOString();

    // 取得待處理任務（按優先級和建立時間排序）
    const { data: jobs, error: fetchError } = await serviceClient
      .from('r_hat_queue')
      .select('id, workspace_threads_post_id, priority, attempts, max_attempts')
      .or('status.eq.pending,and(status.eq.failed,attempts.lt.3)')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('Failed to fetch jobs:', fetchError);
      return errorResponse(req, 'Failed to fetch jobs', 500);
    }

    if (!jobs || jobs.length === 0) {
      return jsonResponse(req, { message: 'No jobs to process', processed: 0 });
    }

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    for (const job of jobs as QueueJob[]) {
      try {
        // 標記為 processing
        await serviceClient
          .from('r_hat_queue')
          .update({
            status: 'processing',
            started_at: now,
            attempts: job.attempts + 1,
          })
          .eq('id', job.id);

        // 取得最近的 15m 快照（最多 10 個時間點，約 2.5 小時）
        const { data: snapshots, error: snapshotError } = await serviceClient
          .from('workspace_threads_post_metrics_15m')
          .select('reposts, captured_at, bucket_ts')
          .eq('workspace_threads_post_id', job.workspace_threads_post_id)
          .order('bucket_ts', { ascending: false })
          .limit(10);

        if (snapshotError) {
          throw new Error(`Failed to fetch snapshots: ${snapshotError.message}`);
        }

        if (!snapshots || snapshots.length < MIN_DATA_POINTS) {
          // 資料不足，標記為 skipped
          await serviceClient
            .from('r_hat_queue')
            .update({
              status: 'skipped',
              completed_at: now,
              calculated_r_hat: null,
              calculated_r_hat_status: 'insufficient',
            })
            .eq('id', job.id);

          skipped++;
          continue;
        }

        // 計算 R̂_t
        const result = calculateRHat(snapshots as MetricsSnapshot[]);

        // 更新 r_hat_queue 快取
        await serviceClient
          .from('r_hat_queue')
          .update({
            status: 'completed',
            completed_at: now,
            calculated_r_hat: result.r_hat,
            calculated_r_hat_status: result.r_hat_status,
          })
          .eq('id', job.id);

        // 取得最新的 bucket_ts 以確定要更新哪一筆
        const latestBucketTs = snapshots[0].bucket_ts;
        const latestBucketDate = latestBucketTs.split('T')[0];
        const latestBucketHour = new Date(latestBucketTs);
        latestBucketHour.setMinutes(0, 0, 0);

        // 更新 15m 表（最新一筆）
        await serviceClient
          .from('workspace_threads_post_metrics_15m')
          .update({
            r_hat: result.r_hat,
            r_hat_status: result.r_hat_status,
          })
          .eq('workspace_threads_post_id', job.workspace_threads_post_id)
          .eq('bucket_ts', latestBucketTs);

        // 更新 hourly 表
        await serviceClient
          .from('workspace_threads_post_metrics_hourly')
          .update({
            r_hat: result.r_hat,
            r_hat_status: result.r_hat_status,
          })
          .eq('workspace_threads_post_id', job.workspace_threads_post_id)
          .eq('bucket_ts', latestBucketHour.toISOString());

        // 更新 daily 表
        await serviceClient
          .from('workspace_threads_post_metrics_daily')
          .update({
            r_hat: result.r_hat,
            r_hat_status: result.r_hat_status,
          })
          .eq('workspace_threads_post_id', job.workspace_threads_post_id)
          .eq('bucket_date', latestBucketDate);

        // 更新 L3 Current 表
        await serviceClient
          .from('workspace_threads_posts')
          .update({
            current_r_hat: result.r_hat,
            current_r_hat_status: result.r_hat_status,
          })
          .eq('id', job.workspace_threads_post_id);

        processed++;
        console.log(
          `Post ${job.workspace_threads_post_id}: R̂_t = ${result.r_hat} (${result.r_hat_status})`
        );
      } catch (error) {
        console.error(`Failed to process job ${job.id}:`, error);

        await serviceClient
          .from('r_hat_queue')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', job.id);

        failed++;
      }
    }

    console.log(`R̂_t calculation complete: ${processed} processed, ${skipped} skipped, ${failed} failed`);

    return jsonResponse(req, {
      message: 'Processing complete',
      processed,
      skipped,
      failed,
      total: jobs.length,
    });
  } catch (error) {
    console.error('R̂_t calculator error:', error);
    return errorResponse(req, 'Failed to process R̂_t calculation', 500);
  }
});
