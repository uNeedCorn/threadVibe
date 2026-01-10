/**
 * Sync Account Insights - 同步帳號 Insights（三層式寫入）
 *
 * POST /sync-account-insights
 * Body: { workspace_threads_account_id: string }
 *
 * 同步帳號 Insights（followers_count, profile_views 等）
 * 採用三層式寫入架構
 */

import { handleCors } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { getAuthenticatedUser, validateWorkspaceMembership } from '../_shared/auth.ts';
import { decrypt } from '../_shared/crypto.ts';
import { ThreadsApiClient } from '../_shared/threads-api.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { isUuid } from '../_shared/validation.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '../_shared/response.ts';

interface Insights {
  followers_count: number;
  profile_views: number;
  likes_count_7d: number;
  views_count_7d: number;
}

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return errorResponse(req, 'Method not allowed', 405);
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse(req, 'Invalid JSON body', 400, 'INVALID_JSON');
    }

    const { workspace_threads_account_id } = (body ?? {}) as {
      workspace_threads_account_id?: string;
    };

    if (!workspace_threads_account_id) {
      return errorResponse(req, 'workspace_threads_account_id is required', 400);
    }

    if (!isUuid(workspace_threads_account_id)) {
      return errorResponse(req, 'Invalid workspace_threads_account_id', 400, 'INVALID_ID');
    }

    // 驗證使用者
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return unauthorizedResponse(req, 'Missing authorization header');
    }

    const supabase = createAnonClient(authHeader);
    const user = await getAuthenticatedUser(supabase);

    if (!user) {
      return unauthorizedResponse(req, 'Invalid or expired token');
    }

    const serviceClient = createServiceClient();
    const rateLimit = await checkRateLimit(
      serviceClient,
      `sync_account_insights:${user.id}`,
      10,
      60
    );
    if (!rateLimit.allowed) {
      return errorResponse(req, 'Rate limit exceeded', 429);
    }

    // 取得帳號資訊
    const { data: account, error: accountError } = await serviceClient
      .from('workspace_threads_accounts')
      .select('id, workspace_id, threads_user_id')
      .eq('id', workspace_threads_account_id)
      .single();

    if (accountError || !account) {
      return errorResponse(req, 'Threads account not found', 404);
    }

    // 驗證 Workspace 權限
    const membership = await validateWorkspaceMembership(
      supabase,
      user.id,
      account.workspace_id
    );

    if (!membership) {
      return forbiddenResponse(req, 'No access to this workspace');
    }

    // 取得有效 Token
    const { data: token } = await serviceClient
      .from('workspace_threads_tokens')
      .select('access_token_encrypted')
      .eq('workspace_threads_account_id', workspace_threads_account_id)
      .eq('is_primary', true)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!token) {
      return errorResponse(req, 'No valid access token found', 400, 'TOKEN_EXPIRED');
    }

    // 記錄同步開始
    const { data: syncLog } = await serviceClient
      .from('sync_logs')
      .insert({
        workspace_threads_account_id,
        job_type: 'sync_account_insights',
        status: 'running',
      })
      .select()
      .single();

    try {
      const accessToken = await decrypt(token.access_token_encrypted);
      const threadsClient = new ThreadsApiClient(accessToken);
      const now = new Date().toISOString();

      // 從 Threads API 取得 Insights
      const apiInsights = await threadsClient.getUserInsights();

      const insights: Insights = {
        followers_count: apiInsights.followers_count ?? 0,
        profile_views: 0, // API 可能不提供此欄位
        likes_count_7d: apiInsights.likes ?? 0,
        views_count_7d: apiInsights.views ?? 0,
      };

      // 取得前一個 Snapshot（用於計算 Delta）
      const { data: prevSnapshot } = await serviceClient
        .from('workspace_threads_account_insights')
        .select('*')
        .eq('workspace_threads_account_id', workspace_threads_account_id)
        .order('captured_at', { ascending: false })
        .limit(1)
        .single();

      // Layer 1: 寫入 Snapshot（不可變）
      await serviceClient
        .from('workspace_threads_account_insights')
        .insert({
          workspace_threads_account_id,
          followers_count: insights.followers_count,
          profile_views: insights.profile_views,
          likes_count_7d: insights.likes_count_7d,
          views_count_7d: insights.views_count_7d,
          captured_at: now,
        });

      // Layer 2: 計算並寫入 Delta
      if (prevSnapshot) {
        await serviceClient
          .from('workspace_threads_account_insights_deltas')
          .insert({
            workspace_threads_account_id,
            period_start: prevSnapshot.captured_at,
            period_end: now,
            followers_delta: insights.followers_count - prevSnapshot.followers_count,
            profile_views_delta: insights.profile_views - prevSnapshot.profile_views,
            likes_count_7d_delta: insights.likes_count_7d - prevSnapshot.likes_count_7d,
            views_count_7d_delta: insights.views_count_7d - prevSnapshot.views_count_7d,
            is_recalculated: false,
          });
      }

      // Layer 3: 更新 Current
      await serviceClient
        .from('workspace_threads_accounts')
        .update({
          current_followers_count: insights.followers_count,
          current_profile_views: insights.profile_views,
          current_likes_count_7d: insights.likes_count_7d,
          current_views_count_7d: insights.views_count_7d,
          last_insights_sync_at: now,
        })
        .eq('id', workspace_threads_account_id);

      // 更新同步記錄
      await serviceClient
        .from('sync_logs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          metadata: { insights },
        })
        .eq('id', syncLog?.id);

      return jsonResponse(req, {
        success: true,
        insights,
        has_previous: !!prevSnapshot,
      });

    } catch (syncError) {
      await serviceClient
        .from('sync_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: syncError instanceof Error ? syncError.message : 'Unknown error',
        })
        .eq('id', syncLog?.id);

      throw syncError;
    }

  } catch (error) {
    console.error('Sync account insights error:', error);
    return errorResponse(req, 'Failed to sync account insights', 500);
  }
});
