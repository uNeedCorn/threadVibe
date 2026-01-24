/**
 * API Test - Meta/Threads API 測試工具
 *
 * POST /api-test
 * Body: { account_id: string, endpoint: string, params?: Record<string, string> }
 *
 * 回傳 Threads API 原始回應，用於開發測試
 */

import { handleCors } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { getAuthenticatedUser, validateWorkspaceMembership, isSystemAdmin } from '../_shared/auth.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '../_shared/response.ts';
import { isUuid } from '../_shared/validation.ts';
import { decrypt } from '../_shared/crypto.ts';

const THREADS_API_BASE = 'https://graph.threads.net/v1.0';

// 端點設定介面
interface EndpointConfig {
  id: string;
  name: string;
  path: string;
  method?: 'GET' | 'POST' | 'DELETE';
  fields?: string;
  params?: Record<string, string>;
  requirePostId?: boolean;
  requireKeyword?: boolean;
  requireUsername?: boolean;
  requireText?: boolean;
  requireReplyId?: boolean;
  requireLocation?: boolean;
  description?: string;
  category: 'read' | 'write' | 'delete';
}

// 可用的 API 端點
const ALLOWED_ENDPOINTS: EndpointConfig[] = [
  // === 讀取類 (threads_basic, threads_manage_insights) ===
  { id: 'me', name: '個人資料', path: '/me', fields: 'id,username,name,threads_profile_picture_url,threads_biography', category: 'read', description: '取得帳號基本資訊' },
  { id: 'me_insights', name: '帳號 Insights', path: '/me/threads_insights', params: { metric: 'views,followers_count' }, category: 'read', description: '取得帳號 views、followers_count' },
  { id: 'me_threads', name: '貼文列表', path: '/me/threads', fields: 'id,text,media_product_type,media_type,media_url,permalink,owner,username,timestamp,shortcode,thumbnail_url,children,is_quote_post,is_reply,replied_to,root_post', params: { limit: '10' }, category: 'read', description: '取得最近 10 則貼文' },
  { id: 'post_insights', name: '貼文 Insights', path: '/{post_id}/insights', params: { metric: 'views,likes,replies,reposts,quotes,shares' }, requirePostId: true, category: 'read', description: '取得指定貼文的成效數據' },

  // === threads_read_replies ===
  { id: 'post_replies', name: '貼文回覆', path: '/{post_id}/replies', fields: 'id,text,username,permalink,timestamp,media_product_type,media_type,media_url,shortcode,thumbnail_url,children,is_quote_post,has_replies,root_post,replied_to,is_reply,is_reply_owned_by_me,hide_status', requirePostId: true, category: 'read', description: '取得指定貼文的直接回覆列表' },
  { id: 'post_conversation', name: '完整對話串', path: '/{post_id}/conversation', fields: 'id,text,username,permalink,timestamp,media_product_type,media_type,media_url,shortcode,thumbnail_url,children,is_quote_post,has_replies,root_post,replied_to,is_reply,is_reply_owned_by_me,hide_status', requirePostId: true, category: 'read', description: '取得指定貼文的完整對話串（含巢狀回覆）' },

  // === threads_manage_mentions ===
  { id: 'me_mentions', name: '被提及內容', path: '/me/mentions', fields: 'id,text,username,timestamp,media_type,permalink', category: 'read', description: '取得被提及的內容列表' },

  // === threads_keyword_search ===
  // 注意：此端點需要 threads_keyword_search 進階權限
  // 參考：https://developers.facebook.com/docs/threads/keyword-search
  { id: 'keyword_search', name: '關鍵字搜尋（需進階權限）', path: '/keyword_search', params: { search_type: 'TOP' }, fields: 'id,text,media_type,permalink,timestamp,username,has_replies,is_quote_post,is_reply', requireKeyword: true, category: 'read', description: '搜尋貼文（需 threads_keyword_search 進階權限核准）' },

  // === threads_profile_discovery ===
  // 注意：此端點需要 threads_profile_discovery 進階權限
  // 參考：https://developers.facebook.com/docs/threads/profile-discovery
  // 限制：只能查詢 18+ 歲且 100+ 粉絲的公開帳號，每日 1,000 次配額
  { id: 'profile_lookup', name: '公開帳號資料（需進階權限）', path: '/profile_lookup', fields: 'username,name,profile_picture_url,biography,follower_count,likes_count,quotes_count,reposts_count,views_count,is_verified', requireUsername: true, category: 'read', description: '查詢公開帳號的資料與 7 日統計（需 threads_profile_discovery 進階權限）' },

  // === threads_location_tagging ===
  { id: 'location_search', name: '地點搜尋', path: '/pages/search', params: { type: 'place' }, requireLocation: true, category: 'read', description: '搜尋地點（用於標籤）' },

  // === threads_content_publish ===
  { id: 'create_post', name: '建立貼文', path: '/me/threads', method: 'POST', requireText: true, category: 'write', description: '建立新的文字貼文' },

  // === threads_manage_replies ===
  { id: 'hide_reply', name: '隱藏回覆', path: '/{reply_id}/manage_reply', method: 'POST', params: { hide: 'true' }, requireReplyId: true, category: 'write', description: '隱藏指定的回覆' },
  { id: 'unhide_reply', name: '取消隱藏回覆', path: '/{reply_id}/manage_reply', method: 'POST', params: { hide: 'false' }, requireReplyId: true, category: 'write', description: '取消隱藏指定的回覆' },

  // === threads_delete ===
  { id: 'delete_post', name: '刪除貼文', path: '/{post_id}', method: 'DELETE', requirePostId: true, category: 'delete', description: '刪除指定的貼文（不可復原）' },
];

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
      endpoint?: string;
      post_id?: string;
      reply_id?: string;
      keyword?: string;
      username?: string;
      text?: string;
      location_query?: string;
    };
    try {
      body = await req.json();
    } catch {
      return errorResponse(req, 'Invalid request body', 400);
    }

    const {
      account_id: accountId,
      endpoint,
      post_id: postId,
      reply_id: replyId,
      keyword,
      username,
      text,
      location_query: locationQuery,
    } = body;

    if (!accountId) {
      return errorResponse(req, 'account_id is required', 400);
    }

    if (!isUuid(accountId)) {
      return errorResponse(req, 'Invalid account_id', 400);
    }

    if (!endpoint) {
      return errorResponse(req, 'endpoint is required', 400);
    }

    // 驗證端點
    const endpointConfig = ALLOWED_ENDPOINTS.find((e) => e.id === endpoint);
    if (!endpointConfig) {
      return jsonResponse(req, {
        error: 'Invalid endpoint',
        available_endpoints: ALLOWED_ENDPOINTS.map((e) => ({ id: e.id, name: e.name, category: e.category, description: e.description })),
      }, 400);
    }

    // 驗證必要參數
    if (endpointConfig.requirePostId && !postId) {
      return errorResponse(req, 'post_id is required for this endpoint', 400);
    }
    if (endpointConfig.requireReplyId && !replyId) {
      return errorResponse(req, 'reply_id is required for this endpoint', 400);
    }
    if (endpointConfig.requireKeyword && !keyword) {
      return errorResponse(req, 'keyword is required for this endpoint', 400);
    }
    if (endpointConfig.requireUsername && !username) {
      return errorResponse(req, 'username is required for this endpoint', 400);
    }
    if (endpointConfig.requireText && !text) {
      return errorResponse(req, 'text is required for this endpoint', 400);
    }
    if (endpointConfig.requireLocation && !locationQuery) {
      return errorResponse(req, 'location_query is required for this endpoint', 400);
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

    // 驗證是否為系統管理員
    const adminCheck = await isSystemAdmin(serviceClient, user.id);
    if (!adminCheck) {
      return forbiddenResponse(req, 'Admin access required');
    }

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

    // 構建 API URL
    let apiPath = endpointConfig.path;

    // 替換路徑參數
    if (endpointConfig.requirePostId && postId) {
      apiPath = apiPath.replace('{post_id}', postId);
    }
    if (endpointConfig.requireReplyId && replyId) {
      apiPath = apiPath.replace('{reply_id}', replyId);
    }
    if (endpointConfig.requireUsername && username) {
      apiPath = apiPath.replace('{username}', username);
    }

    const url = new URL(`${THREADS_API_BASE}${apiPath}`);
    url.searchParams.set('access_token', accessToken);

    if (endpointConfig.fields) {
      url.searchParams.set('fields', endpointConfig.fields);
    }

    if (endpointConfig.params) {
      for (const [key, value] of Object.entries(endpointConfig.params)) {
        url.searchParams.set(key, value);
      }
    }

    // 處理特殊查詢參數
    if (endpointConfig.requireKeyword && keyword) {
      url.searchParams.set('q', keyword);
    }
    if (endpointConfig.requireLocation && locationQuery) {
      url.searchParams.set('q', locationQuery);
    }
    // profile_lookup 的 username 要作為查詢參數傳遞
    if (endpointConfig.id === 'profile_lookup' && username) {
      url.searchParams.set('username', username);
    }

    // 準備請求選項
    const fetchOptions: RequestInit = {
      method: endpointConfig.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // POST 請求的 body
    if (endpointConfig.method === 'POST' && endpointConfig.requireText && text) {
      // Threads 發文是兩步驟：先建立容器，再發布
      // 這裡簡化為直接發文（需要 media_type=TEXT）
      url.searchParams.set('media_type', 'TEXT');
      url.searchParams.set('text', text);
    }

    // 呼叫 Threads API
    const startTime = Date.now();
    const response = await fetch(url.toString(), fetchOptions);
    const duration = Date.now() - startTime;

    let responseData: unknown;
    try {
      responseData = await response.json();
    } catch {
      responseData = await response.text();
    }

    return jsonResponse(req, {
      endpoint: {
        id: endpointConfig.id,
        name: endpointConfig.name,
        method: endpointConfig.method || 'GET',
        category: endpointConfig.category,
        url: url.toString().replace(accessToken, '[REDACTED]'),
      },
      status: response.status,
      statusText: response.statusText,
      duration_ms: duration,
      response: responseData,
    });

  } catch (error) {
    console.error('API test error:', error);
    return errorResponse(req, 'API 測試失敗，請稍後再試', 500);
  }
});
