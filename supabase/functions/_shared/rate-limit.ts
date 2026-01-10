import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset_at: string;
}

export async function checkRateLimit(
  serviceClient: SupabaseClient,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const { data, error } = await serviceClient.rpc('check_rate_limit', {
    p_key: key,
    p_limit: limit,
    p_window_seconds: windowSeconds,
  });

  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;
  return {
    allowed: !!result.allowed,
    remaining: Number(result.remaining ?? 0),
    reset_at: String(result.reset_at),
  };
}

