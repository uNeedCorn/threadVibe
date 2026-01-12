/**
 * Supabase Client 工廠
 */

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

function getRequiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new Error(`${name} not configured`);
  }
  return value;
}

/**
 * 建立 Supabase Anon Client（用於驗證 JWT）
 * 優先使用 LEGACY_ANON_KEY 來繞過 Supabase 新 key 格式的 bug
 */
export function createAnonClient(authHeader: string): SupabaseClient {
  // 優先使用 Legacy key（JWT 格式），因為 Edge Functions 目前只支援 JWT 驗證
  const legacyKey = Deno.env.get('LEGACY_ANON_KEY');
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY');

  const anonKey = legacyKey || supabaseKey;
  if (!anonKey) {
    throw new Error('LEGACY_ANON_KEY or SUPABASE_ANON_KEY not configured');
  }

  return createClient(
    getRequiredEnv('SUPABASE_URL'),
    anonKey,
    {
      global: {
        headers: { Authorization: authHeader },
      },
    }
  );
}

/**
 * 建立 Supabase Service Role Client（用於繞過 RLS）
 * 僅在驗證使用者後使用
 */
export function createServiceClient(): SupabaseClient {
  return createClient(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
