-- ============================================================================
-- Migration: Add longtail analysis columns
-- Description: 新增長尾分析相關欄位到 workspace_threads_posts
-- ============================================================================

-- ============================================================================
-- Layer 3: workspace_threads_posts (Current)
-- ============================================================================

-- 前 7 天累計曝光（貼文滿 7 天後由背景任務計算）
ALTER TABLE workspace_threads_posts
ADD COLUMN IF NOT EXISTS first_7d_views INTEGER DEFAULT 0;

-- 長尾比例 (0-1)：(總曝光 - 前7天曝光) / 總曝光
ALTER TABLE workspace_threads_posts
ADD COLUMN IF NOT EXISTS longtail_ratio DECIMAL(5,4) DEFAULT 0;

-- 常青指數：近30天日均曝光 / 前7天日均曝光
ALTER TABLE workspace_threads_posts
ADD COLUMN IF NOT EXISTS evergreen_index DECIMAL(5,4) DEFAULT 0;

-- 半衰期（天）：達到 50% 最終曝光所需天數
ALTER TABLE workspace_threads_posts
ADD COLUMN IF NOT EXISTS half_life_days DECIMAL(5,2) DEFAULT NULL;

-- 長尾狀態標籤
ALTER TABLE workspace_threads_posts
ADD COLUMN IF NOT EXISTS longtail_status TEXT DEFAULT NULL;

-- ============================================================================
-- 索引
-- ============================================================================

-- 長尾比例索引（用於排序和篩選）
CREATE INDEX IF NOT EXISTS idx_posts_longtail_ratio
ON workspace_threads_posts(longtail_ratio DESC)
WHERE longtail_ratio > 0;

-- 常青指數索引（用於識別常青內容）
CREATE INDEX IF NOT EXISTS idx_posts_evergreen_index
ON workspace_threads_posts(evergreen_index DESC)
WHERE evergreen_index > 0;

-- 長尾狀態索引（用於狀態篩選）
CREATE INDEX IF NOT EXISTS idx_posts_longtail_status
ON workspace_threads_posts(longtail_status)
WHERE longtail_status IS NOT NULL;

-- ============================================================================
-- 欄位註解
-- ============================================================================

COMMENT ON COLUMN workspace_threads_posts.first_7d_views IS '前 7 天累計曝光，貼文滿 7 天後計算';
COMMENT ON COLUMN workspace_threads_posts.longtail_ratio IS '長尾比例 (0-1)，(總曝光-前7天曝光)/總曝光';
COMMENT ON COLUMN workspace_threads_posts.evergreen_index IS '常青指數，近30天日均/前7天日均';
COMMENT ON COLUMN workspace_threads_posts.half_life_days IS '半衰期（天），達50%最終曝光所需天數';
COMMENT ON COLUMN workspace_threads_posts.longtail_status IS '長尾狀態：evergreen/growing/dormant/revived/burst';
