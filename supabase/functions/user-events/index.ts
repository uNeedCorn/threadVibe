/**
 * User Events - 處理使用者事件通知
 *
 * POST /user-events
 * Body: { event: 'new_user' | 'threads_connected', data: {...} }
 *
 * 需要 service_role 或 authenticated user 驗證
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { notifyNewUser, notifyThreadsConnected, notifyTest } from '../_shared/notification.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // 驗證請求來源（需要 service_role key）
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 解析請求
    const body = await req.json();
    const { event, data } = body;

    if (!event || !data) {
      return new Response(
        JSON.stringify({ error: 'Missing event or data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result;

    switch (event) {
      case 'new_user':
        result = await notifyNewUser({
          email: data.email,
          displayName: data.displayName,
          workspaceName: data.workspaceName,
        });
        break;

      case 'threads_connected':
        result = await notifyThreadsConnected({
          username: data.username,
          followersCount: data.followersCount,
          workspaceId: data.workspaceId,
          isNewConnection: data.isNewConnection ?? true,
        });
        break;

      case 'test':
        result = await notifyTest();
        break;

      default:
        return new Response(
          JSON.stringify({ error: `Unknown event: ${event}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    return new Response(
      JSON.stringify({ success: result.success, error: result.error }),
      { status: result.success ? 200 : 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('User events error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
