/**
 * AI Tagging - 處理 AI 標籤分析任務
 *
 * POST /ai-tagging
 * Headers: Authorization: Bearer <CRON_SECRET>
 *
 * 從 ai_tag_queue 取得待處理任務，呼叫 Gemini API 進行分析
 */

import { handleCors } from '../_shared/cors.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.ts';
import { GeminiClient } from '../_shared/gemini.ts';
import { constantTimeEqual } from '../_shared/crypto.ts';

const BATCH_SIZE = 10;
const CRON_SECRET = Deno.env.get('CRON_SECRET');
const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

interface QueueJob {
  id: string;
  workspace_threads_account_id: string;
  post_id: string;
  attempts: number;
  max_attempts: number;
}

interface PostData {
  id: string;
  text: string | null;
  workspace_threads_account_id: string;
  workspace_threads_accounts: {
    workspace_id: string;
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
    // 驗證 CRON_SECRET
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!CRON_SECRET || !token || !constantTimeEqual(token, CRON_SECRET)) {
      return unauthorizedResponse(req, 'Invalid cron secret');
    }

    if (!GEMINI_API_KEY) {
      console.error('GEMINI_API_KEY not configured');
      return errorResponse(req, '系統設定錯誤', 500);
    }

    const serviceClient = createServiceClient();
    const gemini = new GeminiClient(GEMINI_API_KEY);

    // 取得待處理任務（pending 或可重試的 failed，預設 max_attempts=3）
    const { data: jobs, error: fetchError } = await serviceClient
      .from('ai_tag_queue')
      .select('id, workspace_threads_account_id, post_id, attempts, max_attempts')
      .or('status.eq.pending,and(status.eq.failed,attempts.lt.3)')
      .order('created_at', { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error('Failed to fetch jobs:', fetchError);
      return errorResponse(req, 'Failed to fetch jobs', 500);
    }

    if (!jobs || jobs.length === 0) {
      return jsonResponse(req, { message: 'No jobs to process', processed: 0 });
    }

    let processed = 0;
    let failed = 0;

    for (const job of jobs as QueueJob[]) {
      try {
        // 標記為 processing
        await serviceClient
          .from('ai_tag_queue')
          .update({
            status: 'processing',
            started_at: new Date().toISOString(),
            attempts: job.attempts + 1,
          })
          .eq('id', job.id);

        // 取得貼文內容
        const { data: post, error: postError } = await serviceClient
          .from('workspace_threads_posts')
          .select(`
            id,
            text,
            workspace_threads_account_id,
            workspace_threads_accounts!inner (
              workspace_id
            )
          `)
          .eq('id', job.post_id)
          .single();

        if (postError || !post) {
          throw new Error(`Post not found: ${job.post_id}`);
        }

        const postData = post as unknown as PostData;

        // 貼文無文字則跳過
        if (!postData.text || postData.text.trim() === '') {
          await serviceClient
            .from('ai_tag_queue')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString(),
            })
            .eq('id', job.id);

          // 設定空標籤
          await serviceClient
            .from('workspace_threads_posts')
            .update({ ai_suggested_tags: {} })
            .eq('id', job.post_id);

          processed++;
          continue;
        }

        // 呼叫 Gemini API
        const result = await gemini.analyzePost(postData.text);

        // 提取 content_features
        const contentFeatures = result.tags.content_features || {};

        // 更新貼文 AI 標籤 + 內容特徵欄位
        await serviceClient
          .from('workspace_threads_posts')
          .update({
            ai_suggested_tags: result.tags,
            // 同步寫入獨立欄位（方便查詢）
            has_question: contentFeatures.has_question ?? false,
            question_type: contentFeatures.question_type ?? null,
            has_cta: contentFeatures.has_cta ?? false,
            cta_type: contentFeatures.cta_type ?? null,
          })
          .eq('id', job.post_id);

        // 記錄 LLM 使用量
        await serviceClient.from('llm_usage_logs').insert({
          workspace_id: postData.workspace_threads_accounts.workspace_id,
          workspace_threads_account_id: job.workspace_threads_account_id,
          model_name: 'gemini-2.0-flash',
          input_tokens: result.usage.promptTokenCount,
          output_tokens: result.usage.candidatesTokenCount,
          total_tokens: result.usage.totalTokenCount,
          purpose: 'post_tagging',
          metadata: { post_id: job.post_id },
        });

        // 標記完成
        await serviceClient
          .from('ai_tag_queue')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        processed++;
      } catch (error) {
        console.error(`Failed to process job ${job.id}:`, error);

        // 標記失敗
        await serviceClient
          .from('ai_tag_queue')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', job.id);

        failed++;
      }
    }

    return jsonResponse(req, {
      message: 'Processing complete',
      processed,
      failed,
      total: jobs.length,
    });
  } catch (error) {
    console.error('AI tagging error:', error);
    return errorResponse(req, 'Failed to process AI tagging', 500);
  }
});
