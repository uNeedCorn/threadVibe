-- ============================================================================
-- Migration: Fix r_hat_queue unique constraint for proper upsert
-- Description: Add full unique constraint on workspace_threads_post_id
-- Issue: upsert with onConflict needs a real unique constraint, not partial
-- ============================================================================

-- 1. 清理重複記錄（保留最新的）
-- 刪除同一貼文的舊記錄，只保留最新的 completed/skipped/failed
DELETE FROM r_hat_queue a
USING r_hat_queue b
WHERE a.workspace_threads_post_id = b.workspace_threads_post_id
  AND a.id < b.id
  AND a.status NOT IN ('pending', 'processing');

-- 2. 刪除 completed/skipped 記錄（讓它們可以重新入隊）
-- 這些記錄會在下次同步時重新創建
DELETE FROM r_hat_queue
WHERE status IN ('completed', 'skipped');

-- 3. 刪除 partial unique index（它會與完整唯一約束衝突）
DROP INDEX IF EXISTS idx_r_hat_queue_unique_pending;

-- 4. 添加完整唯一約束（讓 upsert 可以正常工作）
ALTER TABLE r_hat_queue
ADD CONSTRAINT uq_r_hat_queue_post_id UNIQUE (workspace_threads_post_id);

-- 5. 更新註解
COMMENT ON CONSTRAINT uq_r_hat_queue_post_id ON r_hat_queue IS
  '每個貼文只能有一個佇列記錄，upsert 時會更新狀態重新計算';
