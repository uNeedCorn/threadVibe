-- =============================================================================
-- Migration: Add Rollup Cron Jobs
-- ADR-002: 資料保留與 Rollup 策略
-- =============================================================================

-- hourly-rollup: 每小時 :05 分執行
-- 將 15m 資料 rollup 到 hourly 表
SELECT cron.schedule(
  'hourly-rollup',
  '5 * * * *',
  $$SELECT trigger_edge_function('hourly-rollup')$$
);

-- daily-rollup: 每日 UTC 01:00 執行（台灣時間 09:00）
-- 將 hourly 資料 rollup 到 daily 表
SELECT cron.schedule(
  'daily-rollup',
  '0 1 * * *',
  $$SELECT trigger_edge_function('daily-rollup')$$
);

-- 驗證排程已建立
-- SELECT * FROM cron.job WHERE jobname IN ('hourly-rollup', 'daily-rollup');
