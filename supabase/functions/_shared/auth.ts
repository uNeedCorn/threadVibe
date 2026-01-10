/**
 * 認證輔助函式
 */

import { SupabaseClient, User } from 'https://esm.sh/@supabase/supabase-js@2';

/**
 * 驗證並取得當前使用者
 */
export async function getAuthenticatedUser(
  supabase: SupabaseClient
): Promise<User | null> {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

/**
 * 驗證使用者是否為 Workspace 成員
 */
export async function validateWorkspaceMembership(
  supabase: SupabaseClient,
  userId: string,
  workspaceId: string,
  requiredRoles?: string[]
): Promise<{ role: string } | null> {
  const query = supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .not('joined_at', 'is', null)
    .single();

  const { data, error } = await query;

  if (error || !data) {
    return null;
  }

  if (requiredRoles && !requiredRoles.includes(data.role)) {
    return null;
  }

  return data;
}

/**
 * 驗證使用者是否為 System Admin
 */
export async function isSystemAdmin(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('system_admins')
    .select('user_id')
    .eq('user_id', userId)
    .single();

  return !error && !!data;
}
