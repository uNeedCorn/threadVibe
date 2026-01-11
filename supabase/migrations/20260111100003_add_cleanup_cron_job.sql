-- =============================================================================
-- Migration: Add Metrics Cleanup Cron Job
-- ADR-002: 資料保留與 Rollup 策略
-- =============================================================================

-- metrics-cleanup: 每日 UTC 05:00 執行（台灣時間 13:00）
-- 清除過期的分層資料
SELECT cron.schedule(
  'metrics-cleanup',
  '0 5 * * *',
  $$SELECT trigger_edge_function('metrics-cleanup')$$
);

-- 驗證排程已建立
-- SELECT * FROM cron.job WHERE jobname = 'metrics-cleanup';
