-- 建立排程貼文資料表
CREATE TABLE workspace_threads_scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  workspace_threads_account_id UUID NOT NULL REFERENCES workspace_threads_accounts(id) ON DELETE CASCADE,

  -- 貼文內容
  text TEXT,
  media_type TEXT NOT NULL DEFAULT 'TEXT' CHECK (media_type IN ('TEXT', 'IMAGE', 'VIDEO', 'CAROUSEL')),
  media_urls TEXT[], -- 圖片/影片 URL 陣列
  topic_tag TEXT CHECK (topic_tag IS NULL OR (char_length(topic_tag) >= 1 AND char_length(topic_tag) <= 50)),
  link_attachment TEXT,

  -- 排程
  scheduled_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'publishing', 'published', 'failed')),

  -- 發布結果
  threads_post_id TEXT,
  published_at TIMESTAMPTZ,
  error_message TEXT,

  -- 審計
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 加入註解
COMMENT ON TABLE workspace_threads_scheduled_posts IS '排程發布的 Threads 貼文';
COMMENT ON COLUMN workspace_threads_scheduled_posts.media_type IS '貼文類型：TEXT, IMAGE, VIDEO, CAROUSEL';
COMMENT ON COLUMN workspace_threads_scheduled_posts.media_urls IS '媒體 URL 陣列，圖片/影片需可公開存取';
COMMENT ON COLUMN workspace_threads_scheduled_posts.topic_tag IS '主題標籤（不含 #），1-50 字元';
COMMENT ON COLUMN workspace_threads_scheduled_posts.status IS '狀態：draft(草稿), scheduled(已排程), publishing(發布中), published(已發布), failed(失敗)';

-- RLS
ALTER TABLE workspace_threads_scheduled_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view scheduled posts in their workspaces"
ON workspace_threads_scheduled_posts
FOR SELECT
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert scheduled posts in their workspaces"
ON workspace_threads_scheduled_posts
FOR INSERT
WITH CHECK (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'editor')
  )
);

CREATE POLICY "Users can update scheduled posts in their workspaces"
ON workspace_threads_scheduled_posts
FOR UPDATE
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'editor')
  )
);

CREATE POLICY "Users can delete scheduled posts in their workspaces"
ON workspace_threads_scheduled_posts
FOR DELETE
USING (
  workspace_id IN (
    SELECT workspace_id FROM workspace_members
    WHERE user_id = auth.uid()
    AND role IN ('owner', 'editor')
  )
);

-- 索引
CREATE INDEX idx_scheduled_posts_status ON workspace_threads_scheduled_posts(status, scheduled_at);
CREATE INDEX idx_scheduled_posts_account ON workspace_threads_scheduled_posts(workspace_threads_account_id);
CREATE INDEX idx_scheduled_posts_workspace ON workspace_threads_scheduled_posts(workspace_id);

-- updated_at 觸發器
CREATE TRIGGER update_scheduled_posts_updated_at
  BEFORE UPDATE ON workspace_threads_scheduled_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
