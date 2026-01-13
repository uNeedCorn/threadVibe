-- 新增 waitlist 表欄位：粉絲數量級別、來源、內容類型
ALTER TABLE beta_waitlist
ADD COLUMN IF NOT EXISTS follower_tier TEXT,
ADD COLUMN IF NOT EXISTS referral_source TEXT,
ADD COLUMN IF NOT EXISTS content_type TEXT;

-- 加入欄位註解
COMMENT ON COLUMN beta_waitlist.follower_tier IS '粉絲數量級別：under1k, 1k-10k, 10k-50k, 50k+';
COMMENT ON COLUMN beta_waitlist.referral_source IS '來源：friend, social, search, other';
COMMENT ON COLUMN beta_waitlist.content_type IS '主要內容類型：lifestyle, knowledge, brand, other';
