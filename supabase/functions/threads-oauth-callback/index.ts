/**
 * Threads OAuth Callback - 處理授權回調
 *
 * GET /threads-oauth-callback?code=xxx&state=xxx
 *
 * 處理 Threads OAuth 回調：
 * 1. 驗證 state 簽章
 * 2. 交換 access token
 * 3. 取得使用者 profile
 * 4. 儲存帳號和 token
 * 5. 處理 Token 移轉（如適用）
 * 6. 導回前端
 */

import { createServiceClient } from '../_shared/supabase.ts';
import { encrypt } from '../_shared/crypto.ts';
import { ThreadsApiClient } from '../_shared/threads-api.ts';
import { verifyStateDetailed } from '../_shared/oauth-state.ts';
import { notifyThreadsConnected } from '../_shared/notification.ts';

const THREADS_APP_ID = Deno.env.get('THREADS_APP_ID');
const THREADS_APP_SECRET = Deno.env.get('THREADS_APP_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') ?? 'http://localhost:3000';

function getFrontendSettingsUrl(): URL | null {
  try {
    const base = new URL(FRONTEND_URL);
    return new URL('/settings', base);
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  console.log('[callback] Request received');
  try {
    if (!THREADS_APP_ID || !THREADS_APP_SECRET || !SUPABASE_URL) {
      console.error('Missing required env:', {
        THREADS_APP_ID: !!THREADS_APP_ID,
        THREADS_APP_SECRET: !!THREADS_APP_SECRET,
        SUPABASE_URL: !!SUPABASE_URL,
      });
      return redirectWithError('Configuration error');
    }

    const url = new URL(req.url);
    const code = url.searchParams.get('code');
    const stateParam = url.searchParams.get('state');
    const error = url.searchParams.get('error');
    const errorDescription = url.searchParams.get('error_description');

    console.log('[callback] Params:', { hasCode: !!code, hasState: !!stateParam, error });

    // 處理使用者拒絕授權
    if (error) {
      console.error('OAuth error:', error, errorDescription);
      return redirectWithError(errorDescription ?? error);
    }

    if (!code || !stateParam) {
      return redirectWithError('Missing code or state parameter');
    }

    // 驗證 state 簽章
    let stateData: { workspaceId: string; userId: string; transferId?: string };
    let stateMeta: { exp: number; stateHash: string };
    try {
      const verified = await verifyStateDetailed(stateParam);
      stateData = verified.payload;
      stateMeta = { exp: verified.exp, stateHash: verified.stateHash };
    } catch (stateError) {
      console.error('State verification failed:', stateError);
      return redirectWithError('Invalid authorization state');
    }

    const { workspaceId, userId, transferId } = stateData;
    const { exp, stateHash } = stateMeta!;

    // 先標記 state 為已使用（防止重放；需在交換 token 前執行）
    const supabase = createServiceClient();
    const { error: stateUsageError } = await supabase
      .from('oauth_state_usage')
      .insert({
        state_hash: stateHash,
        workspace_id: workspaceId,
        expires_at: new Date(exp).toISOString(),
      });

    if (stateUsageError) {
      const message = String(stateUsageError.message ?? '');
      const isDuplicate =
        stateUsageError.code === '23505' ||
        message.toLowerCase().includes('duplicate') ||
        message.toLowerCase().includes('already exists');

      if (isDuplicate) {
        console.warn('OAuth state replay detected:', { stateHash, workspaceId });
        return redirectWithError('Authorization session already used');
      }

      console.error('Failed to record oauth_state_usage:', stateUsageError);
      return redirectWithError('Invalid authorization state');
    }

    // 交換 Access Token
    console.log('[callback] Exchanging code for token...');
    const redirectUri = `${SUPABASE_URL}/functions/v1/threads-oauth-callback`;
    const tokenResponse = await fetch('https://graph.threads.net/oauth/access_token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: THREADS_APP_ID,
        client_secret: THREADS_APP_SECRET,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code,
      }),
    });

    console.log('[callback] Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      console.error('Token exchange failed:', errorData);
      return redirectWithError('Failed to exchange authorization code');
    }

    const tokenData = await tokenResponse.json();
    console.log('[callback] Token obtained, expires_in:', tokenData.expires_in);

    // 交換為 Long-Lived Token
    console.log('[callback] Exchanging for long-lived token...');
    let longLivedToken: { access_token: string; expires_in: number };
    try {
      longLivedToken = await ThreadsApiClient.exchangeForLongLivedToken(
        tokenData.access_token,
        THREADS_APP_SECRET
      );
      console.log('[callback] Long-lived token obtained');
    } catch (error) {
      console.error('Long-lived token exchange failed:', error);
      // 如果失敗，使用短期 token
      longLivedToken = tokenData;
    }

    // 取得 Threads User Profile
    console.log('[callback] Fetching user profile...');
    const threadsClient = new ThreadsApiClient(longLivedToken.access_token);
    const profile = await threadsClient.getUserProfile();
    console.log('[callback] Profile obtained:', profile.username);

    // 取得 Threads User Insights（粉絲數等）
    console.log('[callback] Fetching user insights...');
    let insights: { followers_count?: number; views?: number; likes?: number } = {};
    try {
      insights = await threadsClient.getUserInsights();
      console.log('[callback] Insights obtained:', insights);
    } catch (insightsError) {
      console.warn('[callback] Failed to fetch insights:', insightsError);
      // 不阻擋流程，後續可由 sync-account-insights 補同步
    }

    // 儲存到資料庫（使用 service role）

    // 處理 Token 移轉流程
    if (transferId) {
      const transferResult = await handleTokenTransfer(
        supabase,
        transferId,
        userId,
        longLivedToken,
        profile
      );

      if (!transferResult.success) {
        return redirectWithError(transferResult.error ?? 'Transfer failed');
      }

      const successUrl = getFrontendSettingsUrl();
      if (!successUrl) return new Response('Configuration error', { status: 500 });
      successUrl.searchParams.set('success', 'token_transferred');
      successUrl.searchParams.set('account', profile.username);
      return Response.redirect(successUrl.toString(), 302);
    }

    // 標準流程：建立或更新帳號（包含 Insights）
    console.log('[callback] Upserting account for workspace:', workspaceId);
    const { data: account, error: accountError } = await supabase
      .from('workspace_threads_accounts')
      .upsert(
        {
          workspace_id: workspaceId,
          threads_user_id: profile.id,
          username: profile.username,
          name: profile.name,
          biography: profile.threads_biography,
          profile_pic_url: profile.threads_profile_picture_url,
          is_active: true,
          // Layer 3: Current Insights
          current_followers_count: insights.followers_count ?? 0,
          current_likes_count_7d: insights.likes ?? 0,
          current_views_count_7d: insights.views ?? 0,
          last_insights_sync_at: new Date().toISOString(),
        },
        { onConflict: 'workspace_id,threads_user_id' }
      )
      .select()
      .single();

    if (accountError) {
      console.error('Account upsert error:', accountError);
      return redirectWithError('Failed to save Threads account');
    }
    console.log('[callback] Account saved, id:', account.id);

    // Layer 1: 寫入 Insights Snapshot（如果有取得 insights）
    if (insights.followers_count !== undefined) {
      await supabase
        .from('workspace_threads_account_insights')
        .insert({
          workspace_threads_account_id: account.id,
          followers_count: insights.followers_count ?? 0,
          profile_views: 0,
          likes_count_7d: insights.likes ?? 0,
          views_count_7d: insights.views ?? 0,
          captured_at: new Date().toISOString(),
        });
      console.log('[callback] Insights snapshot saved');
    }

    // 將該帳號其他 Token 設為 non-primary
    await supabase
      .from('workspace_threads_tokens')
      .update({ is_primary: false })
      .eq('workspace_threads_account_id', account.id)
      .is('revoked_at', null);

    // 加密並儲存新 Token
    const encryptedAccessToken = await encrypt(longLivedToken.access_token);
    const expiresAt = new Date(Date.now() + longLivedToken.expires_in * 1000);

    const { error: tokenError } = await supabase
      .from('workspace_threads_tokens')
      .insert({
        workspace_threads_account_id: account.id,
        authorized_by_user_id: userId,
        access_token_encrypted: encryptedAccessToken,
        expires_at: expiresAt.toISOString(),
        is_primary: true,
      });

    if (tokenError) {
      console.error('Token insert error:', tokenError);
      return redirectWithError('Failed to save access token');
    }

    // 發送 Telegram 通知（非阻塞）
    notifyThreadsConnected({
      username: profile.username,
      followersCount: insights.followers_count,
      workspaceId,
      isNewConnection: true,
    }).catch((err) => console.warn('[callback] Notification failed:', err));

    // 成功導回 Frontend
    const successUrl = getFrontendSettingsUrl();
    if (!successUrl) return new Response('Configuration error', { status: 500 });
    successUrl.searchParams.set('success', 'threads_connected');
    successUrl.searchParams.set('account', profile.username);
    return Response.redirect(successUrl.toString(), 302);

  } catch (error) {
    console.error('OAuth callback error:', error);
    return redirectWithError('An unexpected error occurred');
  }
});

