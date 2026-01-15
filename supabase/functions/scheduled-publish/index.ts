/**
 * Scheduled Publish - 發布到期的排程貼文
 *
 * POST /scheduled-publish
 * Headers: Authorization: Bearer <CRON_SECRET>
 *
 * 由 pg_cron 每分鐘呼叫，檢查並發布到期的排程貼文
 */

import { handleCors } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.ts';
import { acquireJobLock, releaseJobLock } from '../_shared/job-lock.ts';
import { decrypt } from '../_shared/crypto.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET');
const JOB_LOCK_TTL_SECONDS = 5 * 60;
const THREADS_API_BASE = 'https://graph.threads.net/v1.0';

interface ThreadsApiResponse {
  id?: string;
  error?: {
    message: string;
    type: string;
    code: number;
  };
}

// 建立單篇貼文容器
async function createSingleContainer(
  accessToken: string,
  threadsUserId: string,
  params: {
    text?: string;
    media_type: string;
  }
): Promise<ThreadsApiResponse> {
  const url = `${THREADS_API_BASE}/${threadsUserId}/threads`;

  const formData = new URLSearchParams();
  formData.set('media_type', params.media_type);
  formData.set('access_token', accessToken);

  if (params.text) {
    formData.set('text', params.text);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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

  const formData = new URLSearchParams();
  formData.set('creation_id', containerId);
  formData.set('access_token', accessToken);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });

  return response.json();
}

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return errorResponse(req, 'Method not allowed', 405);
  }

  try {
    // 驗證 CRON_SECRET
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!CRON_SECRET || token !== CRON_SECRET) {
      return unauthorizedResponse(req, 'Invalid cron secret');
    }

    const serviceClient = createServiceClient();

    // 取得 job lock
    const lock = await acquireJobLock(serviceClient, 'scheduled_publish', JOB_LOCK_TTL_SECONDS);

    if (!lock.acquired) {
      return jsonResponse(req, {
        success: true,
        skipped: true,
        reason: 'Job already running',
      });
    }

    try {
      // 查詢到期的排程貼文（透過 publish_schedules 表）
      const { data: schedules, error: schedulesError } = await serviceClient
        .from('workspace_threads_publish_schedules')
        .select(`
          id,
          outbound_post_id,
          scheduled_at,
          outbound_post:workspace_threads_outbound_posts (
            id,
            text,
            publish_status,
            workspace_threads_account_id,
            media_type
          )
        `)
        .is('executed_at', null)
        .eq('is_cancelled', false)
        .lte('scheduled_at', new Date().toISOString())
        .limit(50);

      // 轉換資料結構以相容後續處理
      const posts = schedules?.map(s => ({
        id: s.outbound_post?.id,
        schedule_id: s.id,
        text: s.outbound_post?.text,
        publish_status: s.outbound_post?.publish_status,
        workspace_threads_account_id: s.outbound_post?.workspace_threads_account_id,
        media_type: s.outbound_post?.media_type,
      })).filter(p => p.id && p.publish_status === 'scheduled') || [];

      const postsError = schedulesError;

      if (postsError) {
        await releaseJobLock(serviceClient, 'scheduled_publish');
        return jsonResponse(req, {
          success: false,
          error: postsError.message,
        });
      }

      if (!posts || posts.length === 0) {
        await releaseJobLock(serviceClient, 'scheduled_publish');
        return jsonResponse(req, {
          success: true,
          processed: 0,
          message: 'No posts to publish',
        });
      }

      const results: Array<{ id: string; success: boolean; postId?: string; error?: string }> = [];

      for (const post of posts) {
        // 獲取帳號資訊
        const { data: account, error: accountError } = await serviceClient
          .from('workspace_threads_accounts')
          .select('threads_user_id')
          .eq('id', post.workspace_threads_account_id)
          .single();

        if (accountError || !account) {
          results.push({ id: post.id, success: false, error: 'Account not found' });
          await serviceClient
            .from('workspace_threads_outbound_posts')
            .update({ publish_status: 'failed', error_message: 'Account not found' })
            .eq('id', post.id);
          continue;
        }

        // 獲取 token
        const { data: tokenData, error: tokenError } = await serviceClient
          .from('workspace_threads_tokens')
          .select('access_token_encrypted')
          .eq('workspace_threads_account_id', post.workspace_threads_account_id)
          .eq('is_primary', true)
          .is('revoked_at', null)
          .single();

        if (tokenError || !tokenData) {
          results.push({ id: post.id, success: false, error: 'Token not found' });
          await serviceClient
            .from('workspace_threads_outbound_posts')
            .update({ publish_status: 'failed', error_message: 'Token not found' })
            .eq('id', post.id);
          continue;
        }

        // 解密 token
        const accessToken = await decrypt(tokenData.access_token_encrypted);

        // 建立容器
        const containerResult = await createSingleContainer(accessToken, account.threads_user_id, {
          text: post.text || '',
          media_type: post.media_type || 'TEXT',
        });

        if (containerResult.error || !containerResult.id) {
          const errorMsg = containerResult.error?.message || 'Container failed';
          results.push({ id: post.id, success: false, error: errorMsg });
          await serviceClient
            .from('workspace_threads_outbound_posts')
            .update({ publish_status: 'failed', error_message: errorMsg })
            .eq('id', post.id);
          continue;
        }

        // 等待處理
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 發布
        const publishResult = await publishContainer(accessToken, account.threads_user_id, containerResult.id);

        if (publishResult.error || !publishResult.id) {
          const errorMsg = publishResult.error?.message || 'Publish failed';
          results.push({ id: post.id, success: false, error: errorMsg });
          await serviceClient
            .from('workspace_threads_outbound_posts')
            .update({ publish_status: 'failed', error_message: errorMsg })
            .eq('id', post.id);
          continue;
        }

        const now = new Date().toISOString();

        // 更新貼文狀態
        await serviceClient
          .from('workspace_threads_outbound_posts')
          .update({
            publish_status: 'published',
            threads_post_id: publishResult.id,
            published_at: now,
          })
          .eq('id', post.id);

        // 更新排程記錄的執行時間
        if (post.schedule_id) {
          await serviceClient
            .from('workspace_threads_publish_schedules')
            .update({ executed_at: now })
            .eq('id', post.schedule_id);
        }

        results.push({ id: post.id, success: true, postId: publishResult.id });
      }

      // 記錄日誌
      await serviceClient.from('system_job_logs').insert({
        job_type: 'scheduled_publish',
        status: 'completed',
        metadata: {
          processed: results.length,
          succeeded: results.filter((r) => r.success).length,
          failed: results.filter((r) => !r.success).length,
          results,
        },
      });

      await releaseJobLock(serviceClient, 'scheduled_publish');

      return jsonResponse(req, {
        success: true,
        processed: results.length,
        succeeded: results.filter((r) => r.success).length,
        failed: results.filter((r) => !r.success).length,
        results,
      });
    } catch (innerError) {
      await releaseJobLock(serviceClient, 'scheduled_publish');
      throw innerError;
    }
  } catch (error) {
    console.error('Scheduled publish error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal error',
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'no stack',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
});
