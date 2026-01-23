/**
 * Threads Account Status - 查詢 Threads 帳號狀態（不暴露 token 密文）
 *
 * GET /threads-account-status?account_id=xxx
 * Headers: Authorization: Bearer <user_jwt>
 *
 * 任何 Workspace 成員可查詢（joined_at != null）。
 * 回傳 token_status 僅包含狀態與到期時間，不回傳 access_token_encrypted。
 */

import { handleCors } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { getAuthenticatedUser, validateWorkspaceMembership, isSystemAdmin } from '../_shared/auth.ts';
import { isUuid } from '../_shared/validation.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '../_shared/response.ts';

type TokenStatus = 'valid' | 'expired' | 'no_token';

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'GET') {
    return errorResponse(req, 'Method not allowed', 405);
  }

  const url = new URL(req.url);
  const accountId = url.searchParams.get('account_id');

  if (!accountId) {
    return errorResponse(req, 'account_id is required', 400);
  }
  if (!isUuid(accountId)) {
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

  const { data: account, error: accountError } = await serviceClient
    .from('workspace_threads_accounts')
    .select('id, workspace_id, username, profile_pic_url, is_active')
    .eq('id', accountId)
    .single();

  if (accountError || !account) {
    return errorResponse(req, 'Threads account not found', 404);
  }

  // 驗證 Workspace 權限（system_admin 可以跳過）
  const isAdmin = await isSystemAdmin(supabase, user.id);
  if (!isAdmin) {
    const membership = await validateWorkspaceMembership(
      supabase,
      user.id,
      account.workspace_id
    );
    if (!membership) {
      return forbiddenResponse(req, 'No access to this workspace');
    }
  }

  const nowIso = new Date().toISOString();
  const { data: token } = await serviceClient
    .from('workspace_threads_tokens')
    .select('expires_at, revoked_at, is_primary')
    .eq('workspace_threads_account_id', accountId)
    .eq('is_primary', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let tokenStatus: TokenStatus = 'no_token';
  let expiresAt: string | null = null;

  if (token && !token.revoked_at) {
    expiresAt = token.expires_at ?? null;
    tokenStatus = token.expires_at > nowIso ? 'valid' : 'expired';
  } else if (token) {
    expiresAt = token.expires_at ?? null;
    tokenStatus = 'expired';
  }

  return jsonResponse(req, {
    id: account.id,
    username: account.username,
    profile_pic_url: account.profile_pic_url,
    is_active: account.is_active,
    token_status: tokenStatus,
    expires_at: expiresAt,
  });
});

