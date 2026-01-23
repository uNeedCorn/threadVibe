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
import { getAuthenticatedUser, validateWorkspaceMembership, isSystemAdmin } from '../_shared/auth.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '../_shared/response.ts';
import { isUuid } from '../_shared/validation.ts';
import { calculateRates, RHatStatus } from '../_shared/metrics.ts';

// ============ Types ============

type TimeStatus = 'golden' | 'early' | 'tracking';
type ViralityLevel = 'viral' | 'excellent' | 'good' | 'normal';
type HeatType = 'early' | 'slow' | 'steady';
type DiffusionStatus = 'accelerating' | 'stable' | 'decelerating';

// 限流風險等級
type ReachRiskLevel = 'safe' | 'warning' | 'danger';
type QuotaLevel = 'healthy' | 'caution' | 'exhausted';

interface TrendPoint {
  timestamp: number;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  viralityScore: number;
}

interface IgnitionDataPoint {
  timestamp: number;
  timeLabel: string;
  engagementPct: number;
  viewsPct: number;
}

interface IgnitionMetrics {
  dataPoints: IgnitionDataPoint[];
  engagementLeadScore: number;
  peakEngagementTime: string;
  peakViewsTime: string;
}

interface HeatmapCell {
  bucketIndex: number;
  viralityDelta: number;
  intensity: number;
}

interface HeatmapMetrics {
  cells: HeatmapCell[];
  heatType: HeatType;
  earlyDelta: number;
  lateDelta: number;
}

interface DiffusionMetrics {
  rHat: number;
  status: DiffusionStatus;
}

