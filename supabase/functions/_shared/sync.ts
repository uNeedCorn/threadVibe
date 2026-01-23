/**
 * 共用同步模組
 * 確保手動同步與排程同步使用相同邏輯
 *
 * ADR-002: 資料保留與 Rollup 策略
 * - 雙寫模式：同時寫入舊表（legacy）和新分層表
 * - 新分層表：15m / hourly / daily
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ThreadsApiClient } from './threads-api.ts';
import {
  getPostMetricsTargetTable,
  getAccountInsightsTargetTable,
  getBucketValue,
  shouldSyncPost,
  getSyncFrequency,
} from './tiered-storage.ts';
import { calculateRates, calculateEngagementQuality, PostMetrics } from './metrics.ts';
import { extractContentFeatures, contentFeaturesToDbUpdate } from './content-features.ts';

// ============================================
// Types
// ============================================

export interface SyncPostsResult {
  synced_count: number;
  enqueue_count: number;
  posts: Array<{ threads_post_id: string; text?: string }>;
}

export interface SyncMetricsResult {
  success_count: number;
  error_count: number;
  synced_post_ids: string[];
}

export interface SyncAccountInsightsResult {
  insights: {
    followers_count: number;
    profile_views: number;
    likes_count_7d: number;
    views_count_7d: number;
  };
  has_previous: boolean;
}

// 使用 PostMetrics 從 metrics.ts
type Metrics = PostMetrics;

// ============================================
// Sync Posts
// ============================================

export async function syncPostsForAccount(
  serviceClient: SupabaseClient,
  accountId: string,
  threadsClient: ThreadsApiClient,
  limit = 100
): Promise<SyncPostsResult> {
  const posts = await threadsClient.getUserPosts('me', limit);

  const normalizedPosts = posts.map((post) => {
    const postType = post.is_reply ? 'reply' : post.is_quote_post ? 'quote' : 'original';

    // Extract content features from post text
    const contentFeatures = extractContentFeatures(post.text);

    return {
      workspace_threads_account_id: accountId,
      threads_post_id: post.id,
      text: post.text,
      media_type: post.media_type,
      media_url: post.media_url,
      permalink: post.permalink,
      published_at: post.timestamp
        ? new Date(post.timestamp).toISOString()
        : new Date().toISOString(),
      // Post type 相關欄位
      post_type: postType,
      is_reply: post.is_reply ?? false,
      replied_to_post_id: post.replied_to?.id ?? null,
      root_post_id: post.root_post?.id ?? null,
      // Content features（本地計算，不需 AI）
      ...contentFeaturesToDbUpdate(contentFeatures),
    };
  });

  let enqueueCount = 0;

  if (normalizedPosts.length > 0) {
    const { error } = await serviceClient
      .from('workspace_threads_posts')
      .upsert(normalizedPosts, {
        onConflict: 'workspace_threads_account_id,threads_post_id',
      });

    if (error) throw error;

    // 查詢需要 AI tagging 的貼文（尚未分析的）
    const { data: postsNeedTagging } = await serviceClient
      .from('workspace_threads_posts')
      .select('id')
      .eq('workspace_threads_account_id', accountId)
      .is('ai_suggested_tags', null);

    // 入隊 AI tagging
    if (postsNeedTagging && postsNeedTagging.length > 0) {
      const queueItems = postsNeedTagging.map((post) => ({
        workspace_threads_account_id: accountId,
        post_id: post.id,
        status: 'pending',
      }));

      // ON CONFLICT DO NOTHING 避免重複入隊
      const { error: queueError } = await serviceClient
        .from('ai_tag_queue')
        .upsert(queueItems, {
          onConflict: 'post_id',
          ignoreDuplicates: true,
        });

      if (queueError) {
        console.error('Failed to enqueue AI tagging:', queueError);
      } else {
        enqueueCount = postsNeedTagging.length;
      }
    }
  }

  return {
    synced_count: normalizedPosts.length,
    enqueue_count: enqueueCount,
    posts: normalizedPosts.map((p) => ({
      threads_post_id: p.threads_post_id,
      text: p.text,
    })),
  };
}

// ============================================
// Sync Metrics (Three-Layer)
// ============================================

export async function syncMetricsForAccount(
  serviceClient: SupabaseClient,
  accountId: string,
  threadsClient: ThreadsApiClient,
  now: string,
  syncBatchAt: string
): Promise<SyncMetricsResult> {
  const nowDate = new Date(now);

  // 取得該帳號所有貼文（含 published_at 用於判斷同步頻率）
  const { data: posts } = await serviceClient
    .from('workspace_threads_posts')
    .select('id, threads_post_id, published_at, last_metrics_sync_at')
    .eq('workspace_threads_account_id', accountId);

  if (!posts || posts.length === 0) {
    return { success_count: 0, error_count: 0, synced_post_ids: [] };
  }

  let successCount = 0;
  let errorCount = 0;
  const syncedPostIds: string[] = [];

  for (const post of posts) {
    try {
      // 0. 檢查是否需要同步（根據貼文生命週期）
      const syncFrequency = getSyncFrequency(post.published_at, nowDate);
      if (syncFrequency === 'skip') {
        console.log(`Skipping post ${post.id}: older than 365 days`);
        continue;
      }

      // 檢查是否已達同步間隔
      if (!shouldSyncPost(post.published_at, post.last_metrics_sync_at, nowDate)) {
        console.log(`Skipping post ${post.id}: not yet due for ${syncFrequency} sync`);
        continue;
      }

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

      // 4. Layer 1: 寫入 Snapshot（不可變，含比率指標）- Legacy 表
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
          sync_batch_at: syncBatchAt,
        });

      // 4b. 雙寫：寫入新分層表（ADR-002）
      // 同時寫入 15m + hourly + daily，讓用戶即時看到當前數據
      // Rollup Job 會在 :05 和 01:00 確保資料正確性
      const bucket15m = getBucketValue('workspace_threads_post_metrics_15m', now);
      const bucketHourly = getBucketValue('workspace_threads_post_metrics_hourly', now);
      const bucketDaily = getBucketValue('workspace_threads_post_metrics_daily', now);

      // 寫入 15m 表（含 rate/score）
      await serviceClient
        .from('workspace_threads_post_metrics_15m')
        .upsert({
          workspace_threads_post_id: post.id,
          ...metrics,
          engagement_rate: rates.engagementRate,
          reply_rate: rates.replyRate,
          repost_rate: rates.repostRate,
          quote_rate: rates.quoteRate,
          virality_score: rates.viralityScore,
          ...bucket15m,
          captured_at: now,
        }, {
          onConflict: 'workspace_threads_post_id,bucket_ts',
        });

      // 寫入 hourly 表（即時更新當前小時，含 rate/score）
      await serviceClient
        .from('workspace_threads_post_metrics_hourly')
        .upsert({
          workspace_threads_post_id: post.id,
          ...metrics,
          engagement_rate: rates.engagementRate,
          reply_rate: rates.replyRate,
          repost_rate: rates.repostRate,
          quote_rate: rates.quoteRate,
          virality_score: rates.viralityScore,
          ...bucketHourly,
          captured_at: now,
        }, {
          onConflict: 'workspace_threads_post_id,bucket_ts',
        });

      // 寫入 daily 表（即時更新當天，含 rate/score）
      await serviceClient
        .from('workspace_threads_post_metrics_daily')
        .upsert({
          workspace_threads_post_id: post.id,
          ...metrics,
          engagement_rate: rates.engagementRate,
          reply_rate: rates.replyRate,
          repost_rate: rates.repostRate,
          quote_rate: rates.quoteRate,
          virality_score: rates.viralityScore,
          ...bucketDaily,
          captured_at: now,
        }, {
          onConflict: 'workspace_threads_post_id,bucket_date',
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
            sync_batch_at: syncBatchAt,
          });
      }

      // 6. 計算互動品質
      const quality = calculateEngagementQuality(metrics);

      // 7. Layer 3: 更新 Current（使用已計算的比率和品質）
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
          discussion_depth: quality.discussionDepth,
          share_willingness: quality.shareWillingness,
          last_metrics_sync_at: now,
          last_sync_batch_at: syncBatchAt,
        })
        .eq('id', post.id);

      successCount++;
      syncedPostIds.push(post.id);
    } catch (error) {
      console.error(`Failed to sync metrics for post ${post.id}:`, error);
      errorCount++;
    }
  }

  // 將成功同步的貼文入隊 r_hat_queue（非同步計算 R̂_t）
  if (syncedPostIds.length > 0) {
    const queueItems = syncedPostIds.map((postId) => {
      // 計算優先級：新貼文（48 小時內）優先
      const postData = posts.find((p) => p.id === postId);
      const publishedAt = postData?.published_at ? new Date(postData.published_at) : null;
      const hoursOld = publishedAt
        ? (nowDate.getTime() - publishedAt.getTime()) / (1000 * 60 * 60)
        : 999;

      let priority = 0;
      if (hoursOld <= 48) priority = 10; // 新貼文優先

      return {
        workspace_threads_post_id: postId,
        status: 'pending',
        priority,
        attempts: 0, // 重置嘗試次數
        error_message: null,
        started_at: null,
        completed_at: null,
        calculated_r_hat: null,
        calculated_r_hat_status: null,
      };
    });

    // ON CONFLICT 更新為 pending，觸發重新計算
    const { error: queueError } = await serviceClient
      .from('r_hat_queue')
      .upsert(queueItems, {
        onConflict: 'workspace_threads_post_id',
      });

    if (queueError) {
      console.error('Failed to enqueue r_hat calculation:', queueError);
    } else {
      console.log(`Enqueued ${syncedPostIds.length} posts for R̂_t calculation`);
    }
  }

  return { success_count: successCount, error_count: errorCount, synced_post_ids: syncedPostIds };
}

// ============================================
// Sync Account Insights (Three-Layer)
// ============================================

export async function syncAccountInsightsForAccount(
  serviceClient: SupabaseClient,
  accountId: string,
  threadsClient: ThreadsApiClient,
  now: string,
  syncBatchAt: string
): Promise<SyncAccountInsightsResult> {
  // 從 Threads API 取得 Insights
  // 注意：Threads API 使用者層級只支援 views 和 followers_count
  // - followers_count 需要帳號有 100+ 粉絲才會回傳
  // - likes 只在貼文層級可用，使用者層級無此指標
  const apiInsights = await threadsClient.getUserInsights();

  // API 回傳的 views 是「當日累積 profile views」
  // - 在 UTC 8（台灣 16:00）換日重置
  // - 應存入 profile_views 欄位
  const insights = {
    followers_count: apiInsights.followers_count ?? 0,
    profile_views: apiInsights.views ?? 0, // 當日累積 profile views
    likes_count_7d: 0, // Threads API 使用者層級不提供 likes 指標
    views_count_7d: 0, // API 不提供此指標，保留欄位供未來使用
  };

  // 取得前一個 Snapshot（用於計算 Delta）
  const { data: prevSnapshot } = await serviceClient
    .from('workspace_threads_account_insights')
    .select('*')
    .eq('workspace_threads_account_id', accountId)
    .order('captured_at', { ascending: false })
    .limit(1)
    .single();

  // Layer 1: 寫入 Snapshot（不可變）- Legacy 表
  await serviceClient
    .from('workspace_threads_account_insights')
    .insert({
      workspace_threads_account_id: accountId,
      followers_count: insights.followers_count,
      profile_views: insights.profile_views,
      likes_count_7d: insights.likes_count_7d,
      views_count_7d: insights.views_count_7d,
      captured_at: now,
      sync_batch_at: syncBatchAt,
    });

  // Layer 1b: 雙寫：寫入新分層表（ADR-002）
  // 同時寫入 15m + hourly + daily，讓用戶即時看到當前數據
  // Rollup Job 會在 :05 和 01:00 確保資料正確性
  const bucket15m = getBucketValue('workspace_threads_account_insights_15m', now);
  const bucketHourly = getBucketValue('workspace_threads_account_insights_hourly', now);
  const bucketDaily = getBucketValue('workspace_threads_account_insights_daily', now);

  // 寫入 15m 表
  await serviceClient
    .from('workspace_threads_account_insights_15m')
    .upsert({
      workspace_threads_account_id: accountId,
      followers_count: insights.followers_count,
      profile_views: insights.profile_views,
      likes_count_7d: insights.likes_count_7d,
      views_count_7d: insights.views_count_7d,
      ...bucket15m,
      captured_at: now,
    }, {
      onConflict: 'workspace_threads_account_id,bucket_ts',
    });

  // 寫入 hourly 表（即時更新當前小時）
  await serviceClient
    .from('workspace_threads_account_insights_hourly')
    .upsert({
      workspace_threads_account_id: accountId,
      followers_count: insights.followers_count,
      profile_views: insights.profile_views,
      likes_count_7d: insights.likes_count_7d,
      views_count_7d: insights.views_count_7d,
      ...bucketHourly,
      captured_at: now,
    }, {
      onConflict: 'workspace_threads_account_id,bucket_ts',
    });

  // 寫入 daily 表（即時更新當天）
  await serviceClient
    .from('workspace_threads_account_insights_daily')
    .upsert({
      workspace_threads_account_id: accountId,
      followers_count: insights.followers_count,
      profile_views: insights.profile_views,
      likes_count_7d: insights.likes_count_7d,
      views_count_7d: insights.views_count_7d,
      ...bucketDaily,
      captured_at: now,
    }, {
      onConflict: 'workspace_threads_account_id,bucket_date',
    });

  // Layer 2: 計算並寫入 Delta
  if (prevSnapshot) {
    // profile_views 在 UTC 8（台灣 16:00）換日重置
    // 當換日時，當前值會比前一筆小很多（例如 8000 → 300）
    // 此時 delta 應該是當前值（新一天的累積），而不是負值
    let profileViewsDelta = insights.profile_views - prevSnapshot.profile_views;

    // 檢測換日：如果 delta 是負值，表示跨日重置
    // 此時使用當前值作為新一天的 delta
    if (profileViewsDelta < 0) {
      profileViewsDelta = insights.profile_views;
    }

    await serviceClient
      .from('workspace_threads_account_insights_deltas')
      .insert({
        workspace_threads_account_id: accountId,
        period_start: prevSnapshot.captured_at,
        period_end: now,
        followers_delta: insights.followers_count - prevSnapshot.followers_count,
        profile_views_delta: profileViewsDelta,
        likes_count_7d_delta: insights.likes_count_7d - prevSnapshot.likes_count_7d,
        views_count_7d_delta: insights.views_count_7d - prevSnapshot.views_count_7d,
        is_recalculated: false,
        sync_batch_at: syncBatchAt,
      });
  }

  // Layer 3: 更新 Current
  await serviceClient
    .from('workspace_threads_accounts')
    .update({
      current_followers_count: insights.followers_count,
      current_profile_views: insights.profile_views,
      current_likes_count_7d: insights.likes_count_7d,
      current_views_count_7d: insights.views_count_7d,
      last_insights_sync_at: now,
      last_sync_batch_at: syncBatchAt,
    })
    .eq('id', accountId);

  return {
    insights,
    has_previous: !!prevSnapshot,
  };
}

