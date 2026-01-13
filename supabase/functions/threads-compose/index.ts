/**
 * Threads Compose - 建立並發布貼文
 *
 * POST /threads-compose
 * Body: {
 *   account_id: string,
 *   text?: string,
 *   media_type: 'TEXT' | 'IMAGE' | 'VIDEO' | 'CAROUSEL',
 *   media_urls?: string[],
 *   topic_tag?: string,
 *   link_attachment?: string,
 *   scheduled_at?: string (ISO 8601)
 * }
 *
 * 發布流程：
 * - 單篇貼文：建立容器 → 發布
 * - 輪播貼文：建立子項容器 → 建立輪播容器 → 發布
 * - 排程貼文：儲存至 scheduled_posts 表
 */

import { handleCors, getCorsHeaders } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { getAuthenticatedUser, validateWorkspaceMembership } from '../_shared/auth.ts';
import { jsonResponse, unauthorizedResponse, forbiddenResponse } from '../_shared/response.ts';

// 臨時的 debug errorResponse，顯示完整錯誤（含 CORS headers）
function errorResponse(req: Request, message: string, status: number = 400): Response {
  console.error('[compose] Error:', status, message);
  return new Response(
    JSON.stringify({ error: message, status }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        ...getCorsHeaders(req),
      },
    }
  );
}
import { isUuid } from '../_shared/validation.ts';
import { decrypt } from '../_shared/crypto.ts';

const THREADS_API_BASE = 'https://graph.threads.net/v1.0';
const THREADS_TEXT_LIMIT = 500;
const THREADS_TOPIC_TAG_LIMIT = 50;
const CAROUSEL_MIN_ITEMS = 2;
const CAROUSEL_MAX_ITEMS = 20;
const LINK_LIMIT = 5;

type MediaType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'CAROUSEL';

type ReplyControl = 'everyone' | 'accounts_you_follow' | 'mentioned_only';

interface ComposeRequest {
  account_id: string;
  text?: string;
  media_type: MediaType;
  media_urls?: string[];
  topic_tag?: string;
  link_attachment?: string;
  reply_control?: ReplyControl;
  scheduled_at?: string;
}

