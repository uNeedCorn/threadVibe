/**
 * Sync Metrics - 同步貼文成效（三層式寫入）
 *
 * POST /sync-metrics
 * Body: { workspace_threads_account_id: string }
 *
 * 同步每篇貼文的成效指標（views, likes 等）
 * 採用三層式寫入架構：
 * - Layer 1: Snapshot（不可變）
 * - Layer 2: Delta（可重算）
 * - Layer 3: Current（快速查詢）
 */

import { handleCors } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { getAuthenticatedUser, validateWorkspaceMembership, isSystemAdmin } from '../_shared/auth.ts';
import { decrypt } from '../_shared/crypto.ts';
import { ThreadsApiClient, ThreadsPostInsights } from '../_shared/threads-api.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { isUuid } from '../_shared/validation.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '../_shared/response.ts';
import { calculateRates } from '../_shared/metrics.ts';

// 批次處理設定
const BATCH_SIZE = 10;
const BATCH_DELAY_MS = 1000;

interface Metrics {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
}

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return errorResponse(req, 'Method not allowed', 405);
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse(req, 'Invalid JSON body', 400, 'INVALID_JSON');
    }

    const { workspace_threads_account_id } = (body ?? {}) as {
      workspace_threads_account_id?: string;
    };

    if (!workspace_threads_account_id) {
      return errorResponse(req, 'workspace_threads_account_id is required', 400);
    }

    if (!isUuid(workspace_threads_account_id)) {
      return errorResponse(req, 'Invalid workspace_threads_account_id', 400, 'INVALID_ID');
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
      `sync_metrics:${user.id}`,
      5,
      60
    );
    if (!rateLimit.allowed) {
      return errorResponse(req, 'Rate limit exceeded', 429);
    }

    // 取得帳號資訊
    const { data: account, error: accountError } = await serviceClient
      .from('workspace_threads_accounts')
      .select('id, workspace_id')
      .eq('id', workspace_threads_account_id)
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

    // 取得有效 Token
    const { data: token } = await serviceClient
      .from('workspace_threads_tokens')
      .select('access_token_encrypted')
      .eq('workspace_threads_account_id', workspace_threads_account_id)
      .eq('is_primary', true)
      .is('revoked_at', null)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!token) {
      return errorResponse(req, 'No valid access token found', 400, 'TOKEN_EXPIRED');
    }

    // 記錄同步開始
    const { data: syncLog } = await serviceClient
      .from('sync_logs')
      .insert({
        workspace_threads_account_id,
        job_type: 'sync_metrics',
        status: 'running',
      })
      .select()
      .single();

    try {
      const accessToken = await decrypt(token.access_token_encrypted);
      const threadsClient = new ThreadsApiClient(accessToken);

      // 取得該帳號所有貼文
      const { data: posts } = await serviceClient
        .from('workspace_threads_posts')
        .select('id, threads_post_id')
        .eq('workspace_threads_account_id', workspace_threads_account_id);

      if (!posts || posts.length === 0) {
        await serviceClient
          .from('sync_logs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            metadata: { success_count: 0, error_count: 0, reason: 'no_posts' },
          })
          .eq('id', syncLog?.id);

        return jsonResponse(req, { success: true, synced_count: 0, error_count: 0 });
      }

      let successCount = 0;
      let errorCount = 0;
      const now = new Date().toISOString();

      // 批次處理
      for (let i = 0; i < posts.length; i += BATCH_SIZE) {
        const batch = posts.slice(i, i + BATCH_SIZE);

        const results = await Promise.all(
          batch.map(async (post) => {
            try {
              // 1. 從 Threads API 取得成效
              const insights = await threadsClient.getPostInsights(post.threads_post_id);
              const metrics: Metrics = {
                views: insights.views ?? 0,
                likes: insights.likes ?? 0,
                replies: insights.replies ?? 0,
                reposts: insights.reposts ?? 0,
                quotes: insights.quotes ?? 0,
                shares: insights.shares ?? 0,
              };

              // 2. 取得前一個 Snapshot（用於計算 Delta）
              const { data: prevSnapshot } = await serviceClient
                .from('workspace_threads_post_metrics')
                .select('*')
                .eq('workspace_threads_post_id', post.id)
                .order('captured_at', { ascending: false })
                .limit(1)
                .single();

              // 3. 計算比率指標
              const rates = calculateRates(metrics);

              // 4. Layer 1: 寫入 Snapshot（不可變，含比率指標）
              await serviceClient
                .from('workspace_threads_post_metrics')
                .insert({
                  workspace_threads_post_id: post.id,
                  ...metrics,
                  engagement_rate: rates.engagementRate,
                  reply_rate: rates.replyRate,
                  repost_rate: rates.repostRate,
                  quote_rate: rates.quoteRate,
                  virality_score: rates.viralityScore,
                  captured_at: now,
                });

              // 5. Layer 2: 計算並寫入 Delta
              if (prevSnapshot) {
                await serviceClient
                  .from('workspace_threads_post_metrics_deltas')
                  .insert({
                    workspace_threads_post_id: post.id,
                    period_start: prevSnapshot.captured_at,
                    period_end: now,
                    views_delta: metrics.views - prevSnapshot.views,
                    likes_delta: metrics.likes - prevSnapshot.likes,
                    replies_delta: metrics.replies - prevSnapshot.replies,
                    reposts_delta: metrics.reposts - prevSnapshot.reposts,
                    quotes_delta: metrics.quotes - prevSnapshot.quotes,
                    shares_delta: metrics.shares - prevSnapshot.shares,
                    is_recalculated: false,
                  });
              }

              // 6. Layer 3: 更新 Current（使用已計算的比率）
              await serviceClient
                .from('workspace_threads_posts')
                .update({
                  current_views: metrics.views,
                  current_likes: metrics.likes,
                  current_replies: metrics.replies,
                  current_reposts: metrics.reposts,
                  current_quotes: metrics.quotes,
                  current_shares: metrics.shares,
                  engagement_rate: rates.engagementRate,
                  reply_rate: rates.replyRate,
                  repost_rate: rates.repostRate,
                  quote_rate: rates.quoteRate,
                  virality_score: rates.viralityScore,
                  last_metrics_sync_at: now,
                })
                .eq('id', post.id);

              return { ok: true as const };
            } catch (error) {
              console.error(`Failed to sync metrics for post ${post.id}:`, error);
              return { ok: false as const };
            }
          })
        );

        for (const r of results) {
          if (r.ok) successCount++;
          else errorCount++;
        }

        // 批次間延遲（避免 Rate Limit）
        if (i + BATCH_SIZE < posts.length) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }

      // 更新同步記錄
      const finalStatus = errorCount === 0 ? 'completed' : (successCount === 0 ? 'failed' : 'partial');
      await serviceClient
        .from('sync_logs')
        .update({
          status: finalStatus,
          completed_at: new Date().toISOString(),
          metadata: { success_count: successCount, error_count: errorCount },
        })
        .eq('id', syncLog?.id);

      return jsonResponse(req, {
        success: true,
        synced_count: successCount,
        error_count: errorCount,
      });

    } catch (syncError) {
      await serviceClient
        .from('sync_logs')
        .update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          error_message: syncError instanceof Error ? syncError.message : 'Unknown error',
        })
        .eq('id', syncLog?.id);

      throw syncError;
    }

  } catch (error) {
    console.error('Sync metrics error:', error);
    return errorResponse(req, 'Failed to sync metrics', 500);
  }
});
// calculateRates 已統一使用 _shared/metrics.ts