interface RadarPost {
  id: string;
  text: string;
  mediaType: string;
  mediaUrl: string | null;
  publishedAt: string;
  ageMinutes: number;
  timeStatus: TimeStatus;
  // Tracking delay info
  trackingDelayMinutes: number; // 首次同步時間 - 發布時間（分鐘）
  hasEarlyData: boolean;        // 是否有早期追蹤資料（trackingDelay < 180 分鐘）
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
  // Advanced metrics
  ignition: IgnitionMetrics | null;
  heatmap: HeatmapMetrics | null;
  diffusion: DiffusionMetrics | null;
  // 限流風險指標
  reachMultiple: number;              // 觸及倍數 = views / followers
  reachRiskLevel: ReachRiskLevel;     // 風險等級
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

// 限流風險指標（帳號層級）
interface ThrottleRisk {
  followersCount: number;           // 當前粉絲數
  threeDayTotalViews: number;       // 3 天累計曝光
  cumulativeMultiple: number;       // 3 天累計倍數
  quotaLevel: QuotaLevel;           // 配額等級
  quotaPercentage: number;          // 配額使用百分比 (0-100+)
}

interface RadarResponse {
  posts: RadarPost[];
  summary: RadarSummary;
  alerts: RadarAlert[];
  throttleRisk: ThrottleRisk;        // 限流風險指標
  generatedAt: string;
}

// ============ Helper Functions ============

/**
 * 判斷傳播力等級
 *
 * 「爆紅中」需要同時滿足：
 * 1. viralityScore >= 10（傳播力達標）
 * 2. diffusionStatus === 'accelerating'（正在擴散中）
 *
 * 如果傳播力高但已停止擴散，則降級為「表現優異」
 */
function getViralityLevel(
  score: number,
  diffusionStatus: DiffusionStatus | null
): ViralityLevel {
  if (score >= 10) {
    // 只有在正在擴散時才標記為「爆紅中」
    if (diffusionStatus === 'accelerating') {
      return 'viral';
    }
    // 傳播力高但已停止擴散，降級為「表現優異」
    return 'excellent';
  }
  if (score >= 5) return 'excellent';
  if (score >= 2) return 'good';
  return 'normal';
}

function getTimeStatus(ageMinutes: number): TimeStatus {
  if (ageMinutes <= 30) return 'golden';
  if (ageMinutes <= 120) return 'early';
  return 'tracking';
}

/**
 * 計算單篇貼文的觸及風險等級
 *
 * 閾值：
 * - safe: < 50x（安全）
 * - warning: 50-100x（接近閾值）
 * - danger: > 100x（高風險，可能觸發限流）
 */
function getReachRiskLevel(reachMultiple: number): ReachRiskLevel {
  if (reachMultiple >= 100) return 'danger';
  if (reachMultiple >= 50) return 'warning';
  return 'safe';
}

/**
 * 計算帳號的配額等級（3 天累計觸及倍數）
 *
 * 閾值：
 * - healthy: < 150x（充裕）
 * - caution: 150-250x（謹慎）
 * - exhausted: > 250x（耗盡，建議冷卻 2-3 天）
 */
function getQuotaLevel(cumulativeMultiple: number): QuotaLevel {
  if (cumulativeMultiple >= 250) return 'exhausted';
  if (cumulativeMultiple >= 150) return 'caution';
  return 'healthy';
}

/**
 * 計算點火曲線指標 - 前 3 小時內 Engagement vs Views 累計比例
 *
 * engagementLeadScore 計算方式：
 * 計算「互動曲線面積 - 曝光曲線面積」的差值
 * 正值表示互動訊號領先曝光增長（早期點火成功）
 * 負值表示曝光領先互動（互動較慢熱）
 */
function calculateIgnitionMetrics(
  trend: TrendPoint[],
  publishedAt: Date
): IgnitionMetrics | null {
  if (trend.length < 2) return null;

  const threeHoursMs = 3 * 60 * 60 * 1000;
  const cutoff = publishedAt.getTime() + threeHoursMs;

  // 過濾 3 小時內的資料點
  const earlyTrend = trend.filter((t) => t.timestamp <= cutoff);
  if (earlyTrend.length < 2) return null;

  // 最終值（用於計算百分比）
  const finalViews = earlyTrend[earlyTrend.length - 1].views || 1;
  const finalEngagement =
    earlyTrend[earlyTrend.length - 1].likes +
    earlyTrend[earlyTrend.length - 1].replies +
    earlyTrend[earlyTrend.length - 1].reposts +
    earlyTrend[earlyTrend.length - 1].quotes || 1;

  let maxEngagementPct = 0;
  let maxViewsPct = 0;
  let peakEngagementTime = '';
  let peakViewsTime = '';

  // 用於計算曲線下面積（AUC）差異
  let engagementAucSum = 0;
  let viewsAucSum = 0;

  const dataPoints: IgnitionDataPoint[] = earlyTrend.map((t) => {
    const minutesSincePublish = Math.round(
      (t.timestamp - publishedAt.getTime()) / 60000
    );
    const timeLabel =
      minutesSincePublish < 60
        ? `${minutesSincePublish}m`
        : `${Math.floor(minutesSincePublish / 60)}h${minutesSincePublish % 60}m`;

    const engagement = t.likes + t.replies + t.reposts + t.quotes;
    const engagementPct = Math.round((engagement / finalEngagement) * 100);
    const viewsPct = Math.round((t.views / finalViews) * 100);

    // 累計 AUC（簡化：直接加總每個時間點的百分比值）
    engagementAucSum += engagementPct;
    viewsAucSum += viewsPct;

    // 追蹤峰值
    if (engagementPct > maxEngagementPct) {
      maxEngagementPct = engagementPct;
      peakEngagementTime = timeLabel;
    }
    if (viewsPct > maxViewsPct) {
      maxViewsPct = viewsPct;
      peakViewsTime = timeLabel;
    }

    return { timestamp: t.timestamp, timeLabel, engagementPct, viewsPct };
  });

  // engagementLeadScore = 互動曲線面積 - 曝光曲線面積（正規化到合理範圍）
  // 正值：互動領先曝光；負值：曝光領先互動
  // 除以資料點數量來正規化，結果約在 -20 ~ +20 範圍
  const engagementLeadScore = Math.round(
    (engagementAucSum - viewsAucSum) / dataPoints.length
  );

  return {
    dataPoints,
    engagementLeadScore,
    peakEngagementTime: peakEngagementTime || 'N/A',
    peakViewsTime: peakViewsTime || 'N/A',
  };
}

/**
 * 計算熱力圖指標 - 前 3 小時每個 15 分鐘 bucket 的 Virality Delta
 * 固定產生 12 個區間（對應 0-15m, 15-30m, ..., 165-180m）
 *
 * 規格：
 * - viralityDelta = (repliesDelta×3 + repostsDelta×2.5 + quotesDelta×2 + likesDelta) / viewsDelta × 100
 * - Heat Type 閾值：1.2
 */
function calculateHeatmapMetrics(
  trend: TrendPoint[],
  publishedAt: Date
): HeatmapMetrics | null {
  if (trend.length < 2) return null;

  const BUCKET_COUNT = 12; // 3 小時 = 12 個 15 分鐘區間
  const BUCKET_MS = 15 * 60 * 1000; // 15 分鐘
  const threeHoursMs = 3 * 60 * 60 * 1000;
  const publishedTime = publishedAt.getTime();

  // 過濾前 3 小時的資料點
  const earlyTrend = trend.filter(
    (t) => t.timestamp <= publishedTime + threeHoursMs
  );

  if (earlyTrend.length < 2) return null;

  // 每個 bucket 的累積指標（取該 bucket 最後一個值）
  interface BucketMetrics {
    views: number;
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
  }

  const bucketMetrics: BucketMetrics[] = new Array(BUCKET_COUNT)
    .fill(null)
    .map(() => ({ views: 0, likes: 0, replies: 0, reposts: 0, quotes: 0 }));

  // 將資料點分配到對應的 bucket
  for (const t of earlyTrend) {
    const ageMs = t.timestamp - publishedTime;
    const bucketIndex = Math.min(
      BUCKET_COUNT - 1,
      Math.max(0, Math.floor(ageMs / BUCKET_MS))
    );
    // 取該 bucket 最後一個值（累積值）
    bucketMetrics[bucketIndex] = {
      views: t.views,
      likes: t.likes,
      replies: t.replies,
      reposts: t.reposts,
      quotes: t.quotes,
    };
  }

  // 填補空值：用前一個 bucket 的值
  for (let i = 1; i < BUCKET_COUNT; i++) {
    if (bucketMetrics[i].views === 0 && bucketMetrics[i - 1].views > 0) {
      bucketMetrics[i] = { ...bucketMetrics[i - 1] };
    }
  }

  // 計算每區間的 Virality Delta
  // 規格：viralityDelta = (repliesDelta×3 + repostsDelta×2.5 + quotesDelta×2 + likesDelta) / viewsDelta × 100
  const cells: HeatmapCell[] = [];
  for (let i = 0; i < BUCKET_COUNT; i++) {
    const curr = bucketMetrics[i];
    const prev = i > 0 ? bucketMetrics[i - 1] : { views: 0, likes: 0, replies: 0, reposts: 0, quotes: 0 };

    const viewsDelta = curr.views - prev.views;
    const likesDelta = curr.likes - prev.likes;
    const repliesDelta = curr.replies - prev.replies;
    const repostsDelta = curr.reposts - prev.reposts;
    const quotesDelta = curr.quotes - prev.quotes;

    // 加權 Delta
    const weightedDelta = repliesDelta * 3 + repostsDelta * 2.5 + quotesDelta * 2 + likesDelta;

    // 計算 Virality Delta（避免除以 0）
    const viralityDelta = viewsDelta > 0 ? (weightedDelta / viewsDelta) * 100 : 0;

    cells.push({
      bucketIndex: i,
      viralityDelta: Math.round(viralityDelta * 100) / 100,
      intensity: 0, // 稍後正規化
    });
  }

  // 計算早期 vs 晚期 delta 來判斷熱度類型
  const midpoint = BUCKET_COUNT / 2; // 6
  const earlyDeltaSum =
    cells.slice(0, midpoint).reduce((sum, c) => sum + c.viralityDelta, 0) / midpoint;
  const lateDeltaSum =
    cells.slice(midpoint).reduce((sum, c) => sum + c.viralityDelta, 0) / midpoint;

  // 規格：閾值 1.2
  let heatType: HeatType = 'steady';
  if (earlyDeltaSum > lateDeltaSum * 1.2) {
    heatType = 'early';
  } else if (lateDeltaSum > earlyDeltaSum * 1.2) {
    heatType = 'slow';
  }

  return {
    cells,
    heatType,
    earlyDelta: Math.round(earlyDeltaSum * 100) / 100,
    lateDelta: Math.round(lateDeltaSum * 100) / 100,
  };
}

const DIFFUSION_STATUS_MAP: Record<RHatStatus, DiffusionStatus | null> = {
  viral: 'accelerating',
  accelerating: 'accelerating',
  stable: 'stable',
  decaying: 'decelerating',
  fading: 'decelerating',
  insufficient: null,
  emerging: 'accelerating',
  dormant: 'decelerating',
};

function mapDiffusionStatus(dbStatus: string | null): DiffusionStatus | null {
  if (!dbStatus) return null;
  return DIFFUSION_STATUS_MAP[dbStatus as RHatStatus] ?? null;
}

/**
 * 從 DB 預計算值建立 DiffusionMetrics
 * 優先使用 r-hat-calculator 預計算的值
 */
function getDiffusionMetrics(
  currentRHat: number | null,
  currentRHatStatus: string | null
): DiffusionMetrics | null {
  const status = mapDiffusionStatus(currentRHatStatus);
  if (status === null || currentRHat === null) return null;

  return {
    rHat: Number(currentRHat),
    status,
  };
}

/**
 * 正規化所有貼文的熱力圖強度
 */
function normalizeHeatmapIntensity(posts: RadarPost[]): void {
  // 找出全域最大 delta
  let maxDelta = 0;
  for (const post of posts) {
    if (post.heatmap) {
      for (const cell of post.heatmap.cells) {
        maxDelta = Math.max(maxDelta, Math.abs(cell.viralityDelta));
      }
    }
  }

  // 正規化
  if (maxDelta > 0) {
    for (const post of posts) {
      if (post.heatmap) {
        for (const cell of post.heatmap.cells) {
          cell.intensity = Math.round((cell.viralityDelta / maxDelta) * 100) / 100;
        }
      }
    }
  }
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

    // 取得帳號資訊並驗證權限（包含粉絲數用於計算限流風險）
    const { data: account, error: accountError } = await serviceClient
      .from('workspace_threads_accounts')
      .select('id, workspace_id, current_followers_count')
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

    // 計算時間範圍
    const now = new Date();
    const hours72Ago = new Date(now.getTime() - 72 * 60 * 60 * 1000);
    const days3Ago = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);

