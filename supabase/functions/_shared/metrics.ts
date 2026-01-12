/**
 * 成效計算共用模組
 * 集中管理 rate/score 計算邏輯
 */

// ============================================
// Types
// ============================================

export interface PostMetrics {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  shares: number;
}

export interface CalculatedRates {
  engagementRate: number;
  replyRate: number;
  repostRate: number;
  quoteRate: number;
  viralityScore: number;
}

export type RHatStatus = 'viral' | 'accelerating' | 'stable' | 'decaying' | 'fading' | 'insufficient' | 'emerging' | 'dormant';

export interface RHatResult {
  rHat: number | null;
  status: RHatStatus;
}

// ============================================
// R̂_t Constants
// ============================================

const R_HAT_LOOKBACK = 6;
const R_HAT_DECAY = 0.2;

// ============================================
// Rate Calculation
// ============================================

/**
 * 計算貼文比率指標
 *
 * - engagement_rate: 互動率 = (likes + replies + reposts + quotes) / views * 100
 * - reply_rate: 回覆率 = replies / views * 100
 * - repost_rate: 轉發率 = reposts / views * 100
 * - quote_rate: 引用率 = quotes / views * 100
 * - virality_score: 傳播力（加權）
 */
export function calculateRates(metrics: PostMetrics): CalculatedRates {
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
  // 公式：(replies × 3 + reposts × 2.5 + quotes × 2 + likes) / views × 100
  // 權重依據 Threads 演算法：Replies > Reposts > Likes
  const weightedSum = replies * 3 + reposts * 2.5 + quotes * 2 + likes * 1;
  const viralityScore = (weightedSum / views) * 100;

  return {
    engagementRate: Math.round(engagementRate * 10000) / 10000,
    replyRate: Math.round(replyRate * 10000) / 10000,
    repostRate: Math.round(repostRate * 10000) / 10000,
    quoteRate: Math.round(quoteRate * 10000) / 10000,
    viralityScore: Math.round(viralityScore * 100) / 100,
  };
}

// ============================================
// R̂_t Calculation
// ============================================

/**
 * 計算 R̂_t（即時再生數）
 * R̂_t = ΔReposts_t / Σ_{k=1}^{K} w_k × ΔReposts_{t-k}
 *
 * @param deltaReposts - 時間序列 ΔReposts（從舊到新排序）
 */
export function calculateRHat(deltaReposts: number[]): RHatResult {
  if (deltaReposts.length < R_HAT_LOOKBACK + 1) {
    return { rHat: null, status: 'insufficient' };
  }

  const currentDelta = deltaReposts[deltaReposts.length - 1];

  let denominator = 0;
  for (let k = 1; k <= R_HAT_LOOKBACK; k++) {
    const weight = Math.exp(-R_HAT_DECAY * k);
    const pastDelta = deltaReposts[deltaReposts.length - 1 - k] ?? 0;
    denominator += weight * pastDelta;
  }

  if (denominator === 0) {
    if (currentDelta > 0) {
      return { rHat: null, status: 'emerging' };
    }
    return { rHat: 0, status: 'dormant' };
  }

  const rHat = currentDelta / denominator;
  const status = getRHatStatus(rHat);

  return { rHat: Math.round(rHat * 1000) / 1000, status };
}

function getRHatStatus(rHat: number): RHatStatus {
  if (rHat > 1.5) return 'viral';
  if (rHat > 1.2) return 'accelerating';
  if (rHat >= 0.8) return 'stable';
  if (rHat >= 0.3) return 'decaying';
  return 'fading';
}
