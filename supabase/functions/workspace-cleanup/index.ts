/**
 * Workspace Cleanup - 清理已刪除的 Workspace
 *
 * POST /workspace-cleanup
 * Headers: Authorization: Bearer <CRON_SECRET>
 *
 * 由排程器每日呼叫：
 * 永久刪除 deleted_at 超過保留期（30 天）的 Workspace
 * FK cascade 會自動清理相關資料
 */

import { handleCors } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.ts';
import { acquireJobLock, releaseJobLock } from '../_shared/job-lock.ts';
import { constantTimeEqual } from '../_shared/crypto.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET');

// 軟刪除保留期（天）
const RETENTION_DAYS = 30;

// 系統表清理保留期（天）
const OAUTH_STATE_USAGE_PURGE_AFTER_DAYS = 1;
const RATE_LIMIT_COUNTERS_PURGE_AFTER_DAYS = 1;
const SYNC_LOGS_RETENTION_DAYS = 30;
const SYSTEM_JOB_LOGS_RETENTION_DAYS = 30;
const JOB_LOCKS_PURGE_AFTER_DAYS = 1;

const JOB_LOCK_TTL_SECONDS = 10 * 60;

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
    const lock = await acquireJobLock(serviceClient, 'workspace_cleanup', JOB_LOCK_TTL_SECONDS);
    if (!lock.acquired) {
      await serviceClient.from('system_job_logs').insert({
        job_type: 'workspace_cleanup',
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

    // 記錄任務開始
    const { data: jobLog } = await serviceClient
      .from('system_job_logs')
      .insert({
        job_type: 'workspace_cleanup',
        status: 'running',
      })
      .select()
      .single();

    // 計算保留期閾值
    const retentionThreshold = new Date(
      Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    // 系統表清理（避免無限增長）
    const oauthStatePurgeBefore = new Date(
      Date.now() - OAUTH_STATE_USAGE_PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const rateLimitPurgeBefore = new Date(
      Date.now() - RATE_LIMIT_COUNTERS_PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const syncLogsPurgeBefore = new Date(
      Date.now() - SYNC_LOGS_RETENTION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const systemJobLogsPurgeBefore = new Date(
      Date.now() - SYSTEM_JOB_LOGS_RETENTION_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();
    const jobLocksPurgeBefore = new Date(
      Date.now() - JOB_LOCKS_PURGE_AFTER_DAYS * 24 * 60 * 60 * 1000
    ).toISOString();

    let oauthStateDeleted = 0;
    let rateLimitDeleted = 0;
    let syncLogsDeleted = 0;
    let systemJobLogsDeleted = 0;
    let jobLocksDeleted = 0;

    const { count: oauthCount, error: oauthCleanupError } = await serviceClient
      .from('oauth_state_usage')
      .delete({ count: 'exact' })
      .lt('expires_at', oauthStatePurgeBefore);

    if (oauthCleanupError) {
      console.error('Failed to cleanup oauth_state_usage:', oauthCleanupError);
    } else {
      oauthStateDeleted = oauthCount ?? 0;
    }

    const { count: rateCount, error: rateCleanupError } = await serviceClient
      .from('rate_limit_counters')
      .delete({ count: 'exact' })
      .lt('reset_at', rateLimitPurgeBefore);

    if (rateCleanupError) {
      console.error('Failed to cleanup rate_limit_counters:', rateCleanupError);
    } else {
      rateLimitDeleted = rateCount ?? 0;
    }

    const { count: syncCount, error: syncCleanupError } = await serviceClient
      .from('sync_logs')
      .delete({ count: 'exact' })
      .lt('started_at', syncLogsPurgeBefore);

    if (syncCleanupError) {
      console.error('Failed to cleanup sync_logs:', syncCleanupError);
    } else {
      syncLogsDeleted = syncCount ?? 0;
    }

    const { count: systemCount, error: systemCleanupError } = await serviceClient
      .from('system_job_logs')
      .delete({ count: 'exact' })
      .lt('started_at', systemJobLogsPurgeBefore);

    if (systemCleanupError) {
      console.error('Failed to cleanup system_job_logs:', systemCleanupError);
    } else {
      systemJobLogsDeleted = systemCount ?? 0;
    }

    const { count: locksCount, error: locksCleanupError } = await serviceClient
      .from('system_job_locks')
      .delete({ count: 'exact' })
      .lt('locked_until', jobLocksPurgeBefore);

    if (locksCleanupError) {
      console.error('Failed to cleanup system_job_locks:', locksCleanupError);
    } else {
      jobLocksDeleted = locksCount ?? 0;
    }

    // 找出需要永久刪除的 Workspace
    const { data: workspacesToDelete, error: fetchError } = await serviceClient
      .from('workspaces')
      .select('id, name, deleted_at')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', retentionThreshold);

    if (fetchError) {
      throw fetchError;
    }

    const deletedWorkspaces: Array<{ id: string; name: string; deleted_at: string }> = [];

    if (workspacesToDelete && workspacesToDelete.length > 0) {
      for (const workspace of workspacesToDelete) {
        // 永久刪除（FK cascade 會清理相關資料）
        const { error: deleteError } = await serviceClient
          .from('workspaces')
          .delete()
          .eq('id', workspace.id);

        if (!deleteError) {
          deletedWorkspaces.push({
            id: workspace.id,
            name: workspace.name,
            deleted_at: workspace.deleted_at,
          });
        } else {
          console.error(`Failed to delete workspace ${workspace.id}:`, deleteError);
        }
      }
    }

    // 更新任務日誌
    await serviceClient
      .from('system_job_logs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        metadata: {
          retention_days: RETENTION_DAYS,
          oauth_state_usage_purge_after_days: OAUTH_STATE_USAGE_PURGE_AFTER_DAYS,
          oauth_state_usage_deleted: oauthStateDeleted,
          rate_limit_counters_purge_after_days: RATE_LIMIT_COUNTERS_PURGE_AFTER_DAYS,
          rate_limit_counters_deleted: rateLimitDeleted,
          sync_logs_retention_days: SYNC_LOGS_RETENTION_DAYS,
          sync_logs_deleted: syncLogsDeleted,
          system_job_logs_retention_days: SYSTEM_JOB_LOGS_RETENTION_DAYS,
          system_job_logs_deleted: systemJobLogsDeleted,
          system_job_locks_purge_after_days: JOB_LOCKS_PURGE_AFTER_DAYS,
          system_job_locks_deleted: jobLocksDeleted,
          deleted_count: deletedWorkspaces.length,
          deleted_workspaces: deletedWorkspaces,
        },
      })
      .eq('id', jobLog?.id);

    await releaseJobLock(serviceClient, 'workspace_cleanup');
    return jsonResponse(req, {
      success: true,
      deleted_count: deletedWorkspaces.length,
      retention_days: RETENTION_DAYS,
    });

  } catch (error) {
    console.error('Workspace cleanup error:', error);
    try {
      const serviceClient = createServiceClient();
      await releaseJobLock(serviceClient, 'workspace_cleanup');
    } catch {
      // ignore
    }
    return errorResponse(req, 'Failed to run workspace cleanup', 500);
  }
});