    // 取得粉絲數（用於計算限流風險）
    const followersCount = account.current_followers_count || 0;

    // 查詢 3 天內所有貼文的累計曝光（用於計算配額）
    const { data: threeDayPosts, error: threeDayError } = await serviceClient
      .from('workspace_threads_posts')
      .select('current_views')
      .eq('workspace_threads_account_id', accountId)
      .eq('is_reply', false)
      .neq('media_type', 'REPOST_FACADE')
      .gte('published_at', days3Ago.toISOString());

    if (threeDayError) {
      console.error('Failed to fetch 3-day posts:', threeDayError);
    }

    // 計算 3 天累計曝光
    const threeDayTotalViews = (threeDayPosts || []).reduce(
      (sum, p) => sum + (p.current_views || 0),
      0
    );

    // 計算累計倍數和配額等級
    const cumulativeMultiple = followersCount > 0
      ? Math.round((threeDayTotalViews / followersCount) * 10) / 10
      : 0;
    const quotaLevel = getQuotaLevel(cumulativeMultiple);
    // 配額百分比：以 250x 為 100%
    const quotaPercentage = Math.round((cumulativeMultiple / 250) * 100);

    // 查詢 72 小時內的貼文（排除回覆和轉發），包含預計算的 R̂_t 和首次同步時間
    // 轉發貼文 (REPOST_FACADE) 沒有成效數據，不需要追蹤
    const { data: postsData, error: postsError } = await serviceClient
      .from('workspace_threads_posts')
      .select('id, text, media_type, media_url, published_at, first_synced_at, current_r_hat, current_r_hat_status')
      .eq('workspace_threads_account_id', accountId)
      .eq('is_reply', false)
      .neq('media_type', 'REPOST_FACADE')
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
        quotes: m.quotes,
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

