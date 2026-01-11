-- 新增 post_type 相關欄位
-- 用於區分原創貼文、回覆、引用

ALTER TABLE workspace_threads_posts
ADD COLUMN IF NOT EXISTS post_type TEXT DEFAULT 'original',
ADD COLUMN IF NOT EXISTS is_reply BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS replied_to_post_id TEXT,
ADD COLUMN IF NOT EXISTS root_post_id TEXT;

-- 建立索引以加速查詢
CREATE INDEX IF NOT EXISTS idx_workspace_threads_posts_post_type
ON workspace_threads_posts(post_type);

CREATE INDEX IF NOT EXISTS idx_workspace_threads_posts_is_reply
ON workspace_threads_posts(is_reply);

-- 加入欄位註解
COMMENT ON COLUMN workspace_threads_posts.post_type IS '貼文類型: original(原創) | reply(回覆) | quote(引用)';
COMMENT ON COLUMN workspace_threads_posts.is_reply IS '是否為回覆貼文 (來自 Threads API)';
COMMENT ON COLUMN workspace_threads_posts.replied_to_post_id IS '回覆的目標貼文 ID (Threads media_id)';
COMMENT ON COLUMN workspace_threads_posts.root_post_id IS '對話串的根貼文 ID (Threads media_id)';
