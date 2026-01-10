/**
 * Threads Graph API Client
 * https://developers.facebook.com/docs/threads
 */

const THREADS_API_BASE = 'https://graph.threads.net/v1.0';
const THREADS_USE_AUTH_HEADER = Deno.env.get('THREADS_USE_AUTH_HEADER') === 'true';

async function safeReadJson(response: Response): Promise<unknown | null> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function buildHttpErrorMessage(prefix: string, response: Response): Promise<string> {
  const json = await safeReadJson(response);
  const jsonMessage =
    typeof json === 'object' &&
    json !== null &&
    'error' in json &&
    typeof (json as { error?: { message?: unknown } }).error?.message === 'string'
      ? (json as { error: { message: string } }).error.message
      : null;

  if (jsonMessage) {
    return `${prefix}: ${jsonMessage}`;
  }

  let bodyText: string | null = null;
  try {
    bodyText = await response.text();
  } catch {
    bodyText = null;
  }

  const suffix = bodyText ? ` (${bodyText.slice(0, 200)})` : '';
  return `${prefix}: ${response.status} ${response.statusText}${suffix}`;
}

async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  maxAttempts: number = 3
): Promise<Response> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(input, init);
      if (response.status >= 500 && attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
        continue;
      }
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
        continue;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('Network error');
}

export interface ThreadsUserProfile {
  id: string;
  username: string;
  name?: string;
  threads_profile_picture_url?: string;
  threads_biography?: string;
  is_verified_blue?: boolean;
}

export interface ThreadsUserInsights {
  followers_count?: number;
  views?: number;
  likes?: number;
}

export interface ThreadsPost {
  id: string;
  text?: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  timestamp?: string;
  children?: { data: ThreadsPost[] };
}

export interface ThreadsPostInsights {
  views?: number;
  likes?: number;
  replies?: number;
  reposts?: number;
  quotes?: number;
  shares?: number;
}

/**
 * Threads API Client
 */
export class ThreadsApiClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async request<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${THREADS_API_BASE}${endpoint}`);
    const headers: HeadersInit = {};

    if (THREADS_USE_AUTH_HEADER) {
      headers.Authorization = `Bearer ${this.accessToken}`;
    } else {
      url.searchParams.set('access_token', this.accessToken);
    }

    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const response = await fetchWithRetry(url.toString(), { headers });

    if (!response.ok) {
      throw new Error(await buildHttpErrorMessage('Threads API error', response));
    }

    const json = await safeReadJson(response);
    if (!json) {
      throw new Error('Threads API error: Invalid JSON response');
    }
    return json as T;
  }

  /**
   * 取得使用者 Profile
   */
  async getUserProfile(userId: string = 'me'): Promise<ThreadsUserProfile> {
    return this.request<ThreadsUserProfile>(`/${userId}`, {
      fields: 'id,username,name,threads_profile_picture_url,threads_biography',
    });
  }

  /**
   * 取得使用者 Insights
   */
  async getUserInsights(userId: string = 'me'): Promise<ThreadsUserInsights> {
    const response = await this.request<{ data?: Array<{ name: string; values?: Array<{ value: number }> }> }>(
      `/${userId}/threads_insights`,
      {
        metric: 'followers_count,views,likes',
      }
    );

    const insights: ThreadsUserInsights = {};

    // 防護：確保 response.data 存在且為陣列
    if (!response.data || !Array.isArray(response.data)) {
      console.warn('getUserInsights: No data returned from Threads API');
      return insights;
    }

    for (const metric of response.data) {
      // 防護：確保 metric.values 存在且有值
      const value = metric.values?.[0]?.value;
      if (value === undefined) continue;

      if (metric.name === 'followers_count') {
        insights.followers_count = value;
      } else if (metric.name === 'views') {
        insights.views = value;
      } else if (metric.name === 'likes') {
        insights.likes = value;
      }
    }
    return insights;
  }

  /**
   * 取得使用者貼文列表
   */
  async getUserPosts(userId: string = 'me', limit: number = 25): Promise<ThreadsPost[]> {
    const response = await this.request<{ data: ThreadsPost[] }>(`/${userId}/threads`, {
      fields: 'id,text,media_type,media_url,permalink,timestamp',
      limit: limit.toString(),
    });
    return response.data;
  }

  /**
   * 取得單一貼文 Insights
   */
  async getPostInsights(postId: string): Promise<ThreadsPostInsights> {
    // 注意：Threads API 目前不支援 clicks 指標
    const response = await this.request<{ data: Array<{ name: string; values: Array<{ value: number }> }> }>(
      `/${postId}/insights`,
      {
        metric: 'views,likes,replies,reposts,quotes,shares',
      }
    );

    const insights: ThreadsPostInsights = {};
    for (const metric of response.data) {
      const value = metric.values[0]?.value ?? 0;
      switch (metric.name) {
        case 'views': insights.views = value; break;
        case 'likes': insights.likes = value; break;
        case 'replies': insights.replies = value; break;
        case 'reposts': insights.reposts = value; break;
        case 'quotes': insights.quotes = value; break;
        case 'shares': insights.shares = value; break;
      }
    }
    return insights;
  }

  /**
   * 刷新 Long-Lived Token
   */
  static async refreshLongLivedToken(token: string): Promise<{ access_token: string; expires_in: number }> {
    const url = new URL(`${THREADS_API_BASE}/refresh_access_token`);
    url.searchParams.set('grant_type', 'th_refresh_token');
    url.searchParams.set('access_token', token);

    const response = await fetchWithRetry(url.toString());

    if (!response.ok) {
      throw new Error(await buildHttpErrorMessage('Token refresh failed', response));
    }

    const json = await safeReadJson(response);
    if (!json) {
      throw new Error('Token refresh failed: Invalid JSON response');
    }
    return json as { access_token: string; expires_in: number };
  }

  /**
   * 交換 Short-Lived Token 為 Long-Lived Token
   */
  static async exchangeForLongLivedToken(
    shortLivedToken: string,
    appSecret: string
  ): Promise<{ access_token: string; expires_in: number }> {
    const url = new URL(`${THREADS_API_BASE}/access_token`);
    url.searchParams.set('grant_type', 'th_exchange_token');
    url.searchParams.set('client_secret', appSecret);
    url.searchParams.set('access_token', shortLivedToken);

    const response = await fetchWithRetry(url.toString());

    if (!response.ok) {
      throw new Error(await buildHttpErrorMessage('Token exchange failed', response));
    }

    const json = await safeReadJson(response);
    if (!json) {
      throw new Error('Token exchange failed: Invalid JSON response');
    }
    return json as { access_token: string; expires_in: number };
  }
}
