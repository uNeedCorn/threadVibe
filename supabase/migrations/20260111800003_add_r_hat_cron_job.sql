-- ============================================================================
-- Migration: R̂_t Calculator Cron Job
-- Description: 每 5 分鐘觸發 R̂_t 計算
-- ADR: diffusion-model-recommendations.md
-- ============================================================================

-- 1. 建立 cron job
-- 每 5 分鐘執行一次（:00, :05, :10, ...）
SELECT cron.schedule(
  'r-hat-calculator-job',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/r-hat-calculator',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

-- 備註：R̂_t 計算排程，每 5 分鐘處理 r_hat_queue 中的待計算貼文
