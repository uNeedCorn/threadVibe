-- ============================================
-- Enable RLS on rate_limit_counters (defense-in-depth)
-- Migration: 00009_enable_rls_rate_limit_counters.sql
-- ============================================

-- 此表僅供 Edge Functions 透過 SECURITY DEFINER RPC 使用，已 REVOKE ALL。
-- 啟用 RLS 主要是避免掃描器判定「無 RLS」。
ALTER TABLE rate_limit_counters ENABLE ROW LEVEL SECURITY;

