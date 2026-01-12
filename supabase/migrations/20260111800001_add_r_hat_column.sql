-- Migration: 新增 R̂ (再生數估計) 欄位
-- ADR: diffusion-model-recommendations.md
--
-- R̂_t = I_t / Σ w_k × I_{t-k}
-- 用於判斷貼文擴散是否加速 (R̂ > 1) 或衰退 (R̂ < 1)

-- 15m 表新增 r_hat（原始計算，每 15 分鐘更新）
ALTER TABLE workspace_threads_post_metrics_15m
ADD COLUMN IF NOT EXISTS r_hat NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS r_hat_status TEXT DEFAULT NULL;

COMMENT ON COLUMN workspace_threads_post_metrics_15m.r_hat IS '即時再生數估計 R̂_t = ΔReposts_t / Σ w_k × ΔReposts_{t-k}';
COMMENT ON COLUMN workspace_threads_post_metrics_15m.r_hat_status IS '擴散狀態: accelerating(>1.2), stable(0.8-1.2), decaying(<0.8), insufficient(資料不足)';

-- hourly 表新增 r_hat（從 15m rollup 取最後值或平均）
ALTER TABLE workspace_threads_post_metrics_hourly
ADD COLUMN IF NOT EXISTS r_hat NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS r_hat_status TEXT DEFAULT NULL;

COMMENT ON COLUMN workspace_threads_post_metrics_hourly.r_hat IS '小時內最後一次的 R̂ 值';
COMMENT ON COLUMN workspace_threads_post_metrics_hourly.r_hat_status IS '擴散狀態: accelerating(>1.2), stable(0.8-1.2), decaying(<0.8), insufficient(資料不足)';

-- daily 表新增 r_hat（從 hourly rollup 取代表值）
ALTER TABLE workspace_threads_post_metrics_daily
ADD COLUMN IF NOT EXISTS r_hat NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS r_hat_status TEXT DEFAULT NULL;

COMMENT ON COLUMN workspace_threads_post_metrics_daily.r_hat IS '當日最後一次的 R̂ 值';
COMMENT ON COLUMN workspace_threads_post_metrics_daily.r_hat_status IS '擴散狀態: accelerating(>1.2), stable(0.8-1.2), decaying(<0.8), insufficient(資料不足)';

-- L3 Current 表也新增（用於快速查詢當前狀態）
ALTER TABLE workspace_threads_posts
ADD COLUMN IF NOT EXISTS current_r_hat NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS current_r_hat_status TEXT DEFAULT NULL;

COMMENT ON COLUMN workspace_threads_posts.current_r_hat IS '最新的 R̂ 估計值';
COMMENT ON COLUMN workspace_threads_posts.current_r_hat_status IS '當前擴散狀態';
