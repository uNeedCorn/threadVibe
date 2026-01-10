/**
 * Quota Check - 檢查使用者額度
 *
 * GET /quota-check
 * Headers: Authorization: Bearer <user_jwt>
 *
 * 回傳使用者的方案限制與目前使用量
 */

import { handleCors } from '../_shared/cors.ts';
import { createAnonClient, createServiceClient } from '../_shared/supabase.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { checkRateLimit } from '../_shared/rate-limit.ts';
import { jsonResponse, errorResponse, unauthorizedResponse } from '../_shared/response.ts';

interface QuotaLimits {
  max_workspaces: number;
  max_accounts_per_workspace: number;
  max_members_per_workspace: number;
  sync_interval_minutes: number;
  data_retention_days: number;
}

interface QuotaUsage {
  workspaces_owned: number;
  // 其他使用量之後擴充
}

interface QuotaResponse {
  plan_type: string;
  limits: QuotaLimits;
  usage: QuotaUsage;
  can_create_workspace: boolean;
}

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

    const serviceClient = createServiceClient();
    const rateLimit = await checkRateLimit(
      serviceClient,
      `quota_check:${user.id}`,
      60,
      60
    );
    if (!rateLimit.allowed) {
      return errorResponse(req, 'Rate limit exceeded', 429);
    }

    // 取得使用者訂閱方案
    const { data: subscription } = await serviceClient
      .from('user_subscriptions')
      .select('plan_type, limits')
      .eq('user_id', user.id)
      .single();

    // 預設免費方案限制
    const defaultLimits: QuotaLimits = {
      max_workspaces: 1,
      max_accounts_per_workspace: 1,
      max_members_per_workspace: 1,
      sync_interval_minutes: 60,
      data_retention_days: 30,
    };

    const planType = subscription?.plan_type ?? 'free';
    const limits: QuotaLimits = subscription?.limits ?? defaultLimits;

    // 計算目前使用量
    const { count: workspacesOwned } = await serviceClient
      .from('workspace_members')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('role', 'owner');

    const usage: QuotaUsage = {
      workspaces_owned: workspacesOwned ?? 0,
    };

    // 判斷是否可建立新 Workspace
    const canCreateWorkspace = usage.workspaces_owned < limits.max_workspaces;

    const response: QuotaResponse = {
      plan_type: planType,
      limits,
      usage,
      can_create_workspace: canCreateWorkspace,
    };

    return jsonResponse(req, response);

  } catch (error) {
    console.error('Quota check error:', error);
    return errorResponse(req, 'Failed to check quota', 500);
  }
});
