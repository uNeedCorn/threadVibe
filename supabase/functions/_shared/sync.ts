/**
 * 共用同步模組
 * 確保手動同步與排程同步使用相同邏輯
 */

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { ThreadsApiClient } from './threads-api.ts';

// ============================================
// Types
// ============================================

export interface SyncPostsResult {
  synced_count: number;
  posts: Array<{ threads_post_id: string; text?: string }>;
}

export interface SyncMetricsResult {
  success_count: number;
  error_count: number;
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

interface Metrics {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
}

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

  const normalizedPosts = posts.map((post) => ({
    workspace_threads_account_id: accountId,
    threads_post_id: post.id,
    text: post.text,
    media_type: post.media_type,
    media_url: post.media_url,
    permalink: post.permalink,
    published_at: post.timestamp
      ? new Date(post.timestamp).toISOString()
      : new Date().toISOString(),
  }));

  if (normalizedPosts.length > 0) {
    const { error } = await serviceClient
      .from('workspace_threads_posts')
      .upsert(normalizedPosts, {
        onConflict: 'workspace_threads_account_id,threads_post_id',
      });

    if (error) throw error;
  }

  return {
    synced_count: normalizedPosts.length,
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
  now: string
): Promise<SyncMetricsResult> {
  // 取得該帳號所有貼文
  const { data: posts } = await serviceClient
    .from('workspace_threads_posts')
    .select('id, threads_post_id')
    .eq('workspace_threads_account_id', accountId);

  if (!posts || posts.length === 0) {
    return { success_count: 0, error_count: 0 };
  }

  let successCount = 0;
  let errorCount = 0;

  for (const post of posts) {
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

      successCount++;
    } catch (error) {
      console.error(`Failed to sync metrics for post ${post.id}:`, error);
      errorCount++;
    }
  }

  return { success_count: successCount, error_count: errorCount };
}

// ============================================
// Sync Account Insights (Three-Layer)
// ============================================

export async function syncAccountInsightsForAccount(
  serviceClient: SupabaseClient,
  accountId: string,
  threadsClient: ThreadsApiClient,
  now: string
): Promise<SyncAccountInsightsResult> {
  // 從 Threads API 取得 Insights
  // 注意：Threads API 使用者層級只支援 views 和 followers_count
  // - followers_count 需要帳號有 100+ 粉絲才會回傳
  // - likes 只在貼文層級可用，使用者層級無此指標
  const apiInsights = await threadsClient.getUserInsights();

  const insights = {
    followers_count: apiInsights.followers_count ?? 0,
    profile_views: 0, // API 不提供此欄位
    likes_count_7d: 0, // Threads API 使用者層級不提供 likes 指標
    views_count_7d: apiInsights.views ?? 0,
  };

  // 取得前一個 Snapshot（用於計算 Delta）
  const { data: prevSnapshot } = await serviceClient
    .from('workspace_threads_account_insights')
    .select('*')
    .eq('workspace_threads_account_id', accountId)
    .order('captured_at', { ascending: false })
    .limit(1)
    .single();

  // Layer 1: 寫入 Snapshot（不可變）
  await serviceClient
    .from('workspace_threads_account_insights')
    .insert({
      workspace_threads_account_id: accountId,
      followers_count: insights.followers_count,
      profile_views: insights.profile_views,
      likes_count_7d: insights.likes_count_7d,
      views_count_7d: insights.views_count_7d,
      captured_at: now,
    });

  // Layer 2: 計算並寫入 Delta
  if (prevSnapshot) {
    await serviceClient
      .from('workspace_threads_account_insights_deltas')
      .insert({
        workspace_threads_account_id: accountId,
        period_start: prevSnapshot.captured_at,
        period_end: now,
        followers_delta: insights.followers_count - prevSnapshot.followers_count,
        profile_views_delta: insights.profile_views - prevSnapshot.profile_views,
        likes_count_7d_delta: insights.likes_count_7d - prevSnapshot.likes_count_7d,
        views_count_7d_delta: insights.views_count_7d - prevSnapshot.views_count_7d,
        is_recalculated: false,
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
    })
    .eq('id', accountId);

  return {
    insights,
    has_previous: !!prevSnapshot,
  };
}

// ============================================
// Helper Functions
// ============================================

function calculateRates(metrics: Metrics) {
  const { views, likes, replies, reposts, quotes, shares } = metrics;

  if (views === 0) {
    return {
      engagementRate: 0,
      replyRate: 0,
      repostRate: 0,
      quoteRate: 0,
      viralityScore: 0,
    };
  }

  // 互動率 = (likes + replies + reposts + quotes) / views * 100
  const engagementRate = ((likes + replies + reposts + quotes) / views) * 100;

  // 回覆率 = replies / views * 100
  const replyRate = (replies / views) * 100;

  // 轉發率 = reposts / views * 100
  const repostRate = (reposts / views) * 100;

  // 引用率 = quotes / views * 100
  const quoteRate = (quotes / views) * 100;

  // 病毒傳播分數（加權）
  const spreadScore = reposts * 3 + quotes * 2.5 + shares * 3;
  const engagementScore = likes + replies * 1.5;
  const viralityScore = ((spreadScore * 2 + engagementScore) / views) * 100;

  return {
    engagementRate: Math.round(engagementRate * 10000) / 10000,
    replyRate: Math.round(replyRate * 10000) / 10000,
    repostRate: Math.round(repostRate * 10000) / 10000,
    quoteRate: Math.round(quoteRate * 10000) / 10000,
    viralityScore: Math.round(viralityScore * 100) / 100,
  };
}
