/**
 * Threads OAuth - 導向授權頁面
 *
 * GET /threads-oauth?workspace_id=xxx
 *
 * 使用者必須已登入，會從 Authorization header 驗證身份
 * 使用 HMAC 簽章保護 state 防止竄改
 */

import { handleCors } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { getAuthenticatedUser, validateWorkspaceMembership } from '../_shared/auth.ts';
import { signState } from '../_shared/oauth-state.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { errorResponse, unauthorizedResponse, forbiddenResponse } from '../_shared/response.ts';

const THREADS_APP_ID = Deno.env.get('THREADS_APP_ID');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    if (!SUPABASE_URL) {
      return errorResponse(req, 'SUPABASE_URL not configured', 500, 'CONFIG_ERROR');
    }
    try {
      new URL(SUPABASE_URL);
    } catch {
      return errorResponse(req, 'SUPABASE_URL is invalid', 500, 'CONFIG_ERROR');
    }

    const url = new URL(req.url);
    const workspaceId = url.searchParams.get('workspace_id');
    const transferId = url.searchParams.get('transfer_id'); // 可選：Token 移轉流程

    if (!workspaceId) {
      return errorResponse(req, 'workspace_id is required', 400);
    }

    if (!THREADS_APP_ID) {
      return errorResponse(req, 'THREADS_APP_ID not configured', 500, 'CONFIG_ERROR');
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
      `threads_oauth:${user.id}`,
      10,
      60
    );
    if (!rateLimit.allowed) {
      return errorResponse(req, 'Rate limit exceeded', 429);
    }

    // 驗證 Workspace 權限（需要 owner 或 editor）
    const membership = await validateWorkspaceMembership(
      supabase,
      user.id,
      workspaceId,
      ['owner', 'editor']
    );

    if (!membership) {
      return forbiddenResponse(req, 'No permission to connect Threads account to this workspace');
    }

    // 產生簽章的 state（防 CSRF + 防竄改）
    const state = await signState({
      workspaceId,
      userId: user.id,
      nonce: crypto.randomUUID(),
      transferId: transferId ?? undefined,
    });

    // 建構 Redirect URI
    const redirectUri = `${SUPABASE_URL}/functions/v1/threads-oauth-callback`;

    // 建構授權 URL
    const authUrl = new URL('https://threads.net/oauth/authorize');
    authUrl.searchParams.set('client_id', THREADS_APP_ID);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('scope', 'threads_basic,threads_manage_insights');
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);

    // Debug logging
    console.log('[threads-oauth] THREADS_APP_ID:', THREADS_APP_ID?.substring(0, 10) + '...');
    console.log('[threads-oauth] Redirect URI:', redirectUri);
    console.log('[threads-oauth] Full Auth URL:', authUrl.toString());

    return Response.redirect(authUrl.toString(), 302);
  } catch (error) {
    console.error('Threads OAuth error:', error);
    return errorResponse(req, 'Internal server error', 500);
  }
});
