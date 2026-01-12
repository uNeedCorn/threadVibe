-- ============================================================================
-- Migration: Fix SECURITY DEFINER Functions Search Path
-- Description: 為缺少 search_path 的 SECURITY DEFINER 函數添加設定
-- ============================================================================

-- 1. 修復 create_default_workspace
CREATE OR REPLACE FUNCTION public.create_default_workspace()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_workspace_id UUID;
  display_name TEXT;
BEGIN
  -- 取得用戶顯示名稱（優先順序：name > full_name > email 前綴）
  display_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    NEW.raw_user_meta_data->>'full_name',
    split_part(NEW.email, '@', 1)
  );

  -- 建立預設 Workspace
  INSERT INTO public.workspaces (name, created_by_user_id)
  VALUES (display_name || ' 的工作區', NEW.id)
  RETURNING id INTO new_workspace_id;

  -- 建立 Owner 成員關係
  INSERT INTO public.workspace_members (workspace_id, user_id, role, joined_at)
  VALUES (new_workspace_id, NEW.id, 'owner', NOW());

  -- 建立預設訂閱方案（Free）
  INSERT INTO public.user_subscriptions (user_id, plan_type)
  VALUES (NEW.id, 'free');

  RETURN NEW;
END;
$$;

-- 2. 修復 get_llm_usage_stats
CREATE OR REPLACE FUNCTION get_llm_usage_stats(
  start_date TIMESTAMPTZ DEFAULT NULL,
  end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  model_name TEXT,
  purpose TEXT,
  call_count BIGINT,
  total_input_tokens BIGINT,
  total_output_tokens BIGINT,
  total_tokens BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 檢查是否為系統管理員
  IF NOT EXISTS (
    SELECT 1 FROM system_admins WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    l.model_name,
    l.purpose,
    COUNT(*)::BIGINT as call_count,
    SUM(l.input_tokens)::BIGINT as total_input_tokens,
    SUM(l.output_tokens)::BIGINT as total_output_tokens,
    SUM(l.total_tokens)::BIGINT as total_tokens
  FROM llm_usage_logs l
  WHERE (start_date IS NULL OR l.created_at >= start_date)
    AND (end_date IS NULL OR l.created_at <= end_date)
  GROUP BY l.model_name, l.purpose
  ORDER BY total_tokens DESC;
END;
$$;

-- 3. 修復 get_llm_daily_usage
CREATE OR REPLACE FUNCTION get_llm_daily_usage(
  start_date TIMESTAMPTZ DEFAULT NULL,
  end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  date TEXT,
  model_name TEXT,
  call_count BIGINT,
  total_input_tokens BIGINT,
  total_output_tokens BIGINT,
  total_tokens BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  effective_start TIMESTAMPTZ;
  effective_end TIMESTAMPTZ;
BEGIN
  -- 檢查是否為系統管理員
  IF NOT EXISTS (
    SELECT 1 FROM system_admins WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  -- 預設最近 7 天
  effective_start := COALESCE(start_date, NOW() - INTERVAL '7 days');
  effective_end := COALESCE(end_date, NOW());

  RETURN QUERY
  SELECT
    TO_CHAR(l.created_at AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD') as date,
    l.model_name,
    COUNT(*)::BIGINT as call_count,
    SUM(l.input_tokens)::BIGINT as total_input_tokens,
    SUM(l.output_tokens)::BIGINT as total_output_tokens,
    SUM(l.total_tokens)::BIGINT as total_tokens
  FROM llm_usage_logs l
  WHERE l.created_at >= effective_start
    AND l.created_at <= effective_end
  GROUP BY date, l.model_name
  ORDER BY date DESC, l.model_name;
END;
$$;

-- 4. 修復 get_llm_usage_by_workspace
CREATE OR REPLACE FUNCTION get_llm_usage_by_workspace(
  start_date TIMESTAMPTZ DEFAULT NULL,
  end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  workspace_id UUID,
  workspace_name TEXT,
  account_id UUID,
  account_username TEXT,
  model_name TEXT,
  purpose TEXT,
  call_count BIGINT,
  total_input_tokens BIGINT,
  total_output_tokens BIGINT,
  total_tokens BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 檢查是否為系統管理員
  IF NOT EXISTS (
    SELECT 1 FROM system_admins WHERE user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  RETURN QUERY
  SELECT
    l.workspace_id,
    w.name as workspace_name,
    l.workspace_threads_account_id as account_id,
    wta.username as account_username,
    l.model_name,
    l.purpose,
    COUNT(*)::BIGINT as call_count,
    SUM(l.input_tokens)::BIGINT as total_input_tokens,
    SUM(l.output_tokens)::BIGINT as total_output_tokens,
    SUM(l.total_tokens)::BIGINT as total_tokens
  FROM llm_usage_logs l
  LEFT JOIN workspaces w ON l.workspace_id = w.id
  LEFT JOIN workspace_threads_accounts wta ON l.workspace_threads_account_id = wta.id
  WHERE (start_date IS NULL OR l.created_at >= start_date)
    AND (end_date IS NULL OR l.created_at <= end_date)
  GROUP BY l.workspace_id, w.name, l.workspace_threads_account_id, wta.username, l.model_name, l.purpose
  ORDER BY total_tokens DESC;
END;
$$;
