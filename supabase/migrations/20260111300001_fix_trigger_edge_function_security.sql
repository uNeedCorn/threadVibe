-- =============================================================================
-- Migration: Fix trigger_edge_function Security
-- 修復 trigger_edge_function 的安全性問題
-- =============================================================================

-- 1. 撤銷 PUBLIC 的執行權限
REVOKE EXECUTE ON FUNCTION trigger_edge_function(TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION trigger_edge_function(TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION trigger_edge_function(TEXT) FROM authenticated;

-- 2. 只允許 postgres (superuser) 和 service_role 執行
-- pg_cron 以 postgres 身份執行，所以這是必要的
GRANT EXECUTE ON FUNCTION trigger_edge_function(TEXT) TO postgres;
GRANT EXECUTE ON FUNCTION trigger_edge_function(TEXT) TO service_role;

-- 3. 替換函數，增加白名單驗證
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
    'metrics-cleanup'
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

-- 4. 確認權限設定
-- SELECT proname, proacl FROM pg_proc WHERE proname = 'trigger_edge_function';

COMMENT ON FUNCTION trigger_edge_function(TEXT) IS
'安全的 Edge Function 觸發器。只允許 pg_cron (postgres) 和 service_role 執行。
白名單限制可觸發的函數名稱。';
