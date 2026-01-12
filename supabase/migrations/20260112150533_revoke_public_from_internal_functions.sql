-- ============================================================================
-- Migration: Revoke PUBLIC from internal functions
-- Description: 移除 PUBLIC 對內部函數的 EXECUTE 權限（僅 service_role 可用）
-- ============================================================================

-- 這些函數只應由 Edge Functions (service_role) 呼叫
REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.acquire_system_job_lock(TEXT, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_system_job_lock(TEXT) FROM PUBLIC;