      // 計算追蹤延遲（首次同步時間 - 發布時間）
      const firstSyncedAt = post.first_synced_at ? new Date(post.first_synced_at) : now;
      const trackingDelayMinutes = Math.max(0, Math.round(
        (firstSyncedAt.getTime() - publishedAt.getTime()) / 1000 / 60
      ));
      // 早期追蹤：首次同步距離發布時間小於 3 小時（180 分鐘）
      const hasEarlyData = trackingDelayMinutes < 180;

      // 使用共用模組計算指標
      const rates = calculateRates({ views, likes, replies, reposts, quotes, shares });
      const timeStatus = getTimeStatus(ageMinutes);
      const trend = trendByPost[post.id] || [];

      // 計算進階指標
      const ignition = calculateIgnitionMetrics(trend, publishedAt);
      const heatmap = calculateHeatmapMetrics(trend, publishedAt);
      // 使用 DB 預計算的 R̂_t（由 r-hat-calculator 計算）
      const diffusion = getDiffusionMetrics(post.current_r_hat, post.current_r_hat_status);

      // 傳播力等級（結合擴散動態判斷「爆紅中」）
      const viralityLevel = getViralityLevel(rates.viralityScore, diffusion?.status ?? null);

      // 計算觸及倍數和風險等級
      const reachMultiple = followersCount > 0
        ? Math.round((views / followersCount) * 10) / 10
        : 0;
      const reachRiskLevel = getReachRiskLevel(reachMultiple);

