-- ============================================
-- Migration: 建立標籤系統資料表
-- ============================================

-- 1. 建立帳號標籤表
CREATE TABLE workspace_threads_account_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_account_id UUID NOT NULL
    REFERENCES workspace_threads_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 同一帳號下標籤名稱不可重複
  UNIQUE (workspace_threads_account_id, name)
);

-- 2. 建立貼文標籤關聯表（多對多）
CREATE TABLE workspace_threads_post_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL
    REFERENCES workspace_threads_posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL
    REFERENCES workspace_threads_account_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 同一貼文不可重複指定相同標籤
  UNIQUE (post_id, tag_id)
);

-- 3. 索引
CREATE INDEX idx_account_tags_account_id
  ON workspace_threads_account_tags(workspace_threads_account_id);
CREATE INDEX idx_post_tags_post_id ON workspace_threads_post_tags(post_id);
CREATE INDEX idx_post_tags_tag_id ON workspace_threads_post_tags(tag_id);

-- ============================================
-- RLS 政策
-- ============================================

-- 4. 啟用 RLS
ALTER TABLE workspace_threads_account_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_threads_post_tags ENABLE ROW LEVEL SECURITY;

-- ============================================
-- workspace_threads_account_tags RLS
-- ============================================

-- 查詢：工作區成員可查詢
CREATE POLICY "Members can view account tags"
  ON workspace_threads_account_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_threads_accounts a
      WHERE a.id = workspace_threads_account_tags.workspace_threads_account_id
        AND is_workspace_member(a.workspace_id)
    )
  );

-- 新增：工作區成員可新增
CREATE POLICY "Members can create account tags"
  ON workspace_threads_account_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_threads_accounts a
      WHERE a.id = workspace_threads_account_id
        AND is_workspace_member(a.workspace_id)
    )
  );

-- 更新：工作區成員可更新
CREATE POLICY "Members can update account tags"
  ON workspace_threads_account_tags FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_threads_accounts a
      WHERE a.id = workspace_threads_account_tags.workspace_threads_account_id
        AND is_workspace_member(a.workspace_id)
    )
  );

-- 刪除：工作區成員可刪除
CREATE POLICY "Members can delete account tags"
  ON workspace_threads_account_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_threads_accounts a
      WHERE a.id = workspace_threads_account_tags.workspace_threads_account_id
        AND is_workspace_member(a.workspace_id)
    )
  );

-- ============================================
-- workspace_threads_post_tags RLS
-- ============================================

-- 查詢：工作區成員可查詢
CREATE POLICY "Members can view post tags"
  ON workspace_threads_post_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_threads_posts p
      JOIN workspace_threads_accounts a ON a.id = p.workspace_threads_account_id
      WHERE p.id = workspace_threads_post_tags.post_id
        AND is_workspace_member(a.workspace_id)
    )
  );

-- 新增：工作區成員可新增
CREATE POLICY "Members can create post tags"
  ON workspace_threads_post_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_threads_posts p
      JOIN workspace_threads_accounts a ON a.id = p.workspace_threads_account_id
      WHERE p.id = post_id
        AND is_workspace_member(a.workspace_id)
    )
  );

-- 刪除：工作區成員可刪除
CREATE POLICY "Members can delete post tags"
  ON workspace_threads_post_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_threads_posts p
      JOIN workspace_threads_accounts a ON a.id = p.workspace_threads_account_id
      WHERE p.id = workspace_threads_post_tags.post_id
        AND is_workspace_member(a.workspace_id)
    )
  );

-- ============================================
-- Trigger: 自動更新 updated_at
-- ============================================

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON workspace_threads_account_tags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
