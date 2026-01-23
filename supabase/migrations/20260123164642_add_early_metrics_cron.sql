-- =============================================================================
-- Migration: Add Early Metrics Calculator Cron Job
-- 計算貼文早期表現指標：first_hour_views, first_24h_views, peak_hour
-- =============================================================================

-- early-metrics-calculator: 每小時 :10 分執行（在 hourly-rollup 之後）
-- 計算發布後 1 小時、24 小時的曝光數，以及曝光峰值時間
SELECT cron.schedule(
  'early-metrics-calculator',
  '10 * * * *',
  $$SELECT trigger_edge_function('early-metrics-calculator')$$
);

-- 驗證排程已建立
-- SELECT * FROM cron.job WHERE jobname = 'early-metrics-calculator';
