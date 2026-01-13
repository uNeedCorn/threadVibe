/**
 * Delete User Account - 刪除用戶帳號及所有相關資料 (L3)
 *
 * POST /delete-user-account
 * Headers: Authorization: Bearer <user_jwt>
 * Body: { confirmation: "刪除我的帳號" }
 *
 * 處理邏輯：
 * 1. 檢查用戶是否為任何 Workspace 的唯一 Owner 且有其他成員 → 阻止刪除
 * 2. 刪除用戶為唯一 Owner 且無其他成員的 Workspace
 * 3. 移除用戶在其他 Workspace 的成員資格
 * 4. 刪除 Supabase Auth 用戶
 */

import { handleCors } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.ts';

const CONFIRMATION_TEXT = '刪除我的帳號';

interface WorkspaceOwnership {
  workspace_id: string;
  workspace_name: string;
  is_sole_owner: boolean;
  other_members_count: number;
}

interface DeleteStats {
  workspaces_deleted: number;
  memberships_removed: number;
  accounts_deleted: number;
  posts_deleted: number;
}

async function deleteThreadsAccountData(
  serviceClient: ReturnType<typeof createServiceClient>,
  accountId: string
): Promise<{ posts: number }> {
  let posts = 0;

  // 取得所有貼文 ID
  const { data: postData } = await serviceClient
    .from('workspace_threads_posts')
    .select('id')
    .eq('workspace_threads_account_id', accountId);

  const postIds = postData?.map(p => p.id) || [];

  if (postIds.length > 0) {
    // 刪除貼文成效 - Tiered Tables
    await serviceClient
      .from('workspace_threads_post_metrics_15m')
      .delete()
      .in('post_id', postIds);

    await serviceClient
      .from('workspace_threads_post_metrics_hourly')
      .delete()
      .in('post_id', postIds);

    await serviceClient
      .from('workspace_threads_post_metrics_daily')
      .delete()
      .in('post_id', postIds);

    // 刪除貼文成效 - Legacy
    await serviceClient
      .from('workspace_threads_post_metrics')
      .delete()
      .in('post_id', postIds);

    // 刪除貼文標籤
    await serviceClient
      .from('workspace_threads_post_tags')
      .delete()
      .in('post_id', postIds);
  }

  // 刪除貼文
  const { count: postsCount } = await serviceClient
    .from('workspace_threads_posts')
    .delete({ count: 'exact' })
    .eq('workspace_threads_account_id', accountId);
  posts = postsCount || 0;

  // 刪除帳號 Insights - Tiered Tables
  await serviceClient
    .from('workspace_threads_account_insights_15m')
    .delete()
    .eq('workspace_threads_account_id', accountId);

  await serviceClient
    .from('workspace_threads_account_insights_hourly')
    .delete()
    .eq('workspace_threads_account_id', accountId);

  await serviceClient
    .from('workspace_threads_account_insights_daily')
    .delete()
    .eq('workspace_threads_account_id', accountId);

  // 刪除帳號 Insights - Legacy
  await serviceClient
    .from('workspace_threads_account_insights')
    .delete()
    .eq('workspace_threads_account_id', accountId);

  // 刪除帳號標籤
  await serviceClient
    .from('workspace_threads_account_tags')
    .delete()
    .eq('workspace_threads_account_id', accountId);

  // 刪除 Token
  await serviceClient
    .from('workspace_threads_tokens')
    .delete()
    .eq('workspace_threads_account_id', accountId);

  // 刪除同步記錄
  await serviceClient
    .from('sync_logs')
    .delete()
    .eq('workspace_threads_account_id', accountId);

  return { posts };
}

