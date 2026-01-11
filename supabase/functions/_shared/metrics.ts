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
