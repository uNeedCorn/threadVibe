-- 刪除舊版本的 LLM 函數（不同參數簽名，缺少 search_path）
DROP FUNCTION IF EXISTS public.get_llm_usage_stats();
DROP FUNCTION IF EXISTS public.get_llm_daily_usage(integer);
