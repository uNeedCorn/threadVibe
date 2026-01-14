/**
 * Threads Replies - 取得貼文回覆列表
 *
 * POST /threads-replies
 * Body: { account_id: string, post_id: string }
 *
 * 回傳該貼文的回覆列表
 */

import { handleCors } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { getAuthenticatedUser, validateWorkspaceMembership } from '../_shared/auth.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '../_shared/response.ts';
import { isUuid } from '../_shared/validation.ts';
import { decrypt } from '../_shared/crypto.ts';

const THREADS_API_BASE = 'https://graph.threads.net/v1.0';

interface ThreadsReply {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  is_reply_owned_by_me?: boolean;
}

interface ThreadsRepliesResponse {
  data?: ThreadsReply[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
  };
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
      post_id?: string;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(req, 'Invalid request body', 400);
    }

    const { account_id: accountId, post_id: postId } = body;

    if (!accountId) {
      return errorResponse(req, 'account_id is required', 400);
    }

    if (!isUuid(accountId)) {
      return errorResponse(req, 'Invalid account_id', 400);
    }

    if (!postId) {
      return errorResponse(req, 'post_id is required', 400);
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

    // 取得 Token（必須是 primary 且未撤銷的）
    const { data: tokenData, error: tokenError } = await serviceClient
      .from('workspace_threads_tokens')
      .select('access_token_encrypted')
      .eq('workspace_threads_account_id', accountId)
      .eq('is_primary', true)
      .is('revoked_at', null)
      .single();

    if (tokenError || !tokenData) {
      return errorResponse(req, 'Token not found for this account', 404);
    }

    // 解密 Token
    const accessToken = await decrypt(tokenData.access_token_encrypted);

    // 呼叫 Threads API 取得回覆
    const fields = 'id,text,username,timestamp,media_type,media_url,permalink,is_reply_owned_by_me';
    const url = `${THREADS_API_BASE}/${postId}/replies?fields=${fields}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data: ThreadsRepliesResponse = await response.json();

    if (!response.ok || data.error) {
      console.error('Threads API error:', {
        status: response.status,
        error: data.error,
        postId,
        accountId,
      });
      return errorResponse(
        req,
        data.error?.message || 'Failed to fetch replies',
        response.status >= 400 && response.status < 500 ? response.status : 500
      );
    }

    const replies = data.data || [];

    // 對每則回覆檢查是否有擁有者的子回覆
    const repliesWithOwnerReplyStatus = await Promise.all(
      replies.map(async (reply) => {
        // 先檢查這則回覆本身是否是擁有者的
        if (reply.is_reply_owned_by_me === true) {
          return { ...reply, has_owner_reply: true };
        }

        // 下鑽一層檢查子回覆
        try {
          const nestedUrl = `${THREADS_API_BASE}/${reply.id}/replies?fields=${fields}`;
          const nestedResponse = await fetch(nestedUrl, {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const nestedData: ThreadsRepliesResponse = await nestedResponse.json();

          if (nestedResponse.ok && nestedData.data) {
            const hasOwnerReply = nestedData.data.some((r) => r.is_reply_owned_by_me === true);
            return { ...reply, has_owner_reply: hasOwnerReply };
          }
          return { ...reply, has_owner_reply: false };
        } catch {
          return { ...reply, has_owner_reply: false };
        }
      })
    );

    // 計算整體是否有擁有者回覆
    const hasOwnerReply = repliesWithOwnerReplyStatus.some((r) => r.has_owner_reply === true);

    return jsonResponse(req, {
      replies: repliesWithOwnerReplyStatus,
      paging: data.paging,
      hasOwnerReply,
    });

  } catch (error) {
    console.error('Threads replies error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return errorResponse(
      req,
      `Failed to fetch replies: ${error instanceof Error ? error.message : 'Unknown error'}`,
      500
    );
  }
});
