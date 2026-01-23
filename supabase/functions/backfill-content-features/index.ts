/**
 * Backfill Content Features - 回填既有貼文的內容特徵
 *
 * POST /backfill-content-features
 * Headers: Authorization: Bearer <CRON_SECRET | SERVICE_ROLE_KEY>
 *
 * 功能：
 * 1. 本地特徵回填：計算 char_count, emoji, hashtag, link, mention
 * 2. AI 標籤重新排隊：將舊標籤的貼文重新入隊分析
 */

import { handleCors } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.ts';
import { extractContentFeatures, contentFeaturesToDbUpdate } from '../_shared/content-features.ts';
import { constantTimeEqual } from '../_shared/crypto.ts';

const BATCH_SIZE = 500;
const CRON_SECRET = Deno.env.get('CRON_SECRET');
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

interface BackfillRequest {
  mode: 'local_features' | 'requeue_ai_tags' | 'both';
  limit?: number;
  account_id?: string; // 可選：只處理特定帳號
}

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
    return errorResponse(req, 'Method not allowed', 405);
  }

  try {
    // 驗證 CRON_SECRET 或 SERVICE_ROLE_KEY
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    const isValidCronSecret = CRON_SECRET && token && constantTimeEqual(token, CRON_SECRET);
    const isValidServiceRole = SERVICE_ROLE_KEY && token && constantTimeEqual(token, SERVICE_ROLE_KEY);

    if (!isValidCronSecret && !isValidServiceRole) {
      return unauthorizedResponse(req, 'Invalid authorization');
    }

    const serviceClient = createServiceClient();
    const body: BackfillRequest = await req.json().catch(() => ({ mode: 'both' }));
    const { mode = 'both', limit = BATCH_SIZE, account_id } = body;

    const results: Record<string, unknown> = {
      mode,
      local_features: null,
      ai_tags_requeued: null,
    };

    // 1. 本地特徵回填
    if (mode === 'local_features' || mode === 'both') {
      let query = serviceClient
        .from('workspace_threads_posts')
        .select('id, text')
        .is('char_count', null)
        .limit(limit);

      if (account_id) {
        query = query.eq('workspace_threads_account_id', account_id);
      }

      const { data: posts, error: fetchError } = await query;

      if (fetchError) {
        console.error('Failed to fetch posts:', fetchError);
        results.local_features = { error: fetchError.message };
      } else if (posts && posts.length > 0) {
        let updated = 0;
        let errors = 0;

        for (const post of posts) {
          try {
            const features = extractContentFeatures(post.text);
            const { error: updateError } = await serviceClient
              .from('workspace_threads_posts')
              .update(contentFeaturesToDbUpdate(features))
              .eq('id', post.id);

            if (updateError) {
              console.error(`Failed to update post ${post.id}:`, updateError);
              errors++;
            } else {
              updated++;
            }
          } catch (e) {
            console.error(`Error processing post ${post.id}:`, e);
            errors++;
          }
        }

        results.local_features = {
          processed: posts.length,
          updated,
          errors,
        };
      } else {
        results.local_features = {
          processed: 0,
          message: 'No posts need local feature backfill',
        };
      }
    }

    // 2. AI 標籤重新排隊（將使用舊格式標籤的貼文重新入隊）
    if (mode === 'requeue_ai_tags' || mode === 'both') {
      // 找出需要重新分析的貼文：
      // - 有 ai_suggested_tags 但沒有 content_features 欄位
      // - 或 ai_suggested_tags 是空的
      let query = serviceClient
        .from('workspace_threads_posts')
        .select('id, workspace_threads_account_id, ai_suggested_tags')
        .not('text', 'is', null)
        .limit(limit);

      if (account_id) {
        query = query.eq('workspace_threads_account_id', account_id);
      }

      const { data: posts, error: fetchError } = await query;

      if (fetchError) {
        console.error('Failed to fetch posts for AI requeue:', fetchError);
        results.ai_tags_requeued = { error: fetchError.message };
      } else if (posts && posts.length > 0) {
        // 過濾出需要重新分析的貼文（沒有 content_features）
        const postsNeedReanalysis = posts.filter((post) => {
          const tags = post.ai_suggested_tags as Record<string, unknown> | null;
          // 如果沒有 tags 或沒有 content_features，需要重新分析
          return !tags || !tags.content_features;
        });

        if (postsNeedReanalysis.length > 0) {
          const queueItems = postsNeedReanalysis.map((post) => ({
            workspace_threads_account_id: post.workspace_threads_account_id,
            post_id: post.id,
            status: 'pending',
            priority: 5, // 中等優先級（回填任務）
          }));

          // ON CONFLICT 更新為 pending，觸發重新分析
          const { error: queueError } = await serviceClient
            .from('ai_tag_queue')
            .upsert(queueItems, {
              onConflict: 'post_id',
            });

          if (queueError) {
            console.error('Failed to requeue AI tagging:', queueError);
            results.ai_tags_requeued = { error: queueError.message };
          } else {
            results.ai_tags_requeued = {
              checked: posts.length,
              requeued: postsNeedReanalysis.length,
            };
          }
        } else {
          results.ai_tags_requeued = {
            checked: posts.length,
            requeued: 0,
            message: 'All checked posts already have content_features',
          };
        }
      } else {
        results.ai_tags_requeued = {
          checked: 0,
          message: 'No posts to check for AI requeue',
        };
      }
    }

    return jsonResponse(req, {
      success: true,
      ...results,
    });
  } catch (error) {
    console.error('Backfill error:', error);
    return errorResponse(req, 'Failed to process backfill', 500);
  }
});
