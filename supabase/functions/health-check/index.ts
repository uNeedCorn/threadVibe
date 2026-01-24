/**
 * Health Check - Threads 健康檢測器
 *
 * POST /health-check
 * Headers: Authorization: Bearer <user_jwt>
 *
 * 根據使用者輸入的粉絲數和貼文曝光數，計算觸及倍數並判斷帳號健康狀態
 */

import { handleCors } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.ts';

// 閾值常數（不暴露給前端）
const THRESHOLD_WARNING = 200;
const THRESHOLD_DANGER = 400;

// Rate Limit 設定
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW = 86400; // 24 hours in seconds

type HealthStatus = 'normal' | 'warning' | 'danger';

interface PostInput {
  views: number;
}

interface RequestBody {
  followers: number;
  posts: PostInput[];
}

interface StatusResult {
  value: number;
  status: HealthStatus;
  label: string;
}

interface HealthCheckResult {
  cumulative: StatusResult;
  max: StatusResult;
  latest: StatusResult;
  inCooldown: boolean;
  conclusion: string;
  recommendations: string[];
}

interface HealthCheckResponse {
  success: boolean;
  result: HealthCheckResult;
  rateLimit: {
    remaining: number;
    resetAt: string;
  };
}

function getStatusLabel(status: HealthStatus): string {
  switch (status) {
    case 'normal': return '正常';
    case 'warning': return '警戒';
    case 'danger': return '爆發/危險';
  }
}

function calculateStatus(vfr: number): HealthStatus {
  if (vfr >= THRESHOLD_DANGER) return 'danger';
  if (vfr >= THRESHOLD_WARNING) return 'warning';
  return 'normal';
}

function generateConclusion(result: HealthCheckResult): string {
  const { max, latest, inCooldown } = result;

  if (inCooldown) {
    return '你的帳號可能正處於冷卻期。過去有爆發表現，但最近觸及較低，這是正常的演算法調整。';
  }

  if (max.status === 'danger' && latest.status === 'danger') {
    return '你的帳號目前觸及非常高，建議適度降低發文頻率以避免被演算法標記。';
  }

  if (max.status === 'danger') {
    return '你曾經有爆發表現，目前觸及正常。繼續維持穩定的內容策略。';
  }

  if (max.status === 'warning') {
    return '你的帳號觸及表現良好，處於活躍狀態。';
  }

  return '你的帳號觸及表現正常，可以繼續發文。';
}

function generateRecommendations(result: HealthCheckResult): string[] {
  const { max, latest, inCooldown } = result;
  const recommendations: string[] = [];

  if (inCooldown) {
    recommendations.push('減少發文頻率，讓帳號休息 2-3 天');
    recommendations.push('發布高品質內容而非頻繁發文');
    recommendations.push('避免短時間內連續發文');
  } else if (latest.status === 'danger') {
    recommendations.push('減少發文頻率，每天最多 2-3 篇');
    recommendations.push('避免在高互動後立即發布新內容');
    recommendations.push('觀察 24-48 小時後再評估');
  } else if (max.status === 'danger' || max.status === 'warning') {
    recommendations.push('維持目前的發文節奏');
    recommendations.push('持續產出高品質內容');
  } else {
    recommendations.push('可以嘗試增加發文頻率');
    recommendations.push('測試不同類型的內容形式');
    recommendations.push('關注粉絲互動最高的時段');
  }

  return recommendations;
}

function validateInput(body: RequestBody): string | null {
  if (!body.followers || typeof body.followers !== 'number') {
    return '請提供有效的粉絲數';
  }
  if (body.followers < 1 || body.followers > 100000000) {
    return '粉絲數必須在 1 到 1 億之間';
  }
  if (!Array.isArray(body.posts) || body.posts.length === 0) {
    return '請提供至少一篇貼文的曝光數';
  }
  if (body.posts.length > 20) {
    return '最多只能輸入 20 篇貼文';
  }
  for (const post of body.posts) {
    if (typeof post.views !== 'number' || post.views < 0 || post.views > 1000000000) {
      return '曝光數必須在 0 到 10 億之間';
    }
  }
  return null;
}

Deno.serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  if (req.method !== 'POST') {
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

    const serviceClient = createServiceClient();

    // 檢查 Rate Limit
    const rateLimit = await checkRateLimit(
      serviceClient,
      `health-check:${user.id}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW
    );

    if (!rateLimit.allowed) {
      return jsonResponse(req, {
        success: false,
        error: '今日檢測次數已用完',
        code: 'RATE_LIMITED',
        rateLimit: {
          remaining: rateLimit.remaining,
          resetAt: rateLimit.reset_at,
        },
      }, 429);
    }

    // 解析並驗證請求
    const body: RequestBody = await req.json();
    const validationError = validateInput(body);
    if (validationError) {
      return errorResponse(req, validationError, 400);
    }

    const { followers, posts } = body;

    // 計算觸及倍數
    const postVfrs = posts.map(p => Math.round(p.views / followers));
    const totalViews = posts.reduce((sum, p) => sum + p.views, 0);
    const cumulativeVfr = Math.round(totalViews / followers);
    const maxVfr = Math.max(...postVfrs);
    const latestVfr = postVfrs[0]; // 假設第一篇是最新的

    // 判斷狀態
    const cumulativeStatus = calculateStatus(cumulativeVfr);
    const maxStatus = calculateStatus(maxVfr);
    const latestStatus = calculateStatus(latestVfr);

    // 判斷冷卻期：有爆發但最近偏低
    const inCooldown = maxStatus === 'danger' && latestStatus === 'normal' && latestVfr < 50;

    // 組裝結果
    const result: HealthCheckResult = {
      cumulative: {
        value: cumulativeVfr,
        status: cumulativeStatus,
        label: getStatusLabel(cumulativeStatus),
      },
      max: {
        value: maxVfr,
        status: maxStatus,
        label: getStatusLabel(maxStatus),
      },
      latest: {
        value: latestVfr,
        status: latestStatus,
        label: getStatusLabel(latestStatus),
      },
      inCooldown,
      conclusion: '',
      recommendations: [],
    };

    result.conclusion = generateConclusion(result);
    result.recommendations = generateRecommendations(result);

    // 儲存記錄
    await serviceClient.from('health_check_submissions').insert({
      user_id: user.id,
      followers,
      post_count: posts.length,
      total_views: totalViews,
      cumulative_vfr: cumulativeVfr,
      cumulative_status: cumulativeStatus,
      max_vfr: maxVfr,
      max_status: maxStatus,
      latest_vfr: latestVfr,
      latest_status: latestStatus,
      in_cooldown: inCooldown,
    });

    const response: HealthCheckResponse = {
      success: true,
      result,
      rateLimit: {
        remaining: rateLimit.remaining,
        resetAt: rateLimit.reset_at,
      },
    };

    return jsonResponse(req, response);

  } catch (error) {
    console.error('Health check error:', error);
    return errorResponse(req, 'Failed to perform health check', 500);
  }
});
