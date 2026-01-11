/**
 * Insights Radar API - 發文追蹤雷達
 *
 * GET /insights-radar?account_id={workspace_threads_account_id}
 *
 * 回傳 72 小時內貼文的追蹤資料，包含：
 * - 貼文基本資訊
 * - 最新 15 分鐘快照的指標
 * - 趨勢資料（所有 15 分鐘快照）
 * - 計算後的 Virality Score、時間狀態等
 */

import { handleCors } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { getAuthenticatedUser, validateWorkspaceMembership } from '../_shared/auth.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '../_shared/response.ts';
import { isUuid } from '../_shared/validation.ts';
import { calculateRates } from '../_shared/metrics.ts';

// ============ Types ============

type TimeStatus = 'golden' | 'early' | 'tracking';
type ViralityLevel = 'viral' | 'excellent' | 'good' | 'normal';

interface TrendPoint {
  timestamp: number;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  viralityScore: number;
}

interface RadarPost {
  id: string;
  text: string;
  mediaType: string;
  mediaUrl: string | null;
  publishedAt: string;
  ageMinutes: number;
  timeStatus: TimeStatus;
  // Metrics from 15m snapshot
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  // Calculated rates
  viralityScore: number;
  viralityLevel: ViralityLevel;
  engagementRate: number;
  repostRate: number;
  // Trend data
  trend: TrendPoint[];
}

interface RadarSummary {
  totalPosts: number;
  goldenPosts: number;
  earlyPosts: number;
  trackingPosts: number;
  viralPotential: number;
}

interface RadarAlert {
  id: string;
  type: 'viral' | 'excellent';
  postId: string;
  message: string;
}

interface RadarResponse {
  posts: RadarPost[];
  summary: RadarSummary;
  alerts: RadarAlert[];
  generatedAt: string;
}

// ============ Helper Functions ============

function getViralityLevel(score: number): ViralityLevel {
  if (score >= 10) return 'viral';
  if (score >= 5) return 'excellent';
  if (score >= 2) return 'good';
  return 'normal';
}

function getTimeStatus(ageMinutes: number): TimeStatus {
  if (ageMinutes <= 30) return 'golden';
  if (ageMinutes <= 120) return 'early';
  return 'tracking';
}

