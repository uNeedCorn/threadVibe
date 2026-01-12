-- ============================================================================
-- Migration: LLM Usage RPC Functions
-- Description: Admin-only functions to query LLM usage stats
-- ============================================================================

-- 1. 總計統計 RPC（僅限 system_admin）
CREATE OR REPLACE FUNCTION get_llm_usage_stats()
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
  GROUP BY l.model_name, l.purpose
  ORDER BY total_tokens DESC;
END;
$$;

-- 2. 每日統計 RPC（僅限 system_admin）
CREATE OR REPLACE FUNCTION get_llm_daily_usage(days INTEGER DEFAULT 7)
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
    TO_CHAR(l.created_at AT TIME ZONE 'Asia/Taipei', 'YYYY-MM-DD') as date,
    l.model_name,
    COUNT(*)::BIGINT as call_count,
    SUM(l.input_tokens)::BIGINT as total_input_tokens,
    SUM(l.output_tokens)::BIGINT as total_output_tokens,
    SUM(l.total_tokens)::BIGINT as total_tokens
  FROM llm_usage_logs l
  WHERE l.created_at >= NOW() - (days || ' days')::INTERVAL
  GROUP BY date, l.model_name
  ORDER BY date DESC, l.model_name;
END;
$$;

-- 3. 授權
GRANT EXECUTE ON FUNCTION get_llm_usage_stats() TO authenticated;
GRANT EXECUTE ON FUNCTION get_llm_daily_usage(INTEGER) TO authenticated;
