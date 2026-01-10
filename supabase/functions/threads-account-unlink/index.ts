/**
 * Threads Account Unlink - 解除連結 Threads 帳號
 *
 * POST /threads-account-unlink
 * Headers: Authorization: Bearer <user_jwt>
 * Body: { account_id: string }
 *
 * 僅 Workspace Owner 可執行：
 * - revoke 該帳號所有尚未 revoked 的 tokens
 * - 將帳號 is_active 設為 false
 */

import { handleCors } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { getAuthenticatedUser, validateWorkspaceMembership } from '../_shared/auth.ts';
import { isUuid } from '../_shared/validation.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '../_shared/response.ts';

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
  const nowIso = new Date().toISOString();

  const { data: account, error: accountError } = await serviceClient
    .from('workspace_threads_accounts')
    .select('id, workspace_id, is_active')
    .eq('id', account_id)
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
    return forbiddenResponse(req, 'Only workspace owner can unlink Threads accounts');
  }

  const { error: revokeError } = await serviceClient
    .from('workspace_threads_tokens')
    .update({
      revoked_at: nowIso,
      is_primary: false,
    })
    .eq('workspace_threads_account_id', account_id)
    .is('revoked_at', null);

  if (revokeError) {
    console.error('Failed to revoke tokens:', revokeError);
    return errorResponse(req, 'Failed to revoke tokens', 500);
  }

  const { error: deactivateError } = await serviceClient
    .from('workspace_threads_accounts')
    .update({
      is_active: false,
      updated_at: nowIso,
    })
    .eq('id', account_id);

  if (deactivateError) {
    console.error('Failed to deactivate account:', deactivateError);
    return errorResponse(req, 'Failed to deactivate account', 500);
  }

  return jsonResponse(req, {
    success: true,
    account_id,
    was_active: account.is_active,
  });
});