// ============ Main Handler ============

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // 支援 GET（query params）和 POST（body）
  if (req.method !== 'GET' && req.method !== 'POST') {
    return errorResponse(req, 'Method not allowed', 405);
  }

  try {
    // 解析 account_id：GET 從 query params，POST 從 body
    let accountId: string | null = null;

    if (req.method === 'GET') {
      const url = new URL(req.url);
      accountId = url.searchParams.get('account_id');
    } else {
      try {
        const body = await req.json();
        accountId = body.account_id;
      } catch {
        return errorResponse(req, 'Invalid request body', 400);
      }
    }

    if (!accountId) {
      return errorResponse(req, 'account_id is required', 400);
    }

    if (!isUuid(accountId)) {
      return errorResponse(req, 'Invalid account_id', 400, 'INVALID_ID');
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

    // 取得帳號資訊並驗證權限
    const { data: account, error: accountError } = await serviceClient
      .from('workspace_threads_accounts')
      .select('id, workspace_id')
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

    // 計算時間範圍
    const now = new Date();
    const hours72Ago = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    // 查詢 72 小時內的貼文（排除回覆）
    const { data: postsData, error: postsError } = await serviceClient
      .from('workspace_threads_posts')
      .select('id, text, media_type, media_url, published_at')
      .eq('workspace_threads_account_id', accountId)
      .eq('is_reply', false)
      .gte('published_at', hours72Ago.toISOString())
      .order('published_at', { ascending: false });

    if (postsError) {
      console.error('Failed to fetch posts:', postsError);
      return errorResponse(req, 'Failed to fetch posts', 500);
    }

    const posts = postsData || [];
    const postIds = posts.map((p) => p.id);

    // 查詢 15 分鐘快照資料
    let metricsData: Array<{
      workspace_threads_post_id: string;
      bucket_ts: string;
      views: number;
      likes: number;
      replies: number;
      reposts: number;
      quotes: number;
      shares: number;
    }> = [];

    if (postIds.length > 0) {
      const { data: metrics, error: metricsError } = await serviceClient
        .from('workspace_threads_post_metrics_15m')
        .select('workspace_threads_post_id, bucket_ts, views, likes, replies, reposts, quotes, shares')
        .in('workspace_threads_post_id', postIds)
        .order('bucket_ts', { ascending: true });

      if (metricsError) {
        console.error('Failed to fetch metrics:', metricsError);
        return errorResponse(req, 'Failed to fetch metrics', 500);
      }

      metricsData = metrics || [];
    }

    // 按貼文分組趨勢資料，並記錄最新一筆快照
    const trendByPost: Record<string, TrendPoint[]> = {};
    const latestMetricsByPost: Record<string, {
      views: number;
      likes: number;
      replies: number;
      reposts: number;
      quotes: number;
      shares: number;
    }> = {};

    for (const m of metricsData) {
      const postId = m.workspace_threads_post_id;

      // 計算 Virality Score
      const rates = calculateRates({
        views: m.views,
        likes: m.likes,
        replies: m.replies,
        reposts: m.reposts,
        quotes: m.quotes,
        shares: m.shares,
      });

      // 趨勢資料（包含完整指標供軌跡圖使用）
      if (!trendByPost[postId]) {
        trendByPost[postId] = [];
      }
      trendByPost[postId].push({
        timestamp: new Date(m.bucket_ts).getTime(),
        views: m.views,
        likes: m.likes,
        replies: m.replies,
        reposts: m.reposts,
        viralityScore: rates.viralityScore,
      });

      // 記錄最新一筆
      latestMetricsByPost[postId] = {
        views: m.views,
        likes: m.likes,
        replies: m.replies,
        reposts: m.reposts,
        quotes: m.quotes,
        shares: m.shares,
      };
    }

    // 處理貼文資料
    const radarPosts: RadarPost[] = posts.map((post) => {
      const latest = latestMetricsByPost[post.id];
      const views = latest?.views || 0;
      const likes = latest?.likes || 0;
      const replies = latest?.replies || 0;
      const reposts = latest?.reposts || 0;
      const quotes = latest?.quotes || 0;
      const shares = latest?.shares || 0;

      const publishedAt = new Date(post.published_at);
      const ageMinutes = (now.getTime() - publishedAt.getTime()) / 1000 / 60;

      // 使用共用模組計算指標
      const rates = calculateRates({ views, likes, replies, reposts, quotes, shares });
      const viralityLevel = getViralityLevel(rates.viralityScore);
      const timeStatus = getTimeStatus(ageMinutes);

      return {
        id: post.id,
        text: post.text || '',
        mediaType: post.media_type || 'TEXT',
        mediaUrl: post.media_url,
        publishedAt: post.published_at,
        ageMinutes: Math.round(ageMinutes),
        timeStatus,
        views,
        likes,
        replies,
        reposts,
        quotes,
        viralityScore: rates.viralityScore,
        viralityLevel,
        engagementRate: rates.engagementRate,
        repostRate: rates.repostRate,
        trend: trendByPost[post.id] || [],
      };
    });

    // 計算摘要
    const summary: RadarSummary = {
      totalPosts: radarPosts.length,
      goldenPosts: radarPosts.filter((p) => p.timeStatus === 'golden').length,
      earlyPosts: radarPosts.filter((p) => p.timeStatus === 'early').length,
      trackingPosts: radarPosts.filter((p) => p.timeStatus === 'tracking').length,
      viralPotential: radarPosts.filter((p) => p.viralityScore >= 5).length,
    };

    // 生成提示
    const alerts: RadarAlert[] = [];
    for (const post of radarPosts) {
      const textPreview = post.text.length > 20 ? post.text.slice(0, 20) + '...' : post.text;

      if (post.viralityScore >= 10) {
        alerts.push({
          id: `viral-${post.id}`,
          type: 'viral',
          postId: post.id,
          message: `「${textPreview}」可能正在爆紅中！`,
        });
      } else if (post.timeStatus === 'golden' && post.viralityScore >= 5) {
        alerts.push({
          id: `excellent-${post.id}`,
          type: 'excellent',
          postId: post.id,
          message: `「${textPreview}」表現優異，值得關注`,
        });
      }
    }

    const response: RadarResponse = {
      posts: radarPosts,
      summary,
      alerts,
      generatedAt: now.toISOString(),
    };

    return jsonResponse(req, response);

  } catch (error) {
    console.error('Insights radar error:', error);
    return errorResponse(req, 'Failed to generate radar data', 500);
  }
});
