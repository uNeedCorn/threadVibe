/**
 * Token Auto Revoke - 自動撤銷過期/待撤銷的 Token
 *
 * POST /token-auto-revoke
 * Headers: Authorization: Bearer <CRON_SECRET>
 *
 * 由排程器每日呼叫：
 * 1. 撤銷 auto_revoke_at < now 的 Token
 * 2. 若帳號無有效 Token，設為 inactive
 */

import { handleCors } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.ts';
import { acquireJobLock, releaseJobLock } from '../_shared/job-lock.ts';
import { constantTimeEqual } from '../_shared/crypto.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET');
const JOB_LOCK_TTL_SECONDS = 10 * 60;

interface RevokeResult {
  token_id: string;
  account_id: string;
  reason: string;
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
    const lock = await acquireJobLock(serviceClient, 'token_auto_revoke', JOB_LOCK_TTL_SECONDS);
    if (!lock.acquired) {
      await serviceClient.from('system_job_logs').insert({
        job_type: 'token_auto_revoke',
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

    // 記錄任務開始
    const { data: jobLog } = await serviceClient
      .from('system_job_logs')
      .insert({
        job_type: 'token_auto_revoke',
        status: 'running',
      })
      .select()
      .single();

    const revokedTokens: RevokeResult[] = [];
    const deactivatedAccounts: string[] = [];

    // 1. 撤銷 auto_revoke_at 已過期的 Token
    const { data: autoRevokeTokens, error: fetchError } = await serviceClient
      .from('workspace_threads_tokens')
      .select('id, workspace_threads_account_id')
      .is('revoked_at', null)
      .lt('auto_revoke_at', now);

    if (fetchError) {
      throw fetchError;
    }

    if (autoRevokeTokens && autoRevokeTokens.length > 0) {
      for (const tokenRecord of autoRevokeTokens) {
        await serviceClient
          .from('workspace_threads_tokens')
          .update({
            revoked_at: now,
            is_primary: false,
          })
          .eq('id', tokenRecord.id);

        revokedTokens.push({
          token_id: tokenRecord.id,
          account_id: tokenRecord.workspace_threads_account_id,
          reason: 'auto_revoke_at expired',
        });
      }
    }

    // 2. 撤銷已過期且無法刷新的 Token（過期超過 7 天）
    const expiredThreshold = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: expiredTokens } = await serviceClient
      .from('workspace_threads_tokens')
      .select('id, workspace_threads_account_id')
      .is('revoked_at', null)
      .lt('expires_at', expiredThreshold);

    if (expiredTokens && expiredTokens.length > 0) {
      for (const tokenRecord of expiredTokens) {
        await serviceClient
          .from('workspace_threads_tokens')
          .update({
            revoked_at: now,
            is_primary: false,
          })
          .eq('id', tokenRecord.id);

        revokedTokens.push({
          token_id: tokenRecord.id,
          account_id: tokenRecord.workspace_threads_account_id,
          reason: 'expired beyond refresh window',
        });
      }
    }

    // 3. 找出沒有有效 Token 的帳號，設為 inactive
    const affectedAccountIds = [...new Set(revokedTokens.map((t) => t.account_id))];

    for (const accountId of affectedAccountIds) {
      // 檢查是否還有有效 Token
      const { data: validTokens } = await serviceClient
        .from('workspace_threads_tokens')
        .select('id')
        .eq('workspace_threads_account_id', accountId)
        .is('revoked_at', null)
        .gt('expires_at', now)
        .limit(1);

      if (!validTokens || validTokens.length === 0) {
        // 設為 inactive
        await serviceClient
          .from('workspace_threads_accounts')
          .update({ is_active: false })
          .eq('id', accountId);

        deactivatedAccounts.push(accountId);
      }
    }

    // 更新任務日誌
    await serviceClient
      .from('system_job_logs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        metadata: {
          revoked_count: revokedTokens.length,
          deactivated_accounts_count: deactivatedAccounts.length,
          revoked_tokens: revokedTokens,
          deactivated_accounts: deactivatedAccounts,
        },
      })
      .eq('id', jobLog?.id);

    await releaseJobLock(serviceClient, 'token_auto_revoke');
    return jsonResponse(req, {
      success: true,
      revoked_count: revokedTokens.length,
      deactivated_accounts_count: deactivatedAccounts.length,
    });

  } catch (error) {
    console.error('Token auto revoke error:', error);
    try {
      const serviceClient = createServiceClient();
      await releaseJobLock(serviceClient, 'token_auto_revoke');
    } catch {
      // ignore
    }
    return errorResponse(req, 'Failed to run token auto revoke', 500);
  }
});
