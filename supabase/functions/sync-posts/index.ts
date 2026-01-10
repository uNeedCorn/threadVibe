/**
 * Sync Posts - 同步 Threads 貼文
 *
 * POST /sync-posts
 * Body: { workspace_threads_account_id: string }
 *
 * 從 Threads API 拉取帳號的所有貼文
 */

import { handleCors } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { getAuthenticatedUser, validateWorkspaceMembership } from '../_shared/auth.ts';
import { decrypt } from '../_shared/crypto.ts';
import { ThreadsApiClient } from '../_shared/threads-api.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { isUuid } from '../_shared/validation.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '../_shared/response.ts';

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
      `sync_posts:${user.id}`,
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
    const { data: token, error: tokenError } = await serviceClient
      .from('workspace_threads_tokens')
      .select('access_token_encrypted')
      .eq('workspace_threads_account_id', workspace_threads_account_id)
      .eq('is_primary', true)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (tokenError || !token) {
      return errorResponse(req, 'No valid access token found', 400, 'TOKEN_EXPIRED');
    }

    // 記錄同步開始
    const { data: syncLog } = await serviceClient
      .from('sync_logs')
      .insert({
        workspace_threads_account_id,
        job_type: 'sync_posts',
        status: 'running',
      })
      .select()
      .single();

    try {
      // 解密 Token
      const accessToken = await decrypt(token.access_token_encrypted);
      const threadsClient = new ThreadsApiClient(accessToken);

      // 拉取所有貼文
      const posts = await threadsClient.getUserPosts('me', 100);

      // 正規化並寫入資料庫
      const normalizedPosts = posts.map((post) => ({
        workspace_threads_account_id,
        threads_post_id: post.id,
        text: post.text,
        media_type: post.media_type,
        media_url: post.media_url,
        permalink: post.permalink,
        published_at: post.timestamp ? new Date(post.timestamp).toISOString() : new Date().toISOString(),
      }));

      if (normalizedPosts.length > 0) {
        const { error: upsertError } = await serviceClient
          .from('workspace_threads_posts')
          .upsert(normalizedPosts, {
            onConflict: 'workspace_threads_account_id,threads_post_id',
          });

        if (upsertError) throw upsertError;
      }

      // 更新同步記錄
      await serviceClient
        .from('sync_logs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          metadata: { synced_count: normalizedPosts.length },
        })
        .eq('id', syncLog?.id);

      return jsonResponse(req, {
        success: true,
        synced_count: normalizedPosts.length,
      });

    } catch (syncError) {
      // 更新同步記錄為失敗
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
    console.error('Sync posts error:', error);
    return errorResponse(req, 'Failed to sync posts', 500);
  }
});
