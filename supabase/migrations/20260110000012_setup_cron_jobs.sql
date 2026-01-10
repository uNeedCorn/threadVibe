-- =============================================================================
-- Migration: Setup Cron Jobs for Edge Functions
-- Description: 使用 pg_cron + pg_net 定期觸發 Edge Functions
-- =============================================================================

-- 1. 確保擴展已啟用
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. 在 Vault 中儲存 CRON_SECRET（需要手動執行一次）
-- 注意：此 SQL 僅作為範例，實際 secret 應透過 Supabase Dashboard 或 CLI 設定
-- SELECT vault.create_secret('CRON_SECRET', 'your-cron-secret-here');

-- 3. 建立輔助函數：觸發 Edge Function
CREATE OR REPLACE FUNCTION trigger_edge_function(function_name TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  cron_secret TEXT;
  project_url TEXT := 'https://emlclhiaqbkuvztlkfbh.supabase.co';
  request_id BIGINT;
BEGIN
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

-- 4. 建立 Cron 排程任務

-- scheduled-sync: 每 15 分鐘執行（每小時的 00, 15, 30, 45 分）
SELECT cron.schedule(
  'scheduled-sync',
  '0,15,30,45 * * * *',
  $$SELECT trigger_edge_function('scheduled-sync')$$
);

-- token-refresh: 每天 UTC 02:00 執行（台灣時間 10:00）
SELECT cron.schedule(
  'token-refresh',
  '0 2 * * *',
  $$SELECT trigger_edge_function('token-refresh')$$
);

-- token-auto-revoke: 每天 UTC 03:00 執行（台灣時間 11:00）
SELECT cron.schedule(
  'token-auto-revoke',
  '0 3 * * *',
  $$SELECT trigger_edge_function('token-auto-revoke')$$
);

-- workspace-cleanup: 每天 UTC 04:00 執行（台灣時間 12:00）
SELECT cron.schedule(
  'workspace-cleanup',
  '0 4 * * *',
  $$SELECT trigger_edge_function('workspace-cleanup')$$
);

-- 5. 驗證排程已建立
-- SELECT * FROM cron.job;
