-- ============================================
-- R̂_t 計算流程監控查詢
-- ============================================

-- 1. 檢查 r_hat_queue 狀態
SELECT
  status,
  COUNT(*) as count,
  MAX(created_at) as latest_created,
  MAX(completed_at) as latest_completed
FROM r_hat_queue
GROUP BY status
ORDER BY status;

-- 2. 查看待處理任務（前 10 筆）
SELECT
  id,
  workspace_threads_post_id,
  status,
  priority,
  attempts,
  created_at,
  error_message
FROM r_hat_queue
WHERE status IN ('pending', 'processing')
ORDER BY priority DESC, created_at
LIMIT 10;

-- 3. 查看最近完成的計算（前 10 筆）
SELECT
  q.id,
  q.workspace_threads_post_id,
  q.calculated_r_hat,
  q.calculated_r_hat_status,
  q.completed_at,
  p.text
FROM r_hat_queue q
JOIN workspace_threads_posts p ON p.id = q.workspace_threads_post_id
WHERE q.status = 'completed'
ORDER BY q.completed_at DESC
LIMIT 10;

-- 4. 查看有 R̂_t 數據的貼文（L3 Current）
SELECT
  id,
  LEFT(text, 50) as text_preview,
  current_r_hat,
  current_r_hat_status,
  current_views,
  current_reposts,
  last_metrics_sync_at
FROM workspace_threads_posts
WHERE current_r_hat IS NOT NULL
ORDER BY last_metrics_sync_at DESC
LIMIT 10;

-- 5. 查看 15m 表的 R̂_t 數據
SELECT
  workspace_threads_post_id,
  r_hat,
  r_hat_status,
  reposts,
  bucket_ts,
  captured_at
FROM workspace_threads_post_metrics_15m
WHERE r_hat IS NOT NULL
ORDER BY captured_at DESC
LIMIT 10;

-- 6. 檢查 Cron Job 狀態
SELECT
  jobid,
  jobname,
  schedule,
  active,
  nodename
FROM cron.job
WHERE jobname LIKE '%r-hat%' OR jobname LIKE '%scheduled%';

-- 7. 檢查最近的 Cron 執行記錄
SELECT
  jobid,
  runid,
  job_pid,
  status,
  return_message,
  start_time,
  end_time
FROM cron.job_run_details
ORDER BY start_time DESC
LIMIT 20;
