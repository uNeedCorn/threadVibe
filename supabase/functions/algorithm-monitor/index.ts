/**
 * Algorithm Monitor API - 演算法健康監測（管理員專用）
 *
 * GET /algorithm-monitor
 *
 * 回傳：
 * - vfrTrend: 全帳號每日 VFR 趨勢
 * - quotaStatus: 各帳號 Quota 狀態
 * - anomalySignals: 異常偵測信號
 */

import { handleCors } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { getAuthenticatedUser, isSystemAdmin } from '../_shared/auth.ts';
import { jsonResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from '../_shared/response.ts';

// ============ Types ============

type QuotaStatus = 'healthy' | 'caution' | 'warning' | 'throttled';
type AnomalySignal = 'normal' | 'partial_drop' | 'algorithm_change';

interface VfrTrendPoint {
  date: string;
  accountCount: number;
  postCount: number;
  avgVfr: number;
  maxVfr: number;
  medianVfr: number;
}

interface AccountQuotaStatus {
  workspaceName: string;
  username: string;
  followers: number;
  postCount7d: number;
  totalViews7d: number;
  cumulativeVfr7d: number;
  quotaStatus: QuotaStatus;
  quotaPct: number;
}

interface AnomalySignalPoint {
  date: string;
  totalAccounts: number;
  accountsDropped: number;
  avgChangePct: number | null;
  avgVfr: number;
  signal: AnomalySignal;
  signalLabel: string;
}

interface CliffEvent {
  username: string;
  postDate: string;
  vfr: number;
  cumulativeVfrBefore: number;
  accountAvgVfr: number;
  dropRatio: number; // vfr / avgVfr
}

interface ThresholdAnalysis {
  cliffEvents: CliffEvent[];
  estimatedThreshold: number | null;
  thresholdConfidence: 'low' | 'medium' | 'high';
  thresholdRange: { min: number; max: number } | null;
  sampleSize: number;
  analysisNote: string;
}

interface AlgorithmMonitorResponse {
  vfrTrend: VfrTrendPoint[];
  quotaStatus: AccountQuotaStatus[];
  anomalySignals: AnomalySignalPoint[];
  thresholdAnalysis: ThresholdAnalysis;
  generatedAt: string;
}

// ============ Helper Functions ============

function getQuotaStatus(cumulativeVfr: number): QuotaStatus {
  if (cumulativeVfr < 200) return 'healthy';
  if (cumulativeVfr < 500) return 'caution';
  if (cumulativeVfr < 900) return 'warning';
  return 'throttled';
}

function getSignalLabel(signal: AnomalySignal): string {
  switch (signal) {
    case 'algorithm_change':
      return '⚠️ 可能演算法變動';
    case 'partial_drop':
      return '📉 部分帳號下降';
    case 'normal':
      return '✅ 正常';
  }
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

// ============ Main Handler ============

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'GET') {
    return errorResponse(req, 'Method not allowed', 405);
  }

  try {
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

    // 驗證是否為 System Admin
    const isAdmin = await isSystemAdmin(supabase, user.id);
    if (!isAdmin) {
      return forbiddenResponse(req, 'Admin access required');
    }

    const serviceClient = createServiceClient();
    const now = new Date();
    const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const days14Ago = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // ============ 查詢 1: 取得所有活躍帳號 ============
    const { data: accounts, error: accountsError } = await serviceClient
      .from('workspace_threads_accounts')
      .select(`
        id,
        username,
        current_followers_count,
        workspace_id,
        workspaces!inner (
          id,
          name,
          deleted_at
        )
      `)
      .eq('is_active', true)
      .is('workspaces.deleted_at', null);

    if (accountsError) {
      console.error('Failed to fetch accounts:', accountsError);
      return errorResponse(req, 'Failed to fetch accounts', 500);
    }

    // ============ 查詢 2: 取得 30 天內貼文 ============
    const { data: posts, error: postsError } = await serviceClient
      .from('workspace_threads_posts')
      .select(`
        id,
        workspace_threads_account_id,
        published_at,
        current_views
      `)
      .eq('is_reply', false)
      .neq('media_type', 'REPOST_FACADE')
      .gte('published_at', days30Ago.toISOString());

    if (postsError) {
      console.error('Failed to fetch posts:', postsError);
      return errorResponse(req, 'Failed to fetch posts', 500);
    }

    // ============ 查詢 3: 取得 hourly insights (用於匹配發布時粉絲數) ============
    const { data: hourlyInsights, error: hourlyError } = await serviceClient
      .from('workspace_threads_account_insights_hourly')
      .select('workspace_threads_account_id, bucket_ts, followers_count')
      .gte('bucket_ts', days30Ago.toISOString());

    if (hourlyError) {
      console.error('Failed to fetch hourly insights:', hourlyError);
    }

    // ============ 查詢 4: 取得 daily insights (fallback) ============
    const { data: dailyInsights, error: dailyError } = await serviceClient
      .from('workspace_threads_account_insights_daily')
      .select('workspace_threads_account_id, bucket_date, followers_count')
      .gte('bucket_date', formatDate(days30Ago));

    if (dailyError) {
      console.error('Failed to fetch daily insights:', dailyError);
    }

    // ============ 建立查詢索引 ============
    const accountMap = new Map(accounts?.map(a => [a.id, a]) || []);

    // hourly insights 索引: account_id + hour -> followers
    const hourlyMap = new Map<string, number>();
    for (const h of hourlyInsights || []) {
      const key = `${h.workspace_threads_account_id}_${h.bucket_ts}`;
      hourlyMap.set(key, h.followers_count);
    }

    // daily insights 索引: account_id + date -> followers
    const dailyMap = new Map<string, number>();
    for (const d of dailyInsights || []) {
      const key = `${d.workspace_threads_account_id}_${d.bucket_date}`;
      dailyMap.set(key, d.followers_count);
    }

    // ============ 計算每篇貼文的 VFR ============
    interface PostWithVfr {
      accountId: string;
      username: string;
      postId: string;
      publishedAt: Date;
      publishDate: string;
      views: number;
      followers: number;
      vfr: number;
    }

    const postsWithVfr: PostWithVfr[] = [];

    for (const post of posts || []) {
      const account = accountMap.get(post.workspace_threads_account_id);
      if (!account) continue;

      const publishedAt = new Date(post.published_at);
      const publishHour = new Date(publishedAt);
      publishHour.setMinutes(0, 0, 0);
      const publishDate = formatDate(publishedAt);

      // 取得發布時粉絲數
      const hourlyKey = `${post.workspace_threads_account_id}_${publishHour.toISOString()}`;
      const dailyKey = `${post.workspace_threads_account_id}_${publishDate}`;

      const followers =
        hourlyMap.get(hourlyKey) ||
        dailyMap.get(dailyKey) ||
        account.current_followers_count ||
        0;

      const vfr = followers > 0 ? Math.round((post.current_views / followers) * 10) / 10 : 0;

      postsWithVfr.push({
        accountId: post.workspace_threads_account_id,
        username: account.username,
        postId: post.id,
        publishedAt,
        publishDate,
        views: post.current_views,
        followers,
        vfr,
      });
    }

    // ============ 計算 VFR 趨勢 ============
    const vfrByDate = new Map<string, PostWithVfr[]>();
    for (const p of postsWithVfr) {
      const existing = vfrByDate.get(p.publishDate) || [];
      existing.push(p);
      vfrByDate.set(p.publishDate, existing);
    }

    const vfrTrend: VfrTrendPoint[] = [];
    const sortedDates = [...vfrByDate.keys()].sort().reverse().slice(0, 30);

    for (const date of sortedDates) {
      const dayPosts = vfrByDate.get(date) || [];
      const vfrs = dayPosts.map(p => p.vfr);
      const uniqueAccounts = new Set(dayPosts.map(p => p.accountId));

      vfrTrend.push({
        date,
        accountCount: uniqueAccounts.size,
        postCount: dayPosts.length,
        avgVfr: Math.round((vfrs.reduce((a, b) => a + b, 0) / vfrs.length) * 10) / 10 || 0,
        maxVfr: Math.max(...vfrs, 0),
        medianVfr: Math.round(median(vfrs) * 10) / 10,
      });
    }

    // ============ 計算各帳號 Quota 狀態 ============
    const quotaStatus: AccountQuotaStatus[] = [];

    for (const account of accounts || []) {
      const accountPosts = postsWithVfr.filter(p => {
        const postDate = new Date(p.publishDate);
        return p.accountId === account.id && postDate >= days7Ago;
      });

      const totalViews = accountPosts.reduce((sum, p) => sum + p.views, 0);
      const followers = account.current_followers_count || 0;
      const cumulativeVfr = followers > 0 ? Math.round((totalViews / followers) * 10) / 10 : 0;

      // 取得 workspace 名稱
      const workspace = account.workspaces as { name: string } | null;

      quotaStatus.push({
        workspaceName: workspace?.name || 'Unknown',
        username: account.username,
        followers,
        postCount7d: accountPosts.length,
        totalViews7d: totalViews,
        cumulativeVfr7d: cumulativeVfr,
        quotaStatus: getQuotaStatus(cumulativeVfr),
        quotaPct: Math.round((cumulativeVfr / 5) * 10) / 10,
      });
    }

    // 按 VFR 降序排列
    quotaStatus.sort((a, b) => b.cumulativeVfr7d - a.cumulativeVfr7d);

    // ============ 計算異常偵測信號 ============
    // 計算每個帳號每天的 VFR
    const accountDailyVfr = new Map<string, Map<string, number>>();

    for (const p of postsWithVfr) {
      const postDate = new Date(p.publishDate);
      if (postDate < days14Ago) continue;

      const accountVfrs = accountDailyVfr.get(p.accountId) || new Map();
      const existing = accountVfrs.get(p.publishDate) || 0;
      accountVfrs.set(p.publishDate, existing + p.vfr);
      accountDailyVfr.set(p.accountId, accountVfrs);
    }

    // 計算每天的變化率
    const anomalySignals: AnomalySignalPoint[] = [];
    const last14Days = [];
    for (let i = 0; i < 14; i++) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      last14Days.push(formatDate(date));
    }

    for (const date of last14Days) {
      const prevDate = formatDate(new Date(new Date(date).getTime() - 24 * 60 * 60 * 1000));

      let totalAccounts = 0;
      let accountsDropped = 0;
      const changePcts: number[] = [];
      const dayVfrs: number[] = [];

      for (const [accountId, dailyVfrs] of accountDailyVfr) {
        const todayVfr = dailyVfrs.get(date);
        const prevVfr = dailyVfrs.get(prevDate);

        if (todayVfr !== undefined && prevVfr !== undefined && prevVfr > 0) {
          totalAccounts++;
          const changePct = ((todayVfr - prevVfr) / prevVfr) * 100;
          changePcts.push(changePct);
          dayVfrs.push(todayVfr);

          if (changePct < -50) {
            accountsDropped++;
          }
        }
      }

      if (totalAccounts > 0) {
        const avgChangePct = Math.round((changePcts.reduce((a, b) => a + b, 0) / changePcts.length) * 10) / 10;
        const avgVfr = Math.round((dayVfrs.reduce((a, b) => a + b, 0) / dayVfrs.length) * 10) / 10;

        let signal: AnomalySignal = 'normal';
        if (totalAccounts >= 3 && accountsDropped / totalAccounts > 0.5) {
          signal = 'algorithm_change';
        } else if (accountsDropped > 0) {
          signal = 'partial_drop';
        }

        anomalySignals.push({
          date,
          totalAccounts,
          accountsDropped,
          avgChangePct,
          avgVfr,
          signal,
          signalLabel: getSignalLabel(signal),
        });
      }
    }

    // ============ 門檻分析（Cliff Detection）============
    // 1. 計算每個帳號的歷史 VFR 平均與標準差
    const accountStats = new Map<string, { username: string; avgVfr: number; stddevVfr: number; posts: PostWithVfr[] }>();

    for (const account of accounts || []) {
      const accountPosts = postsWithVfr
        .filter(p => p.accountId === account.id && p.vfr > 0)
        .sort((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime());

      if (accountPosts.length < 3) continue; // 需要至少 3 篇貼文才能計算

      const vfrs = accountPosts.map(p => p.vfr);
      const avgVfr = vfrs.reduce((a, b) => a + b, 0) / vfrs.length;
      const variance = vfrs.reduce((sum, v) => sum + Math.pow(v - avgVfr, 2), 0) / vfrs.length;
      const stddevVfr = Math.sqrt(variance);

      accountStats.set(account.id, {
        username: account.username,
        avgVfr: Math.round(avgVfr * 10) / 10,
        stddevVfr: Math.round(stddevVfr * 10) / 10,
        posts: accountPosts,
      });
    }

    // 2. 找出「懸崖事件」：VFR 驟降到平均值的 20% 以下
    const cliffEvents: CliffEvent[] = [];

    for (const [accountId, stats] of accountStats) {
      const { username, avgVfr, posts } = stats;

      if (avgVfr < 0.5) continue; // 跳過平均 VFR 太低的帳號

      for (let i = 0; i < posts.length; i++) {
        const post = posts[i];
        const dropRatio = post.vfr / avgVfr;

        // 條件：VFR 低於平均的 20%，且平均 VFR > 1
        if (dropRatio < 0.2 && avgVfr > 1) {
          // 計算此貼文發布前 7 天的累計 VFR
          const sevenDaysBefore = new Date(post.publishedAt.getTime() - 7 * 24 * 60 * 60 * 1000);
          const postsInWindow = posts.filter(p =>
            p.publishedAt >= sevenDaysBefore &&
            p.publishedAt < post.publishedAt
          );

          const cumulativeViews = postsInWindow.reduce((sum, p) => sum + p.views, 0);
          const followers = post.followers || 1;
          const cumulativeVfrBefore = Math.round((cumulativeViews / followers) * 10) / 10;

          cliffEvents.push({
            username,
            postDate: post.publishDate,
            vfr: post.vfr,
            cumulativeVfrBefore,
            accountAvgVfr: avgVfr,
            dropRatio: Math.round(dropRatio * 100) / 100,
          });
        }
      }
    }

    // 3. 分析門檻
    // 只看有累計 VFR 的事件（排除新帳號或空窗期）
    const validCliffs = cliffEvents.filter(e => e.cumulativeVfrBefore > 10);
    validCliffs.sort((a, b) => a.cumulativeVfrBefore - b.cumulativeVfrBefore);

    let thresholdAnalysis: ThresholdAnalysis;

    if (validCliffs.length >= 3) {
      // 取中位數附近的值作為估計門檻
      const thresholdValues = validCliffs.map(e => e.cumulativeVfrBefore);
      const medianThreshold = median(thresholdValues);
      const minThreshold = Math.min(...thresholdValues);
      const maxThreshold = Math.max(...thresholdValues);

      // 計算置信度
      const range = maxThreshold - minThreshold;
      let confidence: 'low' | 'medium' | 'high' = 'low';
      if (validCliffs.length >= 10 && range < medianThreshold * 0.5) {
        confidence = 'high';
      } else if (validCliffs.length >= 5 && range < medianThreshold) {
        confidence = 'medium';
      }

      thresholdAnalysis = {
        cliffEvents: validCliffs.slice(0, 20), // 最多回傳 20 筆
        estimatedThreshold: Math.round(medianThreshold),
        thresholdConfidence: confidence,
        thresholdRange: {
          min: Math.round(minThreshold),
          max: Math.round(maxThreshold),
        },
        sampleSize: validCliffs.length,
        analysisNote: `基於 ${validCliffs.length} 次懸崖事件分析，推測 7 天累計 VFR 門檻約為 ${Math.round(medianThreshold)}（範圍 ${Math.round(minThreshold)}-${Math.round(maxThreshold)}）`,
      };
    } else {
      thresholdAnalysis = {
        cliffEvents: cliffEvents.slice(0, 20),
        estimatedThreshold: null,
        thresholdConfidence: 'low',
        thresholdRange: null,
        sampleSize: validCliffs.length,
        analysisNote: validCliffs.length === 0
          ? '尚無足夠的懸崖事件可供分析，可能原因：帳號未達門檻、資料不足、或尚未發生限流'
          : `僅有 ${validCliffs.length} 次懸崖事件，樣本不足無法準確估計門檻`,
      };
    }

    // ============ 回傳結果 ============
    const response: AlgorithmMonitorResponse = {
      vfrTrend,
      quotaStatus,
      anomalySignals,
      thresholdAnalysis,
      generatedAt: now.toISOString(),
    };

    return jsonResponse(req, response);

  } catch (error) {
    console.error('Algorithm monitor error:', error);
    return errorResponse(req, 'Failed to generate monitor data', 500);
  }
});