async function deleteWorkspace(
  serviceClient: ReturnType<typeof createServiceClient>,
  workspaceId: string
): Promise<{ accounts: number; posts: number }> {
  let accounts = 0;
  let posts = 0;

  // 取得所有 Threads 帳號
  const { data: accountsData } = await serviceClient
    .from('workspace_threads_accounts')
    .select('id')
    .eq('workspace_id', workspaceId);

  // 刪除每個 Threads 帳號的資料
  for (const account of accountsData || []) {
    const result = await deleteThreadsAccountData(serviceClient, account.id);
    posts += result.posts;
  }

  // 刪除 Threads 帳號
  const { count: accountsCount } = await serviceClient
    .from('workspace_threads_accounts')
    .delete({ count: 'exact' })
    .eq('workspace_id', workspaceId);
  accounts = accountsCount || 0;

  // 刪除成員關係
  await serviceClient
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId);

  // 刪除 Workspace
  await serviceClient
    .from('workspaces')
    .delete()
    .eq('id', workspaceId);

  return { accounts, posts };
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

  const { confirmation } = (body ?? {}) as { confirmation?: string };

  if (!confirmation) {
    return errorResponse(req, 'confirmation is required', 400);
  }
  if (confirmation !== CONFIRMATION_TEXT) {
    return errorResponse(req, `Confirmation must be "${CONFIRMATION_TEXT}"`, 400, 'INVALID_CONFIRMATION');
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

  try {
    // 1. 取得用戶所有的 Workspace 成員資格
    const { data: memberships } = await serviceClient
      .from('workspace_members')
      .select(`
        workspace_id,
        role,
        workspaces (
          id,
          name
        )
      `)
      .eq('user_id', user.id);

    if (!memberships || memberships.length === 0) {
      // 用戶沒有任何 Workspace，直接刪除用戶
      const { error: deleteUserError } = await serviceClient.auth.admin.deleteUser(user.id);
      if (deleteUserError) {
        console.error('Failed to delete user:', deleteUserError);
        return errorResponse(req, 'Failed to delete user account', 500);
      }

      return jsonResponse(req, {
        success: true,
        deleted: {
          workspaces_deleted: 0,
          memberships_removed: 0,
          accounts_deleted: 0,
          posts_deleted: 0,
        },
      });
    }

    // 2. 分析每個 Workspace 的擁有權狀況
    const workspaceOwnerships: WorkspaceOwnership[] = [];

    for (const membership of memberships) {
      if (membership.role !== 'owner') continue;

      const workspaceId = membership.workspace_id;
      const workspace = membership.workspaces as { id: string; name: string };

      // 檢查是否有其他 Owner
      const { data: otherOwners } = await serviceClient
        .from('workspace_members')
        .select('user_id')
        .eq('workspace_id', workspaceId)
        .eq('role', 'owner')
        .neq('user_id', user.id);

      const isSoleOwner = !otherOwners || otherOwners.length === 0;

      // 檢查其他成員數量
      const { count: otherMembersCount } = await serviceClient
        .from('workspace_members')
        .select('*', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .neq('user_id', user.id);

      workspaceOwnerships.push({
        workspace_id: workspaceId,
        workspace_name: workspace.name,
        is_sole_owner: isSoleOwner,
        other_members_count: otherMembersCount || 0,
      });
    }

    // 3. 檢查是否有阻止刪除的情況
    const blockingWorkspaces = workspaceOwnerships.filter(
      w => w.is_sole_owner && w.other_members_count > 0
    );

    if (blockingWorkspaces.length > 0) {
      return jsonResponse(req, {
        success: false,
        error: 'SOLE_OWNER_WITH_MEMBERS',
        message: '你是以下 Workspace 的唯一擁有者，請先轉移擁有權或刪除 Workspace',
        blocking_workspaces: blockingWorkspaces.map(w => ({
          workspace_id: w.workspace_id,
          workspace_name: w.workspace_name,
          other_members_count: w.other_members_count,
        })),
      }, 400);
    }

    // 4. 執行刪除
    const stats: DeleteStats = {
      workspaces_deleted: 0,
      memberships_removed: 0,
      accounts_deleted: 0,
      posts_deleted: 0,
    };

    // 4a. 刪除用戶為唯一 Owner 且無其他成員的 Workspace
    const workspacesToDelete = workspaceOwnerships.filter(
      w => w.is_sole_owner && w.other_members_count === 0
    );

    for (const ws of workspacesToDelete) {
      const result = await deleteWorkspace(serviceClient, ws.workspace_id);
      stats.workspaces_deleted++;
      stats.accounts_deleted += result.accounts;
      stats.posts_deleted += result.posts;
    }

    // 4b. 移除用戶在其他 Workspace 的成員資格
    const remainingWorkspaceIds = memberships
      .map(m => m.workspace_id)
      .filter(id => !workspacesToDelete.some(w => w.workspace_id === id));

    if (remainingWorkspaceIds.length > 0) {
      const { count: removedCount } = await serviceClient
        .from('workspace_members')
        .delete({ count: 'exact' })
        .eq('user_id', user.id)
        .in('workspace_id', remainingWorkspaceIds);
      stats.memberships_removed = removedCount || 0;
    }

    // 5. 刪除 Supabase Auth 用戶
    const { error: deleteUserError } = await serviceClient.auth.admin.deleteUser(user.id);
    if (deleteUserError) {
      console.error('Failed to delete user:', deleteUserError);
      return errorResponse(req, 'Failed to delete user account', 500);
    }

    console.log(`Successfully deleted user ${user.id}:`, stats);

    return jsonResponse(req, {
      success: true,
      deleted: stats,
    });

  } catch (error) {
    console.error('Error during user account deletion:', error);
    return errorResponse(req, 'Failed to delete user account', 500);
  }
});
