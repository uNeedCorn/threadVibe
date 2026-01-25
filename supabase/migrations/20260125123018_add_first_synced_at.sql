-- Add first_synced_at to track when a post was first synced
-- Used for delta calculation: new posts (< 30 min) get delta = current, old posts get delta = 0

-- Add first_synced_at column if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspace_threads_posts' AND column_name = 'first_synced_at'
  ) THEN
    ALTER TABLE workspace_threads_posts ADD COLUMN first_synced_at TIMESTAMPTZ;
  END IF;
END $$;

-- Backfill existing posts with their created_at (approximate first sync time)
UPDATE workspace_threads_posts
SET first_synced_at = created_at
WHERE first_synced_at IS NULL;

-- Set default for future inserts
ALTER TABLE workspace_threads_posts
ALTER COLUMN first_synced_at SET DEFAULT NOW();

-- Add index if not exists
CREATE INDEX IF NOT EXISTS idx_posts_first_synced_at ON workspace_threads_posts(first_synced_at);

-- Add is_baseline flag to delta table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspace_threads_post_metrics_deltas' AND column_name = 'is_baseline'
  ) THEN
    ALTER TABLE workspace_threads_post_metrics_deltas ADD COLUMN is_baseline BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
END $$;

COMMENT ON COLUMN workspace_threads_posts.first_synced_at IS 'Timestamp when this post was first synced into the system';
COMMENT ON COLUMN workspace_threads_post_metrics_deltas.is_baseline IS 'True if this delta represents a baseline (first sync of an old post)';
