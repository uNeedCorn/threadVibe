/**
 * Threads Account Unlink - 解除連結並刪除 Threads 帳號資料 (L1)
 *
 * POST /threads-account-unlink
 * Headers: Authorization: Bearer <user_jwt>
 * Body: { account_id: string }
 *
 * 僅 Workspace Owner 可執行
 *
 * 刪除順序（避免 FK 衝突）：
 * 1. workspace_threads_post_metrics_* (15m/hourly/daily)
 * 2. workspace_threads_post_metrics (legacy)
 * 3. workspace_threads_post_tags
 * 4. workspace_threads_posts
 * 5. workspace_threads_account_insights_* (15m/hourly/daily)
 * 6. workspace_threads_account_insights (legacy)
 * 7. workspace_threads_account_tags
 * 8. workspace_threads_tokens
 * 9. sync_logs
 * 10. workspace_threads_accounts
 */

import { handleCors } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { getAuthenticatedUser, validateWorkspaceMembership } from '../_shared/auth.ts';
import { isUuid } from '../_shared/validation.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '../_shared/response.ts';

interface DeleteStats {
  posts: number;
  metrics_15m: number;
  metrics_hourly: number;
  metrics_daily: number;
  metrics_legacy: number;
  post_tags: number;
  insights_15m: number;
  insights_hourly: number;
  insights_daily: number;
  insights_legacy: number;
  account_tags: number;
  tokens: number;
  sync_logs: number;
}

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return errorResponse(req, 'Method not allowed', 405);
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(req, 'Invalid JSON body', 400, 'INVALID_JSON');
  }

  const { account_id } = (body ?? {}) as { account_id?: string };
  if (!account_id) {
    return errorResponse(req, 'account_id is required', 400);
  }
  if (!isUuid(account_id)) {
    return errorResponse(req, 'Invalid account_id', 400, 'INVALID_ID');
  }

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

  // 取得帳號資訊
  const { data: account, error: accountError } = await serviceClient
    .from('workspace_threads_accounts')
    .select('id, workspace_id, username')
    .eq('id', account_id)
    .single();

  if (accountError || !account) {
    return errorResponse(req, 'Threads account not found', 404);
  }

  // 驗證 Owner 權限
  const ownerMembership = await validateWorkspaceMembership(
    supabase,
    user.id,
    account.workspace_id,
    ['owner']
  );
  if (!ownerMembership) {
    return forbiddenResponse(req, 'Only workspace owner can unlink Threads accounts');
  }

  const stats: DeleteStats = {
    posts: 0,
    metrics_15m: 0,
    metrics_hourly: 0,
    metrics_daily: 0,
    metrics_legacy: 0,
    post_tags: 0,
    insights_15m: 0,
    insights_hourly: 0,
    insights_daily: 0,
    insights_legacy: 0,
    account_tags: 0,
    tokens: 0,
    sync_logs: 0,
  };

  try {
    // 1. 取得所有貼文 ID（用於刪除 metrics 和 tags）
    const { data: posts } = await serviceClient
      .from('workspace_threads_posts')
      .select('id')
      .eq('workspace_threads_account_id', account_id);

    const postIds = posts?.map(p => p.id) || [];

    if (postIds.length > 0) {
      // 2. 刪除貼文成效 - Tiered Tables
      const { count: m15m } = await serviceClient
        .from('workspace_threads_post_metrics_15m')
        .delete({ count: 'exact' })
        .in('post_id', postIds);
      stats.metrics_15m = m15m || 0;

      const { count: mHourly } = await serviceClient
        .from('workspace_threads_post_metrics_hourly')
        .delete({ count: 'exact' })
        .in('post_id', postIds);
      stats.metrics_hourly = mHourly || 0;

      const { count: mDaily } = await serviceClient
        .from('workspace_threads_post_metrics_daily')
        .delete({ count: 'exact' })
        .in('post_id', postIds);
      stats.metrics_daily = mDaily || 0;

      // 3. 刪除貼文成效 - Legacy
      const { count: mLegacy } = await serviceClient
        .from('workspace_threads_post_metrics')
        .delete({ count: 'exact' })
        .in('post_id', postIds);
      stats.metrics_legacy = mLegacy || 0;

      // 4. 刪除貼文標籤
      const { count: postTags } = await serviceClient
        .from('workspace_threads_post_tags')
        .delete({ count: 'exact' })
        .in('post_id', postIds);
      stats.post_tags = postTags || 0;
    }

    // 5. 刪除貼文
    const { count: postsCount } = await serviceClient
      .from('workspace_threads_posts')
      .delete({ count: 'exact' })
      .eq('workspace_threads_account_id', account_id);
    stats.posts = postsCount || 0;

    // 6. 刪除帳號 Insights - Tiered Tables
    const { count: i15m } = await serviceClient
      .from('workspace_threads_account_insights_15m')
      .delete({ count: 'exact' })
      .eq('workspace_threads_account_id', account_id);
    stats.insights_15m = i15m || 0;

    const { count: iHourly } = await serviceClient
      .from('workspace_threads_account_insights_hourly')
      .delete({ count: 'exact' })
      .eq('workspace_threads_account_id', account_id);
    stats.insights_hourly = iHourly || 0;

    const { count: iDaily } = await serviceClient
      .from('workspace_threads_account_insights_daily')
      .delete({ count: 'exact' })
      .eq('workspace_threads_account_id', account_id);
    stats.insights_daily = iDaily || 0;

    // 7. 刪除帳號 Insights - Legacy
    const { count: iLegacy } = await serviceClient
      .from('workspace_threads_account_insights')
      .delete({ count: 'exact' })
      .eq('workspace_threads_account_id', account_id);
    stats.insights_legacy = iLegacy || 0;

    // 8. 刪除帳號標籤
    const { count: accountTags } = await serviceClient
      .from('workspace_threads_account_tags')
      .delete({ count: 'exact' })
      .eq('workspace_threads_account_id', account_id);
    stats.account_tags = accountTags || 0;

    // 9. 刪除 Token
    const { count: tokens } = await serviceClient
      .from('workspace_threads_tokens')
      .delete({ count: 'exact' })
      .eq('workspace_threads_account_id', account_id);
    stats.tokens = tokens || 0;

    // 10. 刪除同步記錄
    const { count: syncLogs } = await serviceClient
      .from('sync_logs')
      .delete({ count: 'exact' })
      .eq('workspace_threads_account_id', account_id);
    stats.sync_logs = syncLogs || 0;

    // 11. 刪除帳號本身
    const { error: deleteAccountError } = await serviceClient
      .from('workspace_threads_accounts')
      .delete()
      .eq('id', account_id);

    if (deleteAccountError) {
      console.error('Failed to delete account:', deleteAccountError);
      return errorResponse(req, 'Failed to delete account', 500);
    }

    console.log(`Successfully deleted Threads account @${account.username}:`, stats);

    return jsonResponse(req, {
      success: true,
      account_id,
      username: account.username,
      deleted: stats,
    });

  } catch (error) {
    console.error('Error during account deletion:', error);
    return errorResponse(req, 'Failed to delete account data', 500);
  }
});
