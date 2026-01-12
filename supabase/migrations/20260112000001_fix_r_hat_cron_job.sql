-- ============================================================================
-- Migration: Fix R̂_t Calculator Cron Job
-- Description: 修復 r-hat-calculator cron job，使用 trigger_edge_function
-- ============================================================================

-- 1. 更新 trigger_edge_function 白名單，加入 r-hat-calculator
CREATE OR REPLACE FUNCTION trigger_edge_function(function_name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  cron_secret TEXT;
  project_url TEXT := 'https://emlclhiaqbkuvztlkfbh.supabase.co';
  request_id BIGINT;
  allowed_functions TEXT[] := ARRAY[
    'scheduled-sync',
    'token-refresh',
    'token-auto-revoke',
    'workspace-cleanup',
    'hourly-rollup',
    'daily-rollup',
    'metrics-cleanup',
    'ai-tagging',
    'r-hat-calculator'
  ];
BEGIN
  -- 驗證 function_name 在白名單中
  IF NOT (function_name = ANY(allowed_functions)) THEN
    RAISE EXCEPTION 'Function "%" is not in the allowed list', function_name;
  END IF;

  -- 驗證 function_name 不包含危險字元
  IF function_name ~ '[^a-z0-9\-]' THEN
    RAISE EXCEPTION 'Invalid function name: %', function_name;
  END IF;

  -- 從 Vault 取得 CRON_SECRET
  SELECT decrypted_secret INTO cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'CRON_SECRET'
  LIMIT 1;

  IF cron_secret IS NULL THEN
    RAISE WARNING 'CRON_SECRET not found in vault, skipping %', function_name;
    RETURN;
  END IF;

  -- 發送 HTTP POST 請求到 Edge Function
  SELECT net.http_post(
    url := project_url || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || cron_secret,
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  ) INTO request_id;

  RAISE NOTICE 'Triggered % with request_id: %', function_name, request_id;
END;
$$;

-- 2. 移除舊的 cron job
SELECT cron.unschedule('r-hat-calculator-job');

-- 3. 建立新的 cron job（使用 trigger_edge_function）
SELECT cron.schedule(
  'r-hat-calculator-job',
  '*/5 * * * *',
  $$SELECT trigger_edge_function('r-hat-calculator')$$
);

COMMENT ON FUNCTION trigger_edge_function(TEXT) IS
'安全的 Edge Function 觸發器。只允許 pg_cron (postgres) 和 service_role 執行。
白名單限制可觸發的函數名稱：scheduled-sync, token-refresh, token-auto-revoke,
workspace-cleanup, hourly-rollup, daily-rollup, metrics-cleanup, ai-tagging, r-hat-calculator';
