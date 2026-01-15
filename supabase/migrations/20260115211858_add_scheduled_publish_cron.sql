-- =============================================================================
-- Migration: Add Scheduled Publish Cron Job
-- Description: 每分鐘檢查並發布到期的排程貼文
-- =============================================================================

-- scheduled-publish: 每分鐘執行
SELECT cron.schedule(
  'scheduled-publish',
  '* * * * *',
  $$SELECT trigger_edge_function('scheduled-publish')$$
);

-- 驗證排程已建立
-- SELECT * FROM cron.job WHERE jobname = 'scheduled-publish';
