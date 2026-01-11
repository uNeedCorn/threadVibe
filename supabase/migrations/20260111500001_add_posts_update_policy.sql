-- ============================================
-- Add UPDATE policy for workspace_threads_posts
-- Allows editors and owners to update post metadata (like ai_selected_tags)
-- ============================================

-- Add UPDATE policy for posts (only for certain fields like ai_selected_tags)
CREATE POLICY "posts_update" ON workspace_threads_posts
FOR UPDATE USING (
  workspace_threads_account_id IN (
    SELECT wta.id FROM workspace_threads_accounts wta
    JOIN workspace_members wm ON wta.workspace_id = wm.workspace_id
    WHERE wm.user_id = auth.uid()
      AND wm.joined_at IS NOT NULL
      AND wm.role IN ('owner', 'editor')
  )
);