      return {
        id: post.id,
        text: post.text || '',
        mediaType: post.media_type || 'TEXT',
        mediaUrl: post.media_url,
        publishedAt: post.published_at,
        ageMinutes: Math.round(ageMinutes),
        timeStatus,
        trackingDelayMinutes,
        hasEarlyData,
        views,
        likes,
        replies,
        reposts,
        quotes,
        viralityScore: rates.viralityScore,
        viralityLevel,
        engagementRate: rates.engagementRate,
        repostRate: rates.repostRate,
        trend,
        ignition,
        heatmap,
        diffusion,
        reachMultiple,
        reachRiskLevel,
      };
    });

    // 正規化熱力圖強度
    normalizeHeatmapIntensity(radarPosts);

    // 計算摘要
    const summary: RadarSummary = {
      totalPosts: radarPosts.length,
      goldenPosts: radarPosts.filter((p) => p.timeStatus === 'golden').length,
      earlyPosts: radarPosts.filter((p) => p.timeStatus === 'early').length,
      trackingPosts: radarPosts.filter((p) => p.timeStatus === 'tracking').length,
      viralPotential: radarPosts.filter((p) => p.viralityScore >= 5).length,
    };

    // 生成提示
    // 「爆紅中」需要同時滿足：
    // 1. viralityLevel === 'viral'（傳播力高 + 正在擴散）
    // 2. views >= 500（有足夠曝光量）
    const alerts: RadarAlert[] = [];
    for (const post of radarPosts) {
      const textPreview = post.text.length > 20 ? post.text.slice(0, 20) + '...' : post.text;

      // 真正的「爆紅中」：viralityLevel 已包含 diffusion 判斷 + 曝光量門檻
      if (post.viralityLevel === 'viral' && post.views >= 500) {
        alerts.push({
          id: `viral-${post.id}`,
          type: 'viral',
          postId: post.id,
          message: `「${textPreview}」正在爆紅中！`,
        });
      } else if (post.timeStatus === 'golden' && post.viralityLevel === 'excellent' && post.views >= 200) {
        // 黃金期 + 表現優異 + 有一定曝光
        alerts.push({
          id: `excellent-${post.id}`,
          type: 'excellent',
          postId: post.id,
          message: `「${textPreview}」表現優異，值得關注`,
        });
      }
    }

    // 組裝限流風險指標
    const throttleRisk: ThrottleRisk = {
      followersCount,
      threeDayTotalViews,
      cumulativeMultiple,
      quotaLevel,
      quotaPercentage,
    };

    const response: RadarResponse = {
      posts: radarPosts,
      summary,
      alerts,
      throttleRisk,
      generatedAt: now.toISOString(),
    };

    return jsonResponse(req, response);

  } catch (error) {
    console.error('Insights radar error:', error);
    return errorResponse(req, 'Failed to generate radar data', 500);
  }
});
