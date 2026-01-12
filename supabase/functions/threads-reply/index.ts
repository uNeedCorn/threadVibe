/**
 * Threads Reply - 發送回覆
 *
 * POST /threads-reply
 * Body: { account_id: string, reply_to_id: string, text: string }
 *
 * 使用兩步驟流程：
 * 1. 建立回覆容器 (POST /me/threads?reply_to_id=...)
 * 2. 發布回覆 (POST /{creation_id}/threads_publish)
 */

import { handleCors } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { getAuthenticatedUser, validateWorkspaceMembership } from '../_shared/auth.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '../_shared/response.ts';
import { isUuid } from '../_shared/validation.ts';
import { decrypt } from '../_shared/crypto.ts';

const THREADS_API_BASE = 'https://graph.threads.net/v1.0';
const THREADS_TEXT_LIMIT = 500;

interface ThreadsCreateResponse {
  id?: string;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

interface ThreadsPublishResponse {
  id?: string;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return errorResponse(req, 'Method not allowed', 405);
  }

  try {
    // 解析請求
    let body: {
      account_id?: string;
      reply_to_id?: string;
      text?: string;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(req, 'Invalid request body', 400);
    }

    const { account_id: accountId, reply_to_id: replyToId, text } = body;

    // 驗證參數
    if (!accountId) {
      return errorResponse(req, 'account_id is required', 400);
    }

    if (!isUuid(accountId)) {
      return errorResponse(req, 'Invalid account_id', 400);
    }

    if (!replyToId) {
      return errorResponse(req, 'reply_to_id is required', 400);
    }

    if (!text) {
      return errorResponse(req, 'text is required', 400);
    }

    if (text.length > THREADS_TEXT_LIMIT) {
      return errorResponse(req, `Text exceeds ${THREADS_TEXT_LIMIT} character limit`, 400);
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

    // 取得帳號資訊
    const { data: account, error: accountError } = await serviceClient
      .from('workspace_threads_accounts')
      .select('id, workspace_id, threads_user_id')
      .eq('id', accountId)
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

    // 取得 Token
    const { data: tokenData, error: tokenError } = await serviceClient
      .from('workspace_threads_tokens')
      .select('access_token_encrypted')
      .eq('workspace_threads_account_id', accountId)
      .single();

    if (tokenError || !tokenData) {
      return errorResponse(req, 'Token not found for this account', 404);
    }

    // 解密 Token
    const accessToken = await decrypt(tokenData.access_token_encrypted);

    // Step 1: 建立回覆容器
    const createUrl = new URL(`${THREADS_API_BASE}/me/threads`);
    createUrl.searchParams.set('access_token', accessToken);
    createUrl.searchParams.set('media_type', 'TEXT');
    createUrl.searchParams.set('text', text);
    createUrl.searchParams.set('reply_to_id', replyToId);

    const createResponse = await fetch(createUrl.toString(), {
      method: 'POST',
    });

    const createData: ThreadsCreateResponse = await createResponse.json();

    if (!createResponse.ok || createData.error || !createData.id) {
      console.error('Create container error:', createData.error);
      return errorResponse(
        req,
        createData.error?.message || 'Failed to create reply container',
        createResponse.status >= 400 && createResponse.status < 500 ? createResponse.status : 500
      );
    }

    const creationId = createData.id;

    // Step 2: 發布回覆
    const publishUrl = new URL(`${THREADS_API_BASE}/${creationId}/threads_publish`);
    publishUrl.searchParams.set('access_token', accessToken);

    const publishResponse = await fetch(publishUrl.toString(), {
      method: 'POST',
    });

    const publishData: ThreadsPublishResponse = await publishResponse.json();

    if (!publishResponse.ok || publishData.error || !publishData.id) {
      console.error('Publish error:', publishData.error);
      return errorResponse(
        req,
        publishData.error?.message || 'Failed to publish reply',
        publishResponse.status >= 400 && publishResponse.status < 500 ? publishResponse.status : 500
      );
    }

    // 取得已發布回覆的詳情
    const replyId = publishData.id;
    const detailUrl = `${THREADS_API_BASE}/${replyId}?fields=id,text,username,timestamp,permalink&access_token=${accessToken}`;

    const detailResponse = await fetch(detailUrl);
    const detailData = await detailResponse.json();

    return jsonResponse(req, {
      success: true,
      reply: {
        id: replyId,
        text: detailData.text || text,
        username: detailData.username,
        timestamp: detailData.timestamp,
        permalink: detailData.permalink,
      },
    });

  } catch (error) {
    console.error('Threads reply error:', error);
    return errorResponse(
      req,
      `Failed to send reply: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
});