/**
 * 處理 Token 移轉
 */
async function handleTokenTransfer(
  supabase: ReturnType<typeof createServiceClient>,
  transferId: string,
  userId: string,
  tokenData: { access_token: string; expires_in: number },
  profile: { id: string; username: string }
): Promise<{ success: boolean; error?: string }> {
  // 驗證移轉記錄
  const { data: transfer, error: transferError } = await supabase
    .from('token_transfers')
    .select('*, workspace_threads_accounts!inner(id, workspace_id)')
    .eq('id', transferId)
    .eq('target_user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .single();

  if (transferError || !transfer) {
    return { success: false, error: 'Invalid or expired transfer' };
  }

  const accountId = transfer.workspace_threads_account_id;

  // 撤銷舊 Token
  await supabase
    .from('workspace_threads_tokens')
    .update({
      is_primary: false,
      revoked_at: new Date().toISOString(),
    })
    .eq('workspace_threads_account_id', accountId)
    .is('revoked_at', null);

  // 加密並儲存新 Token
  const encryptedAccessToken = await encrypt(tokenData.access_token);
  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000);

  const { error: tokenError } = await supabase
    .from('workspace_threads_tokens')
    .insert({
      workspace_threads_account_id: accountId,
      authorized_by_user_id: userId,
      access_token_encrypted: encryptedAccessToken,
      expires_at: expiresAt.toISOString(),
      is_primary: true,
    });

  if (tokenError) {
    return { success: false, error: 'Failed to save new token' };
  }

  // 刪除移轉記錄
  await supabase
    .from('token_transfers')
    .delete()
    .eq('id', transferId);

  return { success: true };
}

function redirectWithError(message: string): Response {
  const errorUrl = getFrontendSettingsUrl();
  if (!errorUrl) return new Response('Configuration error', { status: 500 });
  errorUrl.searchParams.set('error', 'threads_auth_failed');
  errorUrl.searchParams.set('message', message);
  return Response.redirect(errorUrl.toString(), 302);
}
