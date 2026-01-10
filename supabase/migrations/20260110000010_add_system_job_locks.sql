-- ============================================
-- Add DB-backed system job locks (anti-overlap)
-- Migration: 00010_add_system_job_locks.sql
-- ============================================

-- DB 層級的簡易 job lock，用於避免排程任務重複執行（多個 scheduler/重疊觸發）。
CREATE TABLE system_job_locks (
  job_type TEXT PRIMARY KEY,
  locked_until TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_job_locks_locked_until ON system_job_locks(locked_until);

-- client 不可直接讀寫
REVOKE ALL ON TABLE system_job_locks FROM anon, authenticated;

-- 防掃描器：啟用 RLS（不提供任何 policy；配合 REVOKE ALL）
ALTER TABLE system_job_locks ENABLE ROW LEVEL SECURITY;

-- 原子化取得鎖：若鎖已過期則更新 locked_until；否則回傳 acquired=false 與目前 locked_until
CREATE OR REPLACE FUNCTION public.acquire_system_job_lock(
  p_job_type TEXT,
  p_ttl_seconds INTEGER
)
RETURNS TABLE (
  acquired BOOLEAN,
  locked_until TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_ts TIMESTAMPTZ := NOW();
  new_until TIMESTAMPTZ := NOW() + make_interval(secs => GREATEST(p_ttl_seconds, 0));
  current_until TIMESTAMPTZ;
BEGIN
  IF p_job_type IS NULL OR length(trim(p_job_type)) = 0 THEN
    acquired := FALSE;
    locked_until := now_ts;
    RETURN NEXT;
    RETURN;
  END IF;

  IF p_ttl_seconds <= 0 THEN
    acquired := FALSE;
    locked_until := now_ts;
    RETURN NEXT;
    RETURN;
  END IF;

  -- 只在鎖不存在或已過期時才成功寫入
  INSERT INTO system_job_locks(job_type, locked_until, updated_at)
  VALUES (p_job_type, new_until, now_ts)
  ON CONFLICT (job_type) DO UPDATE
    SET locked_until = EXCLUDED.locked_until,
        updated_at = now_ts
    WHERE system_job_locks.locked_until <= now_ts
  RETURNING system_job_locks.locked_until INTO current_until;

  IF FOUND THEN
    acquired := TRUE;
    locked_until := current_until;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT system_job_locks.locked_until
    INTO current_until
  FROM system_job_locks
  WHERE system_job_locks.job_type = p_job_type;

  acquired := FALSE;
  locked_until := COALESCE(current_until, now_ts);
  RETURN NEXT;
END;
$$;

-- 釋放鎖：將 locked_until 設為 NOW()（若已無鎖也視為成功）
CREATE OR REPLACE FUNCTION public.release_system_job_lock(
  p_job_type TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_ts TIMESTAMPTZ := NOW();
BEGIN
  IF p_job_type IS NULL OR length(trim(p_job_type)) = 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE system_job_locks
    SET locked_until = now_ts,
        updated_at = now_ts
  WHERE job_type = p_job_type;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.acquire_system_job_lock(TEXT, INTEGER) FROM anon, authenticated;
REVOKE ALL ON FUNCTION public.release_system_job_lock(TEXT) FROM anon, authenticated;

COMMENT ON TABLE system_job_locks IS 'DB-backed locks to prevent scheduled jobs overlapping';
COMMENT ON FUNCTION public.acquire_system_job_lock(TEXT, INTEGER) IS 'Acquire a job lock with TTL (seconds)';
COMMENT ON FUNCTION public.release_system_job_lock(TEXT) IS 'Release a job lock (best-effort)';

