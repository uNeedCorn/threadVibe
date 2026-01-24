-- 添加 health_check_submissions 到 profiles 的外鍵關係
-- 讓 Supabase 可以使用 select("*, profiles(...)") 語法
ALTER TABLE health_check_submissions
ADD CONSTRAINT fk_health_check_submissions_profiles
FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
