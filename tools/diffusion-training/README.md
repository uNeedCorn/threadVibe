# Diffusion Training (Offline)

此資料夾用於把「擴散建模」從產品 runtime 拆出去，在本機/外部環境做離線訓練與參數回推。

## 目標

- 從 15 分鐘 bucket 的貼文時間序列 CSV 回推簡化模型參數（baseline 衰退、repost 對曝光的貢獻、repost 自激勵）
- 輸出可供產品端使用的參數 JSON（例如 `β_k`、`w_k` 的初始值）

## 輸入資料

目前 repo 內有一份範例：

- `docs/06-metrics/diffusion-modeling rawdata/Supabase Snippet Workspace Row-Level Access Policies.csv`

欄位定義見：

- `docs/06-metrics/diffusion-modeling rawdata/README.md`

## 執行

```bash
node tools/diffusion-training/train.mjs \
  --csv "docs/06-metrics/diffusion-modeling rawdata/Supabase Snippet Workspace Row-Level Access Policies.csv" \
  --k 6 \
  --alpha 1 \
  --out tools/diffusion-training/params.json
```

輸出會包含：

- exposure model：預測 `Δviews`（含 baseline + lagged `Δreposts`）
- repost model：預測 `Δreposts`（含 baseline + lagged `Δreposts`）
- 簡單的 holdout 指標（RMSE）

注意：若資料中 `Δreposts` 幾乎全為 0，`repost model` 會出現 `test_nonzero_rate=0` 的退化情況，代表目前樣本不足以訓練傳播參數。
