# insights-radar Edge Function

> **檔案位置**：`supabase/functions/insights-radar/index.ts`
> **用途**：發文追蹤雷達 API，計算獨有指標
> **最後更新**：2026-01-12

---

## 概述

此 Edge Function 為發文追蹤雷達頁面提供資料，包含：
- 72 小時內貼文的基本成效
- 15 分鐘趨勢資料
- **獨有指標計算**（Virality Score、Ignition Metrics、Heatmap Metrics、Diffusion Metrics）

---

## API 端點

```
POST /functions/v1/insights-radar
Headers: Authorization: Bearer <access_token>
Content-Type: application/json
```

### Request Body

```json
{
  "account_id": "<uuid>"
}
```

### Response

```json
{
  "posts": [...],
  "summary": {
    "totalPosts": 10,
    "goldenPosts": 2,
    "earlyPosts": 3,
    "trackingPosts": 5,
    "viralPotential": 1
  },
  "alerts": [...],
  "generatedAt": "2026-01-11T12:00:00Z"
}
```

---

## 獨有指標計算

### 1. Virality Score

加權傳播力分數，反映貼文的病毒式擴散潛力。

```typescript
function calculateViralityScore(
  replies: number,
  reposts: number,
  quotes: number,
  likes: number,
  views: number
): number {
  if (views === 0) return 0;
  const weightedSum = replies * 3 + reposts * 2.5 + quotes * 2 + likes * 1;
  return (weightedSum / views) * 100;
}
```

**等級評定**：

| 等級 | 分數範圍 | 說明 |
|------|----------|------|
| viral | ≥ 10 | 爆紅中 |
| excellent | 5-9.99 | 表現優異 |
| good | 2-4.99 | 表現良好 |
| normal | < 2 | 普通 |

### 2. Ignition Metrics（點火曲線）

分析前 3 小時的互動與曝光累計比例，判斷互動是否領先曝光。

```typescript
interface IgnitionMetrics {
  dataPoints: IgnitionDataPoint[];
  engagementLeadScore: number;
  peakEngagementTime: string;
  peakViewsTime: string;
}

interface IgnitionDataPoint {
  timestamp: number;
  timeLabel: string;      // HH:MM 格式
  engagementPct: number;  // 累計互動百分比
  viewsPct: number;       // 累計曝光百分比
}
```

**計算邏輯**：

1. 篩選前 3 小時的趨勢資料
2. 計算各時間點的累計互動數和累計曝光數
3. 轉換為百分比（相對於最終值）
4. `engagementLeadScore = 最終互動% - 最終曝光%`

**解讀**：
- 正值：互動領先曝光（正在「點火」）
- 負值：曝光領先互動（觸及廣但互動低）

### 3. Heatmap Metrics（早期訊號熱力圖）

將前 3 小時切分為 12 個 15 分鐘區間，計算每區間的 Virality Delta。

```typescript
interface HeatmapMetrics {
  cells: HeatmapCell[];
  heatType: 'early' | 'slow' | 'steady';
  earlyDelta: number;
  lateDelta: number;
}

interface HeatmapCell {
  bucketIndex: number;     // 0-11
  viralityDelta: number;   // 該區間的 Virality Delta
  intensity: number;       // 正規化強度 0-1
}
```

**計算邏輯**：

1. 將趨勢資料按 15 分鐘區間分組（共 12 個 bucket）
2. 計算每區間的增量：`viewsDelta`, `likesDelta`, `repliesDelta`, `repostsDelta`, `quotesDelta`
3. 計算 Virality Delta：
   ```
   weightedDelta = repliesDelta×3 + repostsDelta×2.5 + quotesDelta×2 + likesDelta
   viralityDelta = (weightedDelta / viewsDelta) × 100
   ```
4. 正規化強度：`intensity = viralityDelta / maxDelta`（跨所有貼文）
5. 判斷 Heat Type：
   - `early`：前半 Delta > 後半 Delta × 1.2
   - `slow`：後半 Delta > 前半 Delta × 1.2
   - `steady`：前後半 Delta 接近

### 4. Diffusion Metrics（擴散動態）

讀取預計算的 R̂_t（再生數估計），由 `r-hat-calculator` Edge Function 定期計算並存入 DB。

```typescript
interface DiffusionMetrics {
  rHat: number;          // R̂_t 值
  status: DiffusionStatus; // 'accelerating' | 'stable' | 'decelerating'
}
```

**資料來源**：

- `workspace_threads_posts.current_r_hat`：預計算的 R̂_t 值
- `workspace_threads_posts.current_r_hat_status`：預計算的狀態

**狀態對應**：

| DB 狀態 | 前端狀態 | 圖示 | 文字標籤 |
|---------|----------|------|----------|
| `viral`, `accelerating` | `accelerating` | 🔥 | 加速擴散 |
| `stable` | `stable` | ✨ | 穩定傳播 |
| `decaying`, `fading` | `decelerating` | 💤 | 熱度趨緩 |
| `insufficient` | `null` | — | — |

> **注意**：R̂_t 不在此 API 即時計算，而是讀取 `r-hat-calculator` 預計算的值。
> 詳見 [r-hat-calculator](./r-hat-calculator.md)

---

## 資料來源

| 資料 | 來源表 | 說明 |
|------|--------|------|
| 貼文基本資料 | `workspace_threads_posts` | L3 current 欄位 |
| R̂_t 預計算值 | `workspace_threads_posts.current_r_hat` | 由 r-hat-calculator 計算 |
| R̂_t 狀態 | `workspace_threads_posts.current_r_hat_status` | 由 r-hat-calculator 計算 |
| 趨勢資料 | `workspace_threads_post_metrics_15m` | 15 分鐘快照 |

---

## 篩選條件

| 條件 | 值 |
|------|------|
| 時間範圍 | 72 小時內（`published_at >= now() - 72h`） |
| 貼文類型 | 原創貼文（`is_reply = false`） |
| 排序 | 發布時間降序 |

---

## 認證與授權

1. 驗證 Bearer Token
2. 從 Token 取得用戶 ID
3. 驗證用戶對該帳號的存取權限（透過 workspace membership）

---

## 錯誤處理

| 狀態碼 | 說明 |
|--------|------|
| 400 | 缺少 account_id |
| 401 | 未認證或 Token 無效 |
| 403 | 無權限存取該帳號 |
| 500 | 伺服器內部錯誤 |

---

## 相關文件

- [發文追蹤雷達規格](../../05-frontend/post-tracking-dashboard.md)
- [r-hat-calculator](./r-hat-calculator.md) - R̂_t 計算 Edge Function
- [Virality Score](../../06-metrics/virality-score.md)
- [Engagement Lead Score](../../06-metrics/engagement-lead-score.md)
- [Heat Type](../../06-metrics/heat-type.md)
- [Diffusion Modeling](../../06-metrics/diffusion-modeling.md)
