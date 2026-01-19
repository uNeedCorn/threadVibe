/**
 * Workspace Member Remove - 移除 Workspace 成員（含 Token 安全處理）
 *
 * POST /workspace-member-remove
 * Headers: Authorization: Bearer <user_jwt>
 * Body: { workspace_id: string, target_user_id: string }
 *
 * 僅 Workspace Owner 可執行：
 * - 若 target_user_id 曾授權過 Threads token，則為其 tokens 設定 auto_revoke_at（預設 7 天後）
 * - 刪除 workspace_members 記錄
 *
 * 目的：避免 client 直接操作 workspace_threads_tokens（已 REVOKE ALL）。
 */

import { handleCors } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { getAuthenticatedUser, validateWorkspaceMembership } from '../_shared/auth.ts';
import { isUuid } from '../_shared/validation.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '../_shared/response.ts';

const AUTO_REVOKE_DAYS = 1; // 24 小時後自動撤銷（SEC-M20 安全修正）

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

  const { workspace_id, target_user_id } = (body ?? {}) as {
    workspace_id?: string;
    target_user_id?: string;
  };

  if (!workspace_id || !target_user_id) {
    return errorResponse(req, 'workspace_id and target_user_id are required', 400);
  }
  if (!isUuid(workspace_id) || !isUuid(target_user_id)) {
    return errorResponse(req, 'Invalid id format', 400, 'INVALID_ID');
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

  const ownerMembership = await validateWorkspaceMembership(
    supabase,
    user.id,
    workspace_id,
    ['owner']
  );
  if (!ownerMembership) {
    return forbiddenResponse(req, 'Only workspace owner can remove members');
  }

  const serviceClient = createServiceClient();

  // 防止移除最後一個 owner
  const { data: targetMembership } = await serviceClient
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspace_id)
    .eq('user_id', target_user_id)
    .single();

  if (!targetMembership) {
    return errorResponse(req, 'Member not found', 404);
  }

  if (targetMembership.role === 'owner') {
    const { data: owners } = await serviceClient
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspace_id)
      .eq('role', 'owner');

    if (owners?.length === 1 && owners[0].user_id === target_user_id) {
      return errorResponse(req, 'Cannot remove the last owner', 400, 'LAST_OWNER');
    }
  }

  const autoRevokeAt = new Date(Date.now() + AUTO_REVOKE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  // 找出該 workspace 的 Threads accounts
  const { data: accounts } = await serviceClient
    .from('workspace_threads_accounts')
    .select('id')
    .eq('workspace_id', workspace_id);

  const accountIds = (accounts ?? []).map((a) => a.id).filter(Boolean);

  let scheduledTokensCount = 0;
  if (accountIds.length > 0) {
    // 為 target user 授權過的 tokens 設 auto_revoke_at（只設未撤銷且尚未設定的）
    const { count, error: scheduleError } = await serviceClient
      .from('workspace_threads_tokens')
      .update({ auto_revoke_at: autoRevokeAt }, { count: 'exact' })
      .eq('authorized_by_user_id', target_user_id)
      .in('workspace_threads_account_id', accountIds)
      .is('revoked_at', null)
      .is('auto_revoke_at', null);

    if (scheduleError) {
      console.error('Failed to schedule token auto revoke:', scheduleError);
      return errorResponse(req, 'Failed to schedule token auto revoke', 500);
    }

    scheduledTokensCount = count ?? 0;
  }

  // 移除成員
  const { error: deleteError } = await serviceClient
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspace_id)
    .eq('user_id', target_user_id);

  if (deleteError) {
    console.error('Failed to delete member:', deleteError);
    return errorResponse(req, 'Failed to remove member', 500);
  }

  return jsonResponse(req, {
    success: true,
    workspace_id,
    target_user_id,
    tokens_auto_revoke_scheduled: scheduledTokensCount,
    auto_revoke_at: scheduledTokensCount > 0 ? autoRevokeAt : null,
    auto_revoke_days: AUTO_REVOKE_DAYS,
  });
});

