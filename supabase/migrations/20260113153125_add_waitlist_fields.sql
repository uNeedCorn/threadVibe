-- 新增 waitlist 表欄位：身份類型、管理的帳號
ALTER TABLE beta_waitlist
ADD COLUMN IF NOT EXISTS user_type TEXT,
ADD COLUMN IF NOT EXISTS managed_accounts TEXT;

-- 加入欄位註解
COMMENT ON COLUMN beta_waitlist.user_type IS '身份類型：personal, agency, brand';
COMMENT ON COLUMN beta_waitlist.managed_accounts IS '管理的 Threads 帳號，格式：@id1,@id2,@id3';
