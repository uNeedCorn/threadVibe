-- Add early performance and engagement quality columns to workspace_threads_posts

-- Early performance fields (calculated after specific time thresholds)
ALTER TABLE workspace_threads_posts
ADD COLUMN IF NOT EXISTS first_hour_views INTEGER,
ADD COLUMN IF NOT EXISTS first_24h_views INTEGER,
ADD COLUMN IF NOT EXISTS peak_hour INTEGER;

-- Engagement quality fields (calculated during metrics sync)
ALTER TABLE workspace_threads_posts
ADD COLUMN IF NOT EXISTS discussion_depth NUMERIC,
ADD COLUMN IF NOT EXISTS share_willingness NUMERIC;

-- Add comments for documentation
COMMENT ON COLUMN workspace_threads_posts.first_hour_views IS '發布後 1 小時內的曝光數';
COMMENT ON COLUMN workspace_threads_posts.first_24h_views IS '發布後 24 小時內的曝光數';
COMMENT ON COLUMN workspace_threads_posts.peak_hour IS '曝光增量最大的小時（發布後第幾小時）';
COMMENT ON COLUMN workspace_threads_posts.discussion_depth IS '討論深度 = replies / (likes + replies)';
COMMENT ON COLUMN workspace_threads_posts.share_willingness IS '傳播意願 = (reposts + quotes) / likes';

-- Create index for early metrics analysis
CREATE INDEX IF NOT EXISTS idx_posts_first_hour_views
ON workspace_threads_posts(workspace_threads_account_id, first_hour_views)
WHERE first_hour_views IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_peak_hour
ON workspace_threads_posts(workspace_threads_account_id, peak_hour)
WHERE peak_hour IS NOT NULL;
