-- Add question and CTA columns to workspace_threads_posts
-- These columns are filled by AI tagging analysis (Gemini)

-- Add the columns
ALTER TABLE workspace_threads_posts
ADD COLUMN IF NOT EXISTS has_question BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS question_type TEXT,
ADD COLUMN IF NOT EXISTS has_cta BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS cta_type TEXT;

-- Add comments for documentation
COMMENT ON COLUMN workspace_threads_posts.has_question IS '是否包含問句（AI 分析）';
COMMENT ON COLUMN workspace_threads_posts.question_type IS '問句類型：direct/rhetorical/poll';
COMMENT ON COLUMN workspace_threads_posts.has_cta IS '是否包含行動呼籲（AI 分析）';
COMMENT ON COLUMN workspace_threads_posts.cta_type IS 'CTA 類型：ask_opinion/share/comment/click_link/follow';

-- Backfill from existing ai_suggested_tags.content_features
UPDATE workspace_threads_posts
SET
  has_question = COALESCE((ai_suggested_tags->'content_features'->>'has_question')::boolean, false),
  question_type = ai_suggested_tags->'content_features'->>'question_type',
  has_cta = COALESCE((ai_suggested_tags->'content_features'->>'has_cta')::boolean, false),
  cta_type = ai_suggested_tags->'content_features'->>'cta_type'
WHERE ai_suggested_tags IS NOT NULL
  AND ai_suggested_tags->'content_features' IS NOT NULL;

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_posts_has_question
ON workspace_threads_posts(workspace_threads_account_id, has_question)
WHERE has_question = true;

CREATE INDEX IF NOT EXISTS idx_posts_has_cta
ON workspace_threads_posts(workspace_threads_account_id, has_cta)
WHERE has_cta = true;
