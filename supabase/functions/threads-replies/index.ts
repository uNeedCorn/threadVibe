/**
 * Threads Replies - 取得貼文回覆列表（含完整巢狀結構）
 *
 * POST /threads-replies
 * Body: { account_id: string, post_id: string }
 *
 * 使用 conversation endpoint 取得所有層級的回覆，並重建樹狀結構
 * 對經營者自己的回覆，額外呼叫 insights API 取得互動數據
 */

import { handleCors } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { getAuthenticatedUser, validateWorkspaceMembership, isSystemAdmin } from '../_shared/auth.ts';
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
  replied_to?: { id: string };
  root_post?: { id: string };
  has_replies?: boolean;
}

interface ReplyInsights {
  likes?: number;
  reposts?: number;
  quotes?: number;
  views?: number;
}

interface ThreadsReplyWithChildren extends Omit<ThreadsReply, 'replied_to' | 'root_post'> {
  parent_id?: string;
  children: ThreadsReplyWithChildren[];
  has_owner_reply?: boolean;
  depth: number;
  insights?: ReplyInsights;
}

interface ThreadsConversationResponse {
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

interface InsightsResponse {
  data?: Array<{
    name: string;
    values?: Array<{ value: number }>;
  }>;
  error?: {
    message: string;
  };
}

/**
 * 取得單則回覆的 insights（僅限經營者自己的回覆）
 */
async function fetchReplyInsights(
  replyId: string,
  accessToken: string
): Promise<ReplyInsights | null> {
  try {
    const metrics = 'likes,reposts,quotes,views';
    const url = `${THREADS_API_BASE}/${replyId}/insights?metric=${metrics}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const data: InsightsResponse = await response.json();

    if (!response.ok) {
      console.log('Insights API error for reply:', {
        replyId,
        status: response.status,
        error: data.error,
      });
      return null;
    }

    if (!data.data || data.data.length === 0) {
      console.log('Insights API returned empty data for reply:', replyId);
      return null;
    }

    const insights: ReplyInsights = {};
    for (const metric of data.data) {
      const value = metric.values?.[0]?.value;
      if (value !== undefined) {
        insights[metric.name as keyof ReplyInsights] = value;
      }
    }

    console.log('Insights fetched for reply:', { replyId, insights });
    return insights;
  } catch (err) {
    console.error('Insights fetch error:', err);
    return null;
  }
}

/**
 * 將扁平化的回覆列表重建為樹狀結構
 */
function buildReplyTree(replies: ThreadsReply[], rootPostId: string, reverse: boolean): ThreadsReplyWithChildren[] {
  // 建立 id -> reply 的 map，保留原始順序
  const replyMap = new Map<string, ThreadsReplyWithChildren>();

  // 初始化所有回覆（按 API 返回順序）
  for (const reply of replies) {
    replyMap.set(reply.id, {
      id: reply.id,
      text: reply.text,
      username: reply.username,
      timestamp: reply.timestamp,
      media_type: reply.media_type,
      media_url: reply.media_url,
      permalink: reply.permalink,
      is_reply_owned_by_me: reply.is_reply_owned_by_me,
      has_replies: reply.has_replies,
      parent_id: reply.replied_to?.id,
      children: [],
      depth: 0,
    });
  }

  // 建立樹狀結構（按原始順序遍歷以保留 API 順序）
  const rootReplies: ThreadsReplyWithChildren[] = [];

  // 使用原始 replies 陣列順序來遍歷，確保順序一致
  for (const originalReply of replies) {
    const reply = replyMap.get(originalReply.id)!;
    const parentId = reply.parent_id;

    // 如果 parent_id 是貼文本身，則為第一層回覆
    if (parentId === rootPostId || !parentId) {
      reply.depth = 0;
      rootReplies.push(reply);
    } else {
      // 否則加入父回覆的 children
      const parent = replyMap.get(parentId);
      if (parent) {
        reply.depth = parent.depth + 1;
        parent.children.push(reply);
      } else {
        // 找不到父回覆（可能因為隱藏等原因），當作第一層
        reply.depth = 0;
        rootReplies.push(reply);
      }
    }
  }

  // 計算每個節點是否有擁有者回覆（包含子孫）
  function markOwnerReply(node: ThreadsReplyWithChildren): boolean {
    let childHasOwnerReply = false;
    for (const child of node.children) {
      if (markOwnerReply(child)) {
        childHasOwnerReply = true;
      }
    }
    node.has_owner_reply = node.is_reply_owned_by_me === true || childHasOwnerReply;
    return node.has_owner_reply;
  }

  for (const root of rootReplies) {
    markOwnerReply(root);
  }

  // 排序策略：
  // - 根層回覆：依據 reverse 參數（true = 新到舊，false = 舊到新）
  // - 子回覆：始終按時間「舊到新」（對話流程順序）
  rootReplies.sort((a, b) => {
    const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return reverse ? (timeB - timeA) : (timeA - timeB);
  });

  // 遞迴排序子節點（舊到新，維持對話順序）
  function sortChildren(node: ThreadsReplyWithChildren) {
    node.children.sort((a, b) => {
      const timeA = a.timestamp ? new Date(a.timestamp).getTime() : 0;
      const timeB = b.timestamp ? new Date(b.timestamp).getTime() : 0;
      return timeA - timeB; // 舊到新
    });
    for (const child of node.children) {
      sortChildren(child);
    }
  }

  for (const root of rootReplies) {
    sortChildren(root);
  }

  return rootReplies;
}

/**
 * 為經營者的回覆加入 insights
 */
async function enrichOwnerRepliesWithInsights(
  tree: ThreadsReplyWithChildren[],
  accessToken: string
): Promise<void> {
  const ownerReplies: ThreadsReplyWithChildren[] = [];

  // 收集所有經營者的回覆
  function collectOwnerReplies(node: ThreadsReplyWithChildren) {
    if (node.is_reply_owned_by_me === true) {
      ownerReplies.push(node);
    }
    for (const child of node.children) {
      collectOwnerReplies(child);
    }
  }

  for (const root of tree) {
    collectOwnerReplies(root);
  }

  // 並行取得所有經營者回覆的 insights（限制併發數）
  const batchSize = 5;
  for (let i = 0; i < ownerReplies.length; i += batchSize) {
    const batch = ownerReplies.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(reply => fetchReplyInsights(reply.id, accessToken))
    );

    for (let j = 0; j < batch.length; j++) {
      if (results[j]) {
        batch[j].insights = results[j]!;
      }
    }
  }
}

/**
 * 計算樹的統計資訊
 */
function calculateTreeStats(tree: ThreadsReplyWithChildren[]): {
  totalCount: number;
  hasOwnerReply: boolean;
} {
  let totalCount = 0;
  let hasOwnerReply = false;

  function traverse(node: ThreadsReplyWithChildren) {
    totalCount++;
    if (node.is_reply_owned_by_me === true) {
      hasOwnerReply = true;
    }
    for (const child of node.children) {
      traverse(child);
    }
  }

  for (const root of tree) {
    traverse(root);
  }

  return { totalCount, hasOwnerReply };
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
      cursor?: string;  // 分頁游標
      limit?: number;   // 每頁數量
      reverse?: boolean; // 是否反向排序（true = 新到舊，false = 舊到新）
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(req, 'Invalid request body', 400);
    }

    const { account_id: accountId, post_id: postId, cursor, limit = 50, reverse = true } = body;

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

    // 使用 conversation endpoint 取得所有回覆（含巢狀）
    // reverse=true: 新到舊，reverse=false: 舊到新
    const fields = 'id,text,username,timestamp,media_type,media_url,permalink,is_reply_owned_by_me,replied_to,root_post,has_replies';
    let url = `${THREADS_API_BASE}/${postId}/conversation?fields=${fields}&reverse=${reverse}&limit=${Math.min(limit, 100)}`;

    // 如果有分頁游標，加入 after 參數
    if (cursor) {
      url += `&after=${encodeURIComponent(cursor)}`;
    }

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data: ThreadsConversationResponse = await response.json();

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

    const flatReplies = data.data || [];

    // 重建樹狀結構
    const replyTree = buildReplyTree(flatReplies, postId, reverse);

    // 為經營者的回覆加入 insights
    await enrichOwnerRepliesWithInsights(replyTree, accessToken);

    // 計算統計資訊
    const stats = calculateTreeStats(replyTree);

    return jsonResponse(req, {
      replies: replyTree,
      paging: data.paging,
      hasOwnerReply: stats.hasOwnerReply,
      totalCount: stats.totalCount,
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
