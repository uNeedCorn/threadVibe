-- ============================================
-- Add Rate Limiting (DB-backed)
-- Migration: 00006_add_rate_limiting.sql
-- ============================================

-- DB 層級的簡易 rate limit counter（由 Edge Functions 使用 service_role 更新）
CREATE TABLE rate_limit_counters (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_rate_limit_reset_at ON rate_limit_counters(reset_at);

-- 避免被 anon/authenticated 直接讀寫
REVOKE ALL ON TABLE rate_limit_counters FROM anon, authenticated;

-- 原子化檢查 + 計數（回傳是否允許、剩餘次數、重置時間）
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  now_ts TIMESTAMPTZ := NOW();
  new_reset TIMESTAMPTZ := NOW() + make_interval(secs => p_window_seconds);
  current_count INTEGER;
  current_reset TIMESTAMPTZ;
BEGIN
  IF p_limit <= 0 OR p_window_seconds <= 0 THEN
    allowed := FALSE;
    remaining := 0;
    reset_at := now_ts;
    RETURN NEXT;
    RETURN;
  END IF;

  LOOP
    SELECT rate_limit_counters.count, rate_limit_counters.reset_at
      INTO current_count, current_reset
    FROM rate_limit_counters
    WHERE rate_limit_counters.key = p_key
    FOR UPDATE;

    IF NOT FOUND THEN
      BEGIN
        INSERT INTO rate_limit_counters(key, count, reset_at)
        VALUES (p_key, 1, new_reset);

        allowed := TRUE;
        remaining := GREATEST(p_limit - 1, 0);
        reset_at := new_reset;
        RETURN NEXT;
        RETURN;
      EXCEPTION WHEN unique_violation THEN
        -- 競爭條件：其他交易剛插入，重試
      END;
    ELSE
      IF current_reset <= now_ts THEN
        UPDATE rate_limit_counters
          SET count = 1,
              reset_at = new_reset,
              updated_at = now_ts
        WHERE key = p_key;

        allowed := TRUE;
        remaining := GREATEST(p_limit - 1, 0);
        reset_at := new_reset;
        RETURN NEXT;
        RETURN;
      END IF;

      IF current_count + 1 > p_limit THEN
        allowed := FALSE;
        remaining := 0;
        reset_at := current_reset;
        RETURN NEXT;
        RETURN;
      END IF;

      UPDATE rate_limit_counters
        SET count = current_count + 1,
            updated_at = now_ts
      WHERE key = p_key;

      allowed := TRUE;
      remaining := GREATEST(p_limit - (current_count + 1), 0);
      reset_at := current_reset;
      RETURN NEXT;
      RETURN;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM anon, authenticated;

COMMENT ON TABLE rate_limit_counters IS 'DB-backed rate limit counters (Edge Functions only)';
COMMENT ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) IS 'Atomic rate limit check for Edge Functions';
