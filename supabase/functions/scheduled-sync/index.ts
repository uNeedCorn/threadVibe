/**
 * Scheduled Sync - 排程同步所有活躍帳號
 *
 * POST /scheduled-sync
 * Headers: Authorization: Bearer <CRON_SECRET>
 *
 * 由排程器（pg_cron 或外部 cron）呼叫，
 * 完整同步流程：posts → metrics → account insights
 */

import { handleCors } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { decrypt, constantTimeEqual } from '../_shared/crypto.ts';
import { ThreadsApiClient } from '../_shared/threads-api.ts';
import {
  syncPostsForAccount,
  syncMetricsForAccount,
  syncAccountInsightsForAccount,
} from '../_shared/sync.ts';
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.ts';
import { acquireJobLock, releaseJobLock } from '../_shared/job-lock.ts';
import { notifyError } from '../_shared/notification.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET');
const BATCH_SIZE = 5;
const BATCH_DELAY_MS = 2000;
const JOB_LOCK_TTL_SECONDS = 30 * 60;

/**
 * 計算同步批次時間（對齊到 15 分鐘區間）
 * 例如：13:17:45 → 13:15:00
 */
function calculateSyncBatchAt(date: Date): string {
  const minutes = date.getMinutes();
  const alignedMinutes = Math.floor(minutes / 15) * 15;
  const aligned = new Date(date);
  aligned.setMinutes(alignedMinutes, 0, 0);
  return aligned.toISOString();
}

