-- Update get_admin_user_overview function to include last_active_at tracking
-- Returns user overview data for admin dashboard with activity information

DROP FUNCTION IF EXISTS get_admin_user_overview();

CREATE OR REPLACE FUNCTION get_admin_user_overview()
RETURNS TABLE (
  user_id uuid,
  email text,
  registered_at timestamptz,
  last_sign_in_at timestamptz,
  last_active_at timestamptz,
  days_since_login integer,
  days_since_active integer,
  workspace_id uuid,
  workspace_name text,
  workspace_role text,
  threads_account_id uuid,
  threads_username text,
  threads_name text,
  followers_count integer,
  threads_connected boolean,
  last_sync_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if the caller is an admin
  IF NOT EXISTS (
    SELECT 1 FROM system_admins WHERE system_admins.user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: Admin privileges required';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::text,
    u.created_at AS registered_at,
    u.last_sign_in_at,
    p.last_active_at,
    EXTRACT(DAY FROM (now() - u.last_sign_in_at))::integer AS days_since_login,
    EXTRACT(DAY FROM (now() - p.last_active_at))::integer AS days_since_active,
    w.id AS workspace_id,
    w.name AS workspace_name,
    wm.role AS workspace_role,
    wta.id AS threads_account_id,
    wta.username AS threads_username,
    wta.name AS threads_name,
    wta.followers_count::integer,
    (wta.id IS NOT NULL) AS threads_connected,
    wta.last_sync_at
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  LEFT JOIN workspace_members wm ON wm.user_id = u.id
  LEFT JOIN workspaces w ON w.id = wm.workspace_id
  LEFT JOIN workspace_threads_accounts wta ON wta.workspace_id = w.id
  ORDER BY u.created_at DESC;
END;
$$;

-- Grant execute permission to authenticated users (admin check is inside function)
GRANT EXECUTE ON FUNCTION get_admin_user_overview() TO authenticated;

COMMENT ON FUNCTION get_admin_user_overview() IS 'Returns user overview for admin dashboard including workspace and Threads account associations';
