-- Add content features columns to workspace_threads_posts
-- These columns store extracted features from post content for analysis

-- Local-calculated features (calculated at sync time, no AI needed)
ALTER TABLE workspace_threads_posts
ADD COLUMN IF NOT EXISTS char_count INTEGER,
ADD COLUMN IF NOT EXISTS has_emoji BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS emoji_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS hashtag_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS hashtags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS has_link BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS mention_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS mentions TEXT[] DEFAULT '{}';

-- Add comments for documentation
COMMENT ON COLUMN workspace_threads_posts.char_count IS '貼文字數';
COMMENT ON COLUMN workspace_threads_posts.has_emoji IS '是否包含 emoji';
COMMENT ON COLUMN workspace_threads_posts.emoji_count IS 'emoji 數量';
COMMENT ON COLUMN workspace_threads_posts.hashtag_count IS 'hashtag 數量';
COMMENT ON COLUMN workspace_threads_posts.hashtags IS 'hashtag 清單';
COMMENT ON COLUMN workspace_threads_posts.has_link IS '是否包含連結';
COMMENT ON COLUMN workspace_threads_posts.mention_count IS '@mention 數量';
COMMENT ON COLUMN workspace_threads_posts.mentions IS '@mention 清單';

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_posts_has_emoji ON workspace_threads_posts(workspace_threads_account_id, has_emoji) WHERE has_emoji = true;
CREATE INDEX IF NOT EXISTS idx_posts_has_link ON workspace_threads_posts(workspace_threads_account_id, has_link) WHERE has_link = true;
CREATE INDEX IF NOT EXISTS idx_posts_hashtag_count ON workspace_threads_posts(workspace_threads_account_id, hashtag_count) WHERE hashtag_count > 0;

-- Note: Backfill of existing data is done via Edge Function (backfill-content-features)
-- Run: POST /functions/v1/backfill-content-features with mode: "local_features"
