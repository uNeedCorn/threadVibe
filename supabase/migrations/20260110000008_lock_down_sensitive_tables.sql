-- ============================================
-- Lock down sensitive tables from client access
-- Migration: 00008_lock_down_sensitive_tables.sql
-- ============================================

-- workspace_threads_tokens:
-- - token 密文不應由 client 直接讀取/寫入
-- - 任何 token 相關行為（狀態查詢、解除連結、移轉）改由 Edge Functions（service_role）封裝
REVOKE ALL ON TABLE workspace_threads_tokens FROM anon, authenticated;

-- token_transfers:
-- - 避免 client 直接建立/修改移轉紀錄
REVOKE ALL ON TABLE token_transfers FROM anon, authenticated;

-- 封存舊的 client-side INSERT policy（若存在）
DROP POLICY IF EXISTS "tokens_insert" ON workspace_threads_tokens;

