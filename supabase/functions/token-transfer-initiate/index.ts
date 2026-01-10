/**
 * Token Transfer Initiate - 發起 Threads Token 移轉
 *
 * POST /token-transfer-initiate
 * Headers: Authorization: Bearer <user_jwt>
 * Body: { workspace_threads_account_id: string, target_user_id: string }
 *
 * 僅 Workspace Owner 可發起：
 * - 建立 token_transfers 記錄
 * - 回傳 transfer_id 與 target 可用的 OAuth 導向資訊（由前端帶入 threads-oauth?transfer_id=...）
 */

import { handleCors } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { getAuthenticatedUser, validateWorkspaceMembership } from '../_shared/auth.ts';
import { isUuid } from '../_shared/validation.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '../_shared/response.ts';

const TRANSFER_EXPIRY_HOURS = 24;

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

  const { workspace_threads_account_id, target_user_id } = (body ?? {}) as {
    workspace_threads_account_id?: string;
    target_user_id?: string;
  };

  if (!workspace_threads_account_id || !target_user_id) {
    return errorResponse(req, 'workspace_threads_account_id and target_user_id are required', 400);
  }

  if (!isUuid(workspace_threads_account_id) || !isUuid(target_user_id)) {
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

  const serviceClient = createServiceClient();

  const { data: account, error: accountError } = await serviceClient
    .from('workspace_threads_accounts')
    .select('id, workspace_id')
    .eq('id', workspace_threads_account_id)
    .single();

  if (accountError || !account) {
    return errorResponse(req, 'Threads account not found', 404);
  }

  const ownerMembership = await validateWorkspaceMembership(
    supabase,
    user.id,
    account.workspace_id,
    ['owner']
  );
  if (!ownerMembership) {
    return forbiddenResponse(req, 'Only workspace owner can initiate token transfer');
  }

  const { data: targetMember, error: targetError } = await serviceClient
    .from('workspace_members')
    .select('user_id, joined_at')
    .eq('workspace_id', account.workspace_id)
    .eq('user_id', target_user_id)
    .not('joined_at', 'is', null)
    .single();

  if (targetError || !targetMember) {
    return errorResponse(req, 'Target user is not an active workspace member', 400, 'NOT_A_MEMBER');
  }

  const transferId = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + TRANSFER_EXPIRY_HOURS * 60 * 60 * 1000).toISOString();

  const { error: insertError } = await serviceClient
    .from('token_transfers')
    .insert({
      id: transferId,
      workspace_threads_account_id,
      initiated_by: user.id,
      target_user_id,
      expires_at: expiresAt,
    });

  if (insertError) {
    console.error('Failed to create token_transfer:', insertError);
    return errorResponse(req, 'Failed to initiate token transfer', 500);
  }

  return jsonResponse(req, {
    success: true,
    transfer_id: transferId,
    expires_at: expiresAt,
    threads_oauth_path: `/threads-oauth?workspace_id=${account.workspace_id}&transfer_id=${transferId}`,
  });
});

