/**
 * Delete Workspace - 刪除 Workspace 及所有相關資料 (L2)
 *
 * POST /delete-workspace
 * Headers: Authorization: Bearer <user_jwt>
 * Body: { workspace_id: string, confirmation: string }
 *
 * 僅 Workspace Owner 可執行
 * confirmation 必須等於 Workspace 名稱
 *
 * 刪除順序：
 * 1. 對每個 Threads 帳號執行完整刪除（同 L1）
 * 2. 刪除 workspace_members
 * 3. 刪除 workspaces
 */

import { handleCors } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { getAuthenticatedUser, validateWorkspaceMembership } from '../_shared/auth.ts';
import { isUuid } from '../_shared/validation.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '../_shared/response.ts';

interface DeleteStats {
  accounts: number;
  posts: number;
  metrics: number;
  tags: number;
  insights: number;
  tokens: number;
  members: number;
}

async function deleteThreadsAccountData(
  serviceClient: ReturnType<typeof createServiceClient>,
  accountId: string
): Promise<{ posts: number; metrics: number; tags: number; insights: number; tokens: number }> {
  let posts = 0, metrics = 0, tags = 0, insights = 0, tokens = 0;

  // 取得所有貼文 ID
  const { data: postData } = await serviceClient
    .from('workspace_threads_posts')
    .select('id')
    .eq('workspace_threads_account_id', accountId);

  const postIds = postData?.map(p => p.id) || [];

  if (postIds.length > 0) {
    // 刪除貼文成效 - Tiered Tables
    const { count: m15m } = await serviceClient
      .from('workspace_threads_post_metrics_15m')
      .delete({ count: 'exact' })
      .in('post_id', postIds);
    metrics += m15m || 0;

    const { count: mHourly } = await serviceClient
      .from('workspace_threads_post_metrics_hourly')
      .delete({ count: 'exact' })
      .in('post_id', postIds);
    metrics += mHourly || 0;

    const { count: mDaily } = await serviceClient
      .from('workspace_threads_post_metrics_daily')
      .delete({ count: 'exact' })
      .in('post_id', postIds);
    metrics += mDaily || 0;

    // 刪除貼文成效 - Legacy
    const { count: mLegacy } = await serviceClient
      .from('workspace_threads_post_metrics')
      .delete({ count: 'exact' })
      .in('post_id', postIds);
    metrics += mLegacy || 0;

    // 刪除貼文標籤
    const { count: postTags } = await serviceClient
      .from('workspace_threads_post_tags')
      .delete({ count: 'exact' })
      .in('post_id', postIds);
    tags += postTags || 0;
  }

  // 刪除貼文
  const { count: postsCount } = await serviceClient
    .from('workspace_threads_posts')
    .delete({ count: 'exact' })
    .eq('workspace_threads_account_id', accountId);
  posts = postsCount || 0;

  // 刪除帳號 Insights - Tiered Tables
  const { count: i15m } = await serviceClient
    .from('workspace_threads_account_insights_15m')
    .delete({ count: 'exact' })
    .eq('workspace_threads_account_id', accountId);
  insights += i15m || 0;

  const { count: iHourly } = await serviceClient
    .from('workspace_threads_account_insights_hourly')
    .delete({ count: 'exact' })
    .eq('workspace_threads_account_id', accountId);
  insights += iHourly || 0;

  const { count: iDaily } = await serviceClient
    .from('workspace_threads_account_insights_daily')
    .delete({ count: 'exact' })
    .eq('workspace_threads_account_id', accountId);
  insights += iDaily || 0;

  // 刪除帳號 Insights - Legacy
  const { count: iLegacy } = await serviceClient
    .from('workspace_threads_account_insights')
    .delete({ count: 'exact' })
    .eq('workspace_threads_account_id', accountId);
  insights += iLegacy || 0;

  // 刪除帳號標籤
  const { count: accountTags } = await serviceClient
    .from('workspace_threads_account_tags')
    .delete({ count: 'exact' })
    .eq('workspace_threads_account_id', accountId);
  tags += accountTags || 0;

  // 刪除 Token
  const { count: tokensCount } = await serviceClient
    .from('workspace_threads_tokens')
    .delete({ count: 'exact' })
    .eq('workspace_threads_account_id', accountId);
  tokens = tokensCount || 0;

  // 刪除同步記錄
  await serviceClient
    .from('sync_logs')
    .delete()
    .eq('workspace_threads_account_id', accountId);

  return { posts, metrics, tags, insights, tokens };
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

  const { workspace_id, confirmation } = (body ?? {}) as {
    workspace_id?: string;
    confirmation?: string;
  };

  if (!workspace_id) {
    return errorResponse(req, 'workspace_id is required', 400);
  }
  if (!isUuid(workspace_id)) {
    return errorResponse(req, 'Invalid workspace_id', 400, 'INVALID_ID');
  }
  if (!confirmation) {
    return errorResponse(req, 'confirmation is required', 400);
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

  // 取得 Workspace 資訊
  const { data: workspace, error: workspaceError } = await serviceClient
    .from('workspaces')
    .select('id, name')
    .eq('id', workspace_id)
    .single();

  if (workspaceError || !workspace) {
    return errorResponse(req, 'Workspace not found', 404);
  }

  // 驗證確認文字
  if (confirmation !== workspace.name) {
    return errorResponse(req, 'Confirmation does not match workspace name', 400, 'INVALID_CONFIRMATION');
  }

  // 驗證 Owner 權限
  const ownerMembership = await validateWorkspaceMembership(
    supabase,
    user.id,
    workspace_id,
    ['owner']
  );
  if (!ownerMembership) {
    return forbiddenResponse(req, 'Only workspace owner can delete workspace');
  }

  const stats: DeleteStats = {
    accounts: 0,
    posts: 0,
    metrics: 0,
    tags: 0,
    insights: 0,
    tokens: 0,
    members: 0,
  };

  try {
    // 1. 取得所有 Threads 帳號
    const { data: accounts } = await serviceClient
      .from('workspace_threads_accounts')
      .select('id, username')
      .eq('workspace_id', workspace_id);

    // 2. 刪除每個 Threads 帳號的資料
    for (const account of accounts || []) {
      const accountStats = await deleteThreadsAccountData(serviceClient, account.id);
      stats.posts += accountStats.posts;
      stats.metrics += accountStats.metrics;
      stats.tags += accountStats.tags;
      stats.insights += accountStats.insights;
      stats.tokens += accountStats.tokens;
    }

    // 3. 刪除 Threads 帳號本身
    const { count: accountsCount } = await serviceClient
      .from('workspace_threads_accounts')
      .delete({ count: 'exact' })
      .eq('workspace_id', workspace_id);
    stats.accounts = accountsCount || 0;

    // 4. 刪除成員關係
    const { count: membersCount } = await serviceClient
      .from('workspace_members')
      .delete({ count: 'exact' })
      .eq('workspace_id', workspace_id);
    stats.members = membersCount || 0;

    // 5. 刪除 Workspace
    const { error: deleteError } = await serviceClient
      .from('workspaces')
      .delete()
      .eq('id', workspace_id);

    if (deleteError) {
      console.error('Failed to delete workspace:', deleteError);
      return errorResponse(req, 'Failed to delete workspace', 500);
    }

    console.log(`Successfully deleted workspace "${workspace.name}":`, stats);

    return jsonResponse(req, {
      success: true,
      workspace_id,
      workspace_name: workspace.name,
      deleted: stats,
    });

  } catch (error) {
    console.error('Error during workspace deletion:', error);
    return errorResponse(req, 'Failed to delete workspace', 500);
  }
});