interface AccountSyncResult {
  account_id: string;
  username: string;
  posts_synced: number;
  posts_enqueued: number;
  metrics_success: number;
  metrics_error: number;
  insights_synced: boolean;
  error?: string;
}

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return errorResponse(req, 'Method not allowed', 405);
  }

  try {
    // 驗證 CRON_SECRET
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!CRON_SECRET || !token || !constantTimeEqual(token, CRON_SECRET)) {
      return unauthorizedResponse(req, 'Invalid cron secret');
    }

    const serviceClient = createServiceClient();
    const lock = await acquireJobLock(serviceClient, 'scheduled_sync', JOB_LOCK_TTL_SECONDS);
    if (!lock.acquired) {
      await serviceClient.from('system_job_logs').insert({
        job_type: 'scheduled_sync',
        status: 'completed',
        metadata: {
          skipped: true,
          reason: 'already_running',
          locked_until: lock.locked_until,
        },
      });

      return jsonResponse(req, {
        success: true,
        skipped: true,
        reason: 'already_running',
        locked_until: lock.locked_until,
      });
    }

    const now = new Date().toISOString();

    // 取得所有活躍帳號（有有效 token）
    const { data: accounts, error: accountsError } = await serviceClient
      .from('workspace_threads_accounts')
      .select(`
        id,
        username,
        workspace_threads_tokens!inner (
          access_token_encrypted,
          expires_at
        )
      `)
      .eq('is_active', true)
      .eq('workspace_threads_tokens.is_primary', true)
      .is('workspace_threads_tokens.revoked_at', null)
      .gt('workspace_threads_tokens.expires_at', now);

    if (accountsError) {
      console.error('Failed to fetch accounts:', accountsError);
      await releaseJobLock(serviceClient, 'scheduled_sync');
      return errorResponse(req, 'Failed to fetch accounts', 500);
    }

    if (!accounts || accounts.length === 0) {
      await releaseJobLock(serviceClient, 'scheduled_sync');
      return jsonResponse(req, {
        success: true,
        message: 'No active accounts to sync',
        synced_count: 0,
      });
    }

    // 記錄同步開始（使用 system_job_logs）
    const { data: jobLog } = await serviceClient
      .from('system_job_logs')
      .insert({
        job_type: 'scheduled_sync',
        status: 'running',
        metadata: { total_accounts: accounts.length },
      })
      .select()
      .single();

    const results: AccountSyncResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    // 批次處理帳號
    for (let i = 0; i < accounts.length; i += BATCH_SIZE) {
      const batch = accounts.slice(i, i + BATCH_SIZE);
      // 計算此批次的同步批次時間（對齊到 15 分鐘）
      const batchStartTime = new Date();
      const syncBatchAt = calculateSyncBatchAt(batchStartTime);

      await Promise.all(
        batch.map(async (account) => {
          const result: AccountSyncResult = {
            account_id: account.id,
            username: account.username,
            posts_synced: 0,
            posts_enqueued: 0,
            metrics_success: 0,
            metrics_error: 0,
            insights_synced: false,
          };

          try {
            const tokenData = account.workspace_threads_tokens[0];
            const accessToken = await decrypt(tokenData.access_token_encrypted);
            const threadsClient = new ThreadsApiClient(accessToken);
            const syncTime = new Date().toISOString();

            // 1. 同步貼文（必須先做，metrics 才有 post 可參照）
            const postsResult = await syncPostsForAccount(
              serviceClient,
              account.id,
              threadsClient,
              50
            );
            result.posts_synced = postsResult.synced_count;
            result.posts_enqueued = postsResult.enqueue_count;

            // 記錄單一帳號的貼文同步到 sync_logs
            await serviceClient.from('sync_logs').insert({
              workspace_threads_account_id: account.id,
              job_type: 'sync_posts',
              status: 'completed',
              completed_at: new Date().toISOString(),
              metadata: { synced_count: postsResult.synced_count, enqueue_count: postsResult.enqueue_count },
            });

            // 2. 同步貼文成效（三層式）
            const metricsResult = await syncMetricsForAccount(
              serviceClient,
              account.id,
              threadsClient,
              syncTime,
              syncBatchAt
            );
            result.metrics_success = metricsResult.success_count;
            result.metrics_error = metricsResult.error_count;

            // 記錄成效同步
            await serviceClient.from('sync_logs').insert({
              workspace_threads_account_id: account.id,
              job_type: 'sync_metrics',
              status: metricsResult.error_count === 0 ? 'completed' : 'partial',
              completed_at: new Date().toISOString(),
              metadata: metricsResult,
            });

            // 3. 同步帳號 Insights（三層式）
            const insightsResult = await syncAccountInsightsForAccount(
              serviceClient,
              account.id,
              threadsClient,
              syncTime,
              syncBatchAt
            );
            result.insights_synced = true;

            // 記錄 Insights 同步
            await serviceClient.from('sync_logs').insert({
              workspace_threads_account_id: account.id,
              job_type: 'sync_account_insights',
              status: 'completed',
              completed_at: new Date().toISOString(),
              metadata: insightsResult,
            });

            successCount++;
          } catch (error) {
            result.error = error instanceof Error ? error.message : 'Unknown error';
            errorCount++;
            console.error(`Sync failed for account ${account.id}:`, error);
          }

          results.push(result);
        })
      );

      // 批次間延遲
      if (i + BATCH_SIZE < accounts.length) {
        await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
      }
    }

    // 更新系統任務日誌
    const finalStatus = errorCount === 0 ? 'completed' : (successCount === 0 ? 'failed' : 'partial');
    await serviceClient
      .from('system_job_logs')
      .update({
        status: finalStatus,
        completed_at: new Date().toISOString(),
        metadata: {
          total_accounts: accounts.length,
          success_count: successCount,
          error_count: errorCount,
          results,
        },
      })
      .eq('id', jobLog?.id);

    await releaseJobLock(serviceClient, 'scheduled_sync');
    return jsonResponse(req, {
      success: true,
      total_accounts: accounts.length,
      success_count: successCount,
      error_count: errorCount,
      results,
    });

  } catch (error) {
    console.error('Scheduled sync error:', error);

    // 發送 Telegram 通知
    await notifyError({
      jobType: 'scheduled-sync',
      error: error instanceof Error ? error.message : String(error),
    });

    try {
      const serviceClient = createServiceClient();
      await releaseJobLock(serviceClient, 'scheduled_sync');
    } catch {
      // ignore
    }
    return errorResponse(req, 'Failed to run scheduled sync', 500);
  }
});
