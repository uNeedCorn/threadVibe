# Diffusion Modeling Raw Data

此資料夾用於保存「擴散建模」相關的原始匯出資料（以 15 分鐘 bucket 的貼文時間序列為主），方便：

- 驗證指標計算（累積值 vs delta）
- 回推擴散模型參數（例如 `w_k`、`β_k`）
- 快速重現某篇貼文的生命週期曲線

## 檔案

- `Supabase Snippet Workspace Row-Level Access Policies.csv`
  - 檔名為歷史遺留/暫名，內容實際上是貼文成效的 15 分鐘時間序列資料（非 RLS policies）

## CSV Schema（欄位）

每一列代表：某一篇貼文在某一個 15 分鐘時間窗（`bucket_ts`）的快照/衍生值。

- `post_id`：貼文 ID
- `username`：貼文作者 username
- `poster_followers`：作者粉絲數（若為 0 代表缺值或未同步到）
- `text_preview`：貼文文字預覽（可能含換行）
- `published_at`：發文時間（UTC）
- `bucket_ts`：時間窗起點（UTC，對齊到 15 分鐘）
- `age_minutes`：貼文在此時間窗的年齡（分鐘）
- `views, likes, replies, reposts, quotes`：累積值（總數）
- `delta_views, delta_likes, delta_replies, delta_reposts, delta_quotes`：每窗增量（delta）
- `delta_engagement_rate`：以 delta 計算的互動率（定義依匯出邏輯）
- `virality_score`：病毒傳播分數（定義見 `docs/06-metrics/virality-score.md`）

## 使用建議

- 建議以累積值作為主資料，delta 欄位僅用於 QA 或加速計算。
- 若累積值差分計算出的 delta 與 CSV 的 `delta_*` 不一致，通常表示該窗有回填/延遲上報，需在分析時標記資料品質。

## 驗證（本機）

不需額外安裝套件，可用 Node.js 直接跑一致性檢查與簡單的 `lift` 代理偵測：

```bash
node "docs/06-metrics/diffusion-modeling rawdata/validate.mjs"
```