interface ThreadsApiResponse {
  id?: string;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

interface QuotaResponse {
  data?: Array<{
    quota_usage: number;
    config: {
      quota_total: number;
      quota_duration: number;
    };
  }>;
}

// 驗證請求參數
function validateRequest(body: ComposeRequest): string | null {
  const { text, media_type, media_urls, topic_tag, link_attachment } = body;

  // 文字長度驗證
  if (text && text.length > THREADS_TEXT_LIMIT) {
    return `Text exceeds ${THREADS_TEXT_LIMIT} character limit`;
  }

  // 根據 media_type 驗證
  switch (media_type) {
    case 'TEXT':
      if (!text) {
        return 'Text is required for TEXT posts';
      }
      break;

    case 'IMAGE':
    case 'VIDEO':
      if (!media_urls || media_urls.length !== 1) {
        return `Exactly one media URL is required for ${media_type} posts`;
      }
      break;

    case 'CAROUSEL':
      if (!media_urls || media_urls.length < CAROUSEL_MIN_ITEMS) {
        return `At least ${CAROUSEL_MIN_ITEMS} media URLs are required for CAROUSEL posts`;
      }
      if (media_urls.length > CAROUSEL_MAX_ITEMS) {
        return `At most ${CAROUSEL_MAX_ITEMS} media URLs are allowed for CAROUSEL posts`;
      }
      break;

    default:
      return 'Invalid media_type';
  }

  // Topic tag 驗證
  if (topic_tag) {
    if (topic_tag.length > THREADS_TOPIC_TAG_LIMIT) {
      return `Topic tag exceeds ${THREADS_TOPIC_TAG_LIMIT} character limit`;
    }
    if (topic_tag.includes('.') || topic_tag.includes('&')) {
      return 'Topic tag cannot contain "." or "&"';
    }
  }

  // Link attachment 僅限文字貼文
  if (link_attachment && media_type !== 'TEXT') {
    return 'Link attachment is only supported for TEXT posts';
  }

  // 連結數量限制（僅文字貼文）
  if (media_type === 'TEXT' && text) {
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urlsInText = text.match(urlRegex) || [];
    const uniqueUrls = new Set(urlsInText);
    if (link_attachment && !uniqueUrls.has(link_attachment)) {
      uniqueUrls.add(link_attachment);
    }
    if (uniqueUrls.size > LINK_LIMIT) {
      return `At most ${LINK_LIMIT} unique links are allowed`;
    }
  }

  return null;
}

// 建立單篇貼文容器
async function createSingleContainer(
  accessToken: string,
  threadsUserId: string,
  params: {
    text?: string;
    media_type: MediaType;
    media_url?: string;
    topic_tag?: string;
    link_attachment?: string;
    reply_control?: ReplyControl;
  }
): Promise<ThreadsApiResponse> {
  const url = `${THREADS_API_BASE}/${threadsUserId}/threads`;

  // 使用 form data (application/x-www-form-urlencoded)
  const formData = new URLSearchParams();
  formData.set('media_type', params.media_type);
  formData.set('access_token', accessToken);

  if (params.text) {
    formData.set('text', params.text);
  }

  if (params.media_type === 'IMAGE' && params.media_url) {
    formData.set('image_url', params.media_url);
  } else if (params.media_type === 'VIDEO' && params.media_url) {
    formData.set('video_url', params.media_url);
  }

  if (params.topic_tag) {
    formData.set('topic_tag', params.topic_tag);
  }

  if (params.link_attachment) {
    formData.set('link_attachment', params.link_attachment);
  }

  if (params.reply_control) {
    formData.set('reply_control', params.reply_control);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  return response.json();
}

// 建立輪播子項容器
async function createCarouselItemContainer(
  accessToken: string,
  threadsUserId: string,
  mediaUrl: string,
  mediaType: 'IMAGE' | 'VIDEO'
): Promise<ThreadsApiResponse> {
  const url = `${THREADS_API_BASE}/${threadsUserId}/threads`;

  // 使用 form data (application/x-www-form-urlencoded)
  const formData = new URLSearchParams();
  formData.set('media_type', mediaType);
  formData.set('is_carousel_item', 'true');
  formData.set('access_token', accessToken);

  if (mediaType === 'IMAGE') {
    formData.set('image_url', mediaUrl);
  } else {
    formData.set('video_url', mediaUrl);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  return response.json();
}

// 建立輪播容器
async function createCarouselContainer(
  accessToken: string,
  threadsUserId: string,
  childrenIds: string[],
  text?: string,
  topicTag?: string,
  replyControl?: ReplyControl
): Promise<ThreadsApiResponse> {
  const url = `${THREADS_API_BASE}/${threadsUserId}/threads`;

  // 使用 form data (application/x-www-form-urlencoded)
  const formData = new URLSearchParams();
  formData.set('media_type', 'CAROUSEL');
  formData.set('children', childrenIds.join(','));
  formData.set('access_token', accessToken);

  if (text) {
    formData.set('text', text);
  }

  if (topicTag) {
    formData.set('topic_tag', topicTag);
  }

  if (replyControl) {
    formData.set('reply_control', replyControl);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  return response.json();
}

// 發布容器
async function publishContainer(
  accessToken: string,
  threadsUserId: string,
  containerId: string
): Promise<ThreadsApiResponse> {
  const url = `${THREADS_API_BASE}/${threadsUserId}/threads_publish`;

  // 使用 form data (application/x-www-form-urlencoded)
  const formData = new URLSearchParams();
  formData.set('creation_id', containerId);
  formData.set('access_token', accessToken);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  return response.json();
}

// 檢查發文配額
async function checkPublishQuota(
  accessToken: string,
  threadsUserId: string
): Promise<{ allowed: boolean; usage: number; total: number }> {
  const url = `${THREADS_API_BASE}/${threadsUserId}/threads_publishing_limit?fields=quota_usage,config`;

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data: QuotaResponse = await response.json();

    if (data.data && data.data.length > 0) {
      const { quota_usage, config } = data.data[0];
      return {
        allowed: quota_usage < config.quota_total,
        usage: quota_usage,
        total: config.quota_total,
      };
    }
  } catch (err) {
    console.error('Check quota error:', err);
  }

  // 預設允許（API 失敗時不阻擋）
  return { allowed: true, usage: 0, total: 250 };
}

// 偵測媒體類型
function detectMediaType(url: string): 'IMAGE' | 'VIDEO' {
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('.mp4') || lowerUrl.includes('.mov') || lowerUrl.includes('video')) {
    return 'VIDEO';
  }
  return 'IMAGE';
}

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Debug: 測試 GET 請求
  if (req.method === 'GET') {
    return new Response(JSON.stringify({ status: 'ok', message: 'threads-compose is running' }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (req.method !== 'POST') {
    return errorResponse(req, 'Method not allowed', 405);
  }

  try {
    console.log('[compose] Starting POST request');

    // 解析請求
    let body: ComposeRequest;
    try {
      body = await req.json();
      console.log('[compose] Body parsed:', JSON.stringify(body));
    } catch (e) {
      console.error('[compose] JSON parse error:', e);
      return errorResponse(req, 'Invalid request body', 400);
    }

    const { account_id: accountId, scheduled_at } = body;

    // 驗證 account_id
    if (!accountId) {
      return errorResponse(req, 'account_id is required', 400);
    }

    if (!isUuid(accountId)) {
      return errorResponse(req, 'Invalid account_id', 400);
    }

    // 驗證請求參數
    const validationError = validateRequest(body);
    if (validationError) {
      console.log('[compose] Validation error:', validationError);
      return errorResponse(req, validationError, 400);
    }
    console.log('[compose] Validation passed');

    // 驗證使用者
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return unauthorizedResponse(req, 'Missing authorization header');
    }
    console.log('[compose] Auth header present');

    const supabase = createAnonClient(authHeader);
    const user = await getAuthenticatedUser(supabase);
    console.log('[compose] User:', user?.id);

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

    // 驗證 Workspace 權限（需要 owner 或 editor）
    const membership = await validateWorkspaceMembership(
      supabase,
      user.id,
      account.workspace_id,
      ['owner', 'editor']
    );

    if (!membership) {
      return forbiddenResponse(req, 'No permission to publish posts');
    }

    // 如果是排程貼文，儲存到資料庫
    if (scheduled_at) {
      const scheduledTime = new Date(scheduled_at);
      if (isNaN(scheduledTime.getTime())) {
        return errorResponse(req, 'Invalid scheduled_at format', 400);
      }

      if (scheduledTime <= new Date()) {
        return errorResponse(req, 'scheduled_at must be in the future', 400);
      }

      const { data: scheduledPost, error: insertError } = await serviceClient
        .from('workspace_threads_scheduled_posts')
        .insert({
          workspace_id: account.workspace_id,
          workspace_threads_account_id: accountId,
          text: body.text,
          media_type: body.media_type,
          media_urls: body.media_urls,
          topic_tag: body.topic_tag,
          link_attachment: body.link_attachment,
          reply_control: body.reply_control,
          scheduled_at: scheduled_at,
          status: 'scheduled',
          created_by: user.id,
        })
        .select('id')
        .single();

      if (insertError) {
        console.error('Insert scheduled post error:', insertError);
        return errorResponse(req, 'Failed to schedule post', 500);
      }

      return jsonResponse(req, {
        success: true,
        scheduled_id: scheduledPost.id,
        scheduled_at: scheduled_at,
      });
    }

    // 即時發布流程
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
    const threadsUserId = account.threads_user_id;

    // 檢查發文配額
    const quota = await checkPublishQuota(accessToken, threadsUserId);
    if (!quota.allowed) {
      return errorResponse(
        req,
        `Publishing quota exceeded. Used ${quota.usage}/${quota.total} in the last 24 hours.`,
        429
      );
    }

    let containerId: string;

    // 根據貼文類型建立容器
    if (body.media_type === 'CAROUSEL') {
      // 輪播貼文流程
      const childrenIds: string[] = [];

      for (const mediaUrl of body.media_urls || []) {
        const itemType = detectMediaType(mediaUrl);
        const itemResult = await createCarouselItemContainer(
          accessToken,
          threadsUserId,
          mediaUrl,
          itemType
        );

        if (itemResult.error || !itemResult.id) {
          console.error('Create carousel item error:', itemResult.error);
          return errorResponse(
            req,
            itemResult.error?.message || 'Failed to create carousel item',
            500
          );
        }

        childrenIds.push(itemResult.id);
      }

      // 建立輪播容器
      const carouselResult = await createCarouselContainer(
        accessToken,
        threadsUserId,
        childrenIds,
        body.text,
        body.topic_tag,
        body.reply_control
      );

      if (carouselResult.error || !carouselResult.id) {
        console.error('Create carousel error:', carouselResult.error);
        return errorResponse(
          req,
          carouselResult.error?.message || 'Failed to create carousel',
          500
        );
      }

      containerId = carouselResult.id;
    } else {
      // 單篇貼文流程
      const result = await createSingleContainer(accessToken, threadsUserId, {
        text: body.text,
        media_type: body.media_type,
        media_url: body.media_urls?.[0],
        topic_tag: body.topic_tag,
        link_attachment: body.link_attachment,
        reply_control: body.reply_control,
      });

      if (result.error || !result.id) {
        console.error('Create container error:', result.error);
        return errorResponse(
          req,
          result.error?.message || 'Failed to create post container',
          500
        );
      }

      containerId = result.id;
    }

    // 等待媒體處理（影片可能需要較長時間）
    const waitTime = body.media_type === 'VIDEO' ? 10000 : 2000;
    await new Promise((resolve) => setTimeout(resolve, waitTime));

    // 發布貼文
    const publishResult = await publishContainer(accessToken, threadsUserId, containerId);

    if (publishResult.error || !publishResult.id) {
      console.error('Publish error:', publishResult.error);
      return errorResponse(
        req,
        publishResult.error?.message || 'Failed to publish post',
        500
      );
    }

    // 取得已發布貼文詳情
    const postId = publishResult.id;
    const detailUrl = `${THREADS_API_BASE}/${postId}?fields=id,text,permalink,timestamp,media_type`;

    const detailResponse = await fetch(detailUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const detailData = await detailResponse.json();

    return jsonResponse(req, {
      success: true,
      post_id: postId,
      permalink: detailData.permalink,
      timestamp: detailData.timestamp,
      quota: {
        usage: quota.usage + 1,
        total: quota.total,
      },
    });

  } catch (error) {
    console.error('[compose] Uncaught error:', error);
    // 返回詳細錯誤訊息以便調試（含 CORS headers）
    return new Response(
      JSON.stringify({
        error: `Failed to compose post: ${error instanceof Error ? error.message : 'Unknown error'}`,
        stack: error instanceof Error ? error.stack : undefined,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...getCorsHeaders(req),
        },
      }
    );
  }
});
