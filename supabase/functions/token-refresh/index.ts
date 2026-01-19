/**
 * Token Refresh - 自動更新即將過期的 Token
 *
 * POST /token-refresh
 * Headers: Authorization: Bearer <CRON_SECRET>
 *
 * 由排程器呼叫，更新 7 天內即將過期的 Token
 */

import { handleCors } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { encrypt, decrypt, constantTimeEqual } from '../_shared/crypto.ts';
import { ThreadsApiClient } from '../_shared/threads-api.ts';
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.ts';
import { acquireJobLock, releaseJobLock } from '../_shared/job-lock.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET');

// 提前 7 天更新 Token
const REFRESH_THRESHOLD_DAYS = 7;
const JOB_LOCK_TTL_SECONDS = 30 * 60;

interface RefreshResult {
  token_id: string;
  account_id: string;
  username: string;
  success: boolean;
  new_expires_at?: string;
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
    const lock = await acquireJobLock(serviceClient, 'token_refresh', JOB_LOCK_TTL_SECONDS);
    if (!lock.acquired) {
      await serviceClient.from('system_job_logs').insert({
        job_type: 'token_refresh',
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

    const now = new Date();
    const thresholdDate = new Date(now.getTime() + REFRESH_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

    // 取得即將過期的 Token
    const { data: tokens, error: tokensError } = await serviceClient
      .from('workspace_threads_tokens')
      .select(`
        id,
        access_token_encrypted,
        expires_at,
        workspace_threads_account_id,
        workspace_threads_accounts!inner (
          id,
          username
        )
      `)
      .eq('is_primary', true)
      .is('revoked_at', null)
      .gt('expires_at', now.toISOString())
      .lt('expires_at', thresholdDate.toISOString());

    if (tokensError) {
      console.error('Failed to fetch tokens:', tokensError);
      await releaseJobLock(serviceClient, 'token_refresh');
      return errorResponse(req, 'Failed to fetch tokens', 500);
    }

    if (!tokens || tokens.length === 0) {
      await releaseJobLock(serviceClient, 'token_refresh');
      return jsonResponse(req, {
        success: true,
        message: 'No tokens need refresh',
        refreshed_count: 0,
      });
    }

    const { data: jobLog } = await serviceClient
      .from('system_job_logs')
      .insert({
        job_type: 'token_refresh',
        status: 'running',
        metadata: { total_tokens: tokens.length },
      })
      .select()
      .single();

    const results: RefreshResult[] = [];
    let successCount = 0;
    let errorCount = 0;

    for (const tokenRecord of tokens) {
      const account = tokenRecord.workspace_threads_accounts;
      const result: RefreshResult = {
        token_id: tokenRecord.id,
        account_id: tokenRecord.workspace_threads_account_id,
        username: account.username,
        success: false,
      };

      try {
        // 解密現有 Token
        const accessToken = await decrypt(tokenRecord.access_token_encrypted);

        // 使用 Threads API 更新 Token
        const newTokenData = await ThreadsApiClient.refreshLongLivedToken(accessToken);

        // 加密新 Token
        const encryptedToken = await encrypt(newTokenData.access_token);
        const newExpiresAt = new Date(now.getTime() + newTokenData.expires_in * 1000);

        // 更新資料庫
        await serviceClient
          .from('workspace_threads_tokens')
          .update({
            access_token_encrypted: encryptedToken,
            expires_at: newExpiresAt.toISOString(),
            refreshed_at: now.toISOString(),
          })
          .eq('id', tokenRecord.id);

        result.success = true;
        result.new_expires_at = newExpiresAt.toISOString();
        successCount++;
      } catch (error) {
        result.error = error instanceof Error ? error.message : 'Unknown error';
        errorCount++;
        console.error(`Token refresh failed for ${tokenRecord.id}:`, error);

        // 如果 refresh 失敗，標記 token 狀態
        await serviceClient
          .from('workspace_threads_tokens')
          .update({
            refresh_error: result.error,
            refresh_error_at: now.toISOString(),
          })
          .eq('id', tokenRecord.id);
      }

      results.push(result);
    }

    const finalStatus = errorCount === 0 ? 'completed' : (successCount === 0 ? 'failed' : 'partial');
    await serviceClient
      .from('system_job_logs')
      .update({
        status: finalStatus,
        completed_at: now.toISOString(),
        metadata: {
          total_tokens: tokens.length,
          refreshed_count: successCount,
          error_count: errorCount,
          results,
        },
      })
      .eq('id', jobLog?.id);

    await releaseJobLock(serviceClient, 'token_refresh');
    return jsonResponse(req, {
      success: true,
      total_tokens: tokens.length,
      refreshed_count: successCount,
      error_count: errorCount,
      results,
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    try {
      const serviceClient = createServiceClient();
      await releaseJobLock(serviceClient, 'token_refresh');
    } catch {
      // ignore
    }
    return errorResponse(req, 'Failed to refresh tokens', 500);
  }
});
