# R̂_t Calculator Edge Function

> 計算貼文的即時再生數估計 (Reproduction Number)

## 概述

R̂_t Calculator 是一個背景任務，從 `r_hat_queue` 取得待計算貼文，計算其再生數估計值，並更新到各層指標表。

## 觸發方式

| 方式 | 說明 |
|------|------|
| **Cron** | 每 5 分鐘自動執行（`*/5 * * * *`） |
| **手動** | `POST /functions/v1/r-hat-calculator`（需 CRON_SECRET） |

## 認證

```http
POST /functions/v1/r-hat-calculator
Authorization: Bearer <CRON_SECRET>
Content-Type: application/json
```

## R̂_t 計算公式

```
R̂_t = ΔReposts_t / Σ w_k × ΔReposts_{t-k}
```

- `ΔReposts_t`: 當前時間窗新增轉發數
- `w_k`: 感染核權重（指數衰減）
- `k`: 過去時間窗索引（1 到 K）

### 感染核權重

```javascript
const KERNEL_WEIGHTS = [0.5, 0.25, 0.15, 0.07, 0.03]; // 加總 = 1.0
```

權重設計反映「越近的轉發對當前擴散影響越大」的特性。

## 狀態分類

| 狀態 | R̂_t 值 | 說明 |
|------|---------|------|
| `viral` | > 1.5 | 病毒式傳播，指數成長 |
| `accelerating` | > 1.2 | 加速擴散，超臨界 |
| `stable` | 0.8 - 1.2 | 穩定傳播，臨界點附近 |
| `decaying` | 0.3 - 0.8 | 衰退中，亞臨界 |
| `fading` | < 0.3 | 消退，接近停止傳播 |
| `insufficient` | null | 資料不足（少於 3 個時間點） |

## 處理流程

```
1. 從 r_hat_queue 取得 pending 任務（最多 50 筆）
   ↓
2. 按優先級排序（新貼文優先）
   ↓
3. 對每個貼文：
   a. 標記為 processing
   b. 取得最近 10 個 15m 快照
   c. 計算 delta reposts
   d. 套用感染核計算 R̂_t
   e. 判斷狀態
   ↓
4. 更新結果到：
   - r_hat_queue（快取）
   - workspace_threads_post_metrics_15m
   - workspace_threads_post_metrics_hourly
   - workspace_threads_post_metrics_daily
   - workspace_threads_posts（L3 Current）
   ↓
5. 標記任務完成/失敗/跳過
```

## Response

```json
{
  "message": "Processing complete",
  "processed": 45,
  "skipped": 3,
  "failed": 2,
  "total": 50
}
```

| 欄位 | 說明 |
|------|------|
| `processed` | 成功計算並更新的貼文數 |
| `skipped` | 因資料不足而跳過的貼文數 |
| `failed` | 處理失敗的貼文數 |
| `total` | 本次處理的總任務數 |

## 相關資源

| 資源 | 說明 |
|------|------|
| [r_hat_queue](../../03-database/tables/r-hat-queue.md) | Job Queue 資料表 |
| [diffusion-model-recommendations.md](../../06-metrics/diffusion-model-recommendations.md) | 擴散模型理論與改進建議 |
| [diffusion-modeling.md](../../06-metrics/diffusion-modeling.md) | 擴散建模原理 |

## 程式碼位置

```
supabase/functions/r-hat-calculator/index.ts
```

## 環境變數

| 變數 | 說明 |
|------|------|
| `CRON_SECRET` | Cron 任務認證密鑰 |

## 與 insights-radar 整合

`insights-radar` API 會讀取預計算的 R̂_t 值，並將 DB 狀態對應到前端顯示：

| DB 狀態 | 前端狀態 | 圖示 | 文字標籤 | 說明 |
|---------|----------|------|----------|------|
| `viral` | `accelerating` | 🔥 | 加速擴散 | 病毒式傳播 |
| `accelerating` | `accelerating` | 🔥 | 加速擴散 | 加速擴散中 |
| `stable` | `stable` | ✨ | 穩定傳播 | 穩定傳播中 |
| `decaying` | `decelerating` | 💤 | 熱度趨緩 | 衰退中 |
| `fading` | `decelerating` | 💤 | 熱度趨緩 | 消退中 |
| `insufficient` | `null` | — | — | 資料不足 |

## 注意事項

1. **最小資料點**：需要至少 3 個 15m 快照才能計算
2. **批次大小**：每次最多處理 50 筆任務
3. **重試機制**：失敗任務會重試最多 3 次
4. **優先級**：新貼文（48 小時內）優先處理
5. **Cron 觸發**：使用 `trigger_edge_function('r-hat-calculator')` 安全觸發
