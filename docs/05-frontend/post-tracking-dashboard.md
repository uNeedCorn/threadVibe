# 發文追蹤雷達規格

> **頁面名稱**：發文追蹤雷達
> **頁面路徑**：`/insights/radar`
> **檔案位置**：`frontend/app/(auth)/insights/radar/page.tsx`
> **Edge Function**：`supabase/functions/insights-radar/index.ts`
> **最後更新**：2026-01-11

---

## 概述

發文追蹤雷達是專為小編設計的「發文後監控」工具，像雷達一樣持續掃描新發布的貼文，觀察其成效表現。特別聚焦早期（前 3 小時）的擴散趨勢，幫助小編提早發現可能爆紅的訊號。

> 💡 **設計理念**：雷達能偵測到訊號，但不保證每個光點都是目標。同樣地，這個儀表板能讓你看到貼文的早期表現，但爆不爆紅最終還是要看內容和時機。

### 設計原則

- **即時監控**：聚焦 72 小時內的新貼文
- **早期預警**：透過早期指標（前 3 小時）預測爆紅潛力
- **快速判斷**：視覺化呈現，一眼看出哪些貼文值得關注
- **不干擾**：頁面內提示，不推送通知

---

## 資料架構

### 資料流

```
前端 → Edge Function (insights-radar) → Supabase DB
         ↓
   計算業界通用指標 + 獨有指標
         ↓
   回傳完整資料給前端顯示
```

### 指標分類

| 類型 | 指標 | 說明 |
|------|------|------|
| 業界通用 | Engagement Rate | 互動率，由前端計算可接受 |
| 業界通用 | Repost Rate | 轉發率，由前端計算可接受 |
| **獨有指標** | Virality Score | 加權傳播力公式（API 計算） |
| **獨有指標** | Engagement Lead Score | 互動領先指數（API 計算） |
| **獨有指標** | Heatmap Virality Delta | 熱力圖強度（API 計算） |
| **獨有指標** | Heat Type | 早熱/慢熱/穩定分類（API 計算） |
| **獨有指標** | Diffusion Rate (R̂_t) | 擴散動態，判斷加速/減速（API 計算） |

---

## 貼文篩選條件

### 顯示範圍

| 條件 | 值 | 說明 |
|------|------|------|
| 時間範圍 | 72 小時內 | `published_at >= now() - 72h` |
| 排序 | 發布時間（新→舊） | 最新貼文優先 |
| 貼文類型 | 原創貼文 | 排除回覆（`is_reply = false`） |

### 關注時間窗口

| 窗口 | 時間範圍 | 說明 |
|------|----------|------|
| 黃金 30 分鐘 | 0-30 分鐘 | 最關鍵判斷期，決定是否有爆紅潛力 |
| 早期觀察 | 30 分鐘 - 2 小時 | 趨勢確認期 |
| 持續追蹤 | 2-72 小時 | 長尾觀察期 |

---

## 核心指標

### 1. Virality Score（傳播力）【獨有指標】

主要指標，用於判斷貼文是否有病毒式擴散潛力。

```
Virality Score = (replies × 3 + reposts × 2.5 + quotes × 2 + likes) / views × 100
```

**分數評級**：

| 等級 | 分數範圍 | 顏色 | 標籤 |
|------|----------|------|------|
| 爆紅 | ≥ 10 | Red 600 | 🔥 爆紅中 |
| 優秀 | 5-9.99 | Amber 500 | ⭐ 表現優異 |
| 良好 | 2-4.99 | Teal 500 | ✓ 表現良好 |
| 普通 | < 2 | Gray 400 | - |

### 2. Engagement Rate（互動率）【業界通用】

```
Engagement Rate = (likes + replies + reposts + quotes) / views × 100
```

### 3. Repost Rate（轉發率）【業界通用】

```
Repost Rate = (reposts + quotes) / views × 100
```

轉發率反映內容的擴散力，高轉發率表示內容被認為值得分享。

### 4. Engagement Lead Score（互動領先指數）【獨有指標】

衡量互動訊號是否領先曝光增量。

```
Engagement Lead Score = 累計互動百分比 - 累計曝光百分比
```

- 正值 = 互動領先曝光（正在「點火」）
- 負值 = 曝光領先互動（觸及廣但互動低）

### 5. Heat Type（熱力類型）【獨有指標】

根據前 3 小時的 Virality Delta 分布判斷：

| 類型 | 條件 | 說明 |
|------|------|------|
| early（早熱） | 前半 Delta > 後半 Delta × 1.2 | 前期爆發力強 |
| slow（慢熱） | 後半 Delta > 前半 Delta × 1.2 | 後期逐漸增溫 |
| steady（穩定） | 前後半 Delta 接近 | 平穩發展 |

### 6. Diffusion Rate (R̂_t)（擴散動態）【獨有指標】

基於傳染病擴散模型，衡量貼文當前的擴散是加速還是減速。

```
R̂_t = I_t / Σ_{k=1..K} w_k · I_{t-k}

其中：
- I_t = 當窗轉發數 (reposts)
- w_k = 過去第 k 窗的權重（近期權重較高）
- K = 回看窗口數（預設 3-6 窗）
```

**數值解讀**：

| R̂_t 範圍 | 狀態 | 圖示 | 說明 |
|---------|------|------|------|
| > 1.2 | 加速中 | 🔥↑ | 擴散正在加速，轉發帶動新一波曝光 |
| 0.8 - 1.2 | 穩定 | ✨ | 擴散速度穩定 |
| < 0.8 | 趨緩 | 💤↓ | 擴散動能下降，熱度消退中 |

**與其他指標的差異**：

| 指標 | 看什麼 | 時間點 |
|------|--------|--------|
| Heat Type | 前 3 小時的「形狀」分類 | 事後分類 |
| R̂_t | 每個時間點的「加速度」 | 即時動態 |

> 💡 R̂_t 可視為「即時版的 Heat Type」，能在貼文生命週期中持續追蹤擴散狀態變化。

---

## 儀表板組件

### 1. 狀態摘要卡片

**位置**：頁面頂部（全寬 4 欄）

| 卡片 | 內容 | 說明 |
|------|------|------|
| 追蹤中貼文 | 72 小時內貼文數 | 總數顯示 |
| 黃金期貼文 | 30 分鐘內貼文數 | 需密切關注（紅色背景） |
| 早期觀察 | 30 分鐘 - 2 小時貼文數 | 琥珀色圖示 |
| 爆紅潛力 | Virality ≥ 5 的貼文數 | 值得關注的貼文（綠色背景） |

### 2. 72 小時曝光趨勢圖 (ViewDeltaTrendChart)

**位置**：摘要卡片下方

| 設定 | 值 |
|------|------|
| 圖表類型 | 多線折線圖（LineChart） |
| X 軸 | 時間（15 分鐘精度，MM/DD HH:MM 格式） |
| Y 軸 | 曝光增量（Delta） |
| 線條 | 每則貼文獨立一條線，12 色調色盤 |
| 圖例 | 貼文名稱 + 總增量 |

**Tooltip 內容**：
- 時間標籤
- 各貼文在該時間點的增量

### 3. 早期點火曲線 (IgnitionCurveChart)

**位置**：曝光趨勢圖下方

| 設定 | 值 |
|------|------|
| 圖表類型 | 小多圖（Grid 佈局） |
| 每格內容 | 雙線折線圖（互動 % vs 曝光 %） |
| 時間範圍 | 前 3 小時 |
| 排序 | 按 Engagement Lead Score 降序 |

**每格顯示**：
- 貼文名稱（最多 15 字）
- Engagement Lead Score（Badge 顯示）
- 雙色折線：橙色（互動訊號）、青色（曝光增量）
- 底部統計：互動高峰時間、曝光高峰時間

**圖表解讀**：
- 橙色曲線在上方 = 互動領先曝光（正在點火）
- 領先指數越高代表早期互動越強

### 4. 早期訊號熱力圖 (EarlySignalHeatmap)

**位置**：點火曲線下方

| 設定 | 值 |
|------|------|
| 圖表類型 | 矩陣熱力圖 |
| X 軸 | 12 個時間區間（每 15 分鐘，共 3 小時） |
| Y 軸 | 貼文列表（按 Virality Score 排序） |
| 顏色 | 灰色 → 淺琥珀 → 深琥珀（強度 0 → 1） |
| 類型欄 | 早熱/慢熱/穩定 |

**時間區間標籤**：
```
0-15m, 15-30m, 30-45m, 45-60m, 60-75m, 75-90m,
90-105m, 105-120m, 120-135m, 135-150m, 150-165m, 165-180m
```

**強度計算**（API 端）：
```
Virality Delta = (加權互動 / Views 增量) × 100
Intensity = normalize(Virality Delta, 0, maxDelta)
```

### 5. 貼文表現四象限 (QuadrantChart)

**位置**：熱力圖下方

| 設定 | 值 |
|------|------|
| 圖表類型 | 散佈圖（ScatterChart） |
| X 軸 | 轉貼率（%） |
| Y 軸 | 讚+留言率（%） |
| 氣泡大小 | 曝光數 |
| 分界線 | 中央實線（灰色）、平均值虛線（橙色） |

**四象限顏色**：

| 象限 | 位置 | 顏色 | 說明 |
|------|------|------|------|
| 高互動高擴散 | 右上 | Emerald | 最佳表現 |
| 高互動低擴散 | 左上 | Blue | 內容好但分享度低 |
| 低互動高擴散 | 右下 | Amber | 擴散廣但互動低 |
| 待優化 | 左下 | Gray | 需要改善 |

### 6. 貼文列表

**位置**：主要內容區域（四象限下方）

#### 列表欄位

| 欄位 | 說明 | 寬度 |
|------|------|------|
| 狀態 | 發布時間標籤（黃金期/早期/追蹤中） | 80px |
| 貼文內容 | 文字前 50 字 + 媒體縮圖 | flex |
| 發布時間 | 相對時間（如「5 分鐘前」） | 100px |
| 曝光數 | current_views | 80px |
| 傳播力 | Virality Score + 評級標籤 | 100px |
| 擴散動態 | R̂_t 狀態圖示（🔥↑ / ✨ / 💤↓） | 80px |
| 互動率 | Engagement Rate % | 80px |
| 轉發率 | Repost Rate % | 80px |
| 趨勢 | 迷你折線圖（曝光趨勢） | 120px |

#### 擴散動態欄位說明

**顯示邏輯**：
- 僅顯示圖示，不顯示數字（對小編更直覺）
- Hover 時顯示 Tooltip：「擴散加速中」/「擴散穩定」/「熱度趨緩」

**計算時機**：
- 需至少 2 個 15 分鐘窗口的資料才能計算
- 發布未滿 30 分鐘的貼文顯示「—」（資料不足）

#### 狀態標籤

| 標籤 | 條件 | 樣式 |
|------|------|------|
| 🔴 黃金期 | 發布 ≤ 30 分鐘 | Red background, pulse animation |
| 🟡 早期 | 發布 30 分鐘 ~ 2 小時 | Amber background |
| 🟢 追蹤中 | 發布 2 ~ 72 小時 | Teal background |

#### 排序選項

| 選項 | 說明 |
|------|------|
| 最新發布（預設） | 按 published_at 降序 |
| 傳播力最高 | 按 Virality Score 降序 |
| 互動率最高 | 按 Engagement Rate 降序 |
| 曝光最多 | 按 views 降序 |

#### 篩選選項

| 篩選 | 選項 |
|------|------|
| 時間範圍 | 全部 / 黃金期 / 早期 / 追蹤中 |
| 表現 | 爆紅潛力（Virality ≥ 5） |

### 7. 頁面內提示

**位置**：頁面頂部（Toast 區域）

#### 提示觸發條件

| 條件 | 提示內容 | 樣式 |
|------|----------|------|
| Virality ≥ 10 | 「🔥 貼文可能正在爆紅中！」 | Red alert |
| 30 分鐘內 Virality ≥ 5 | 「⭐ 這篇貼文表現優異，值得關注」 | Amber alert |

#### 提示行為

- 頁面載入時檢查並顯示
- 自動刷新時檢查並顯示新提示
- 可手動關閉
- 不推送瀏覽器通知

---

## 資料更新機制

### 自動刷新

| 設定 | 值 |
|------|------|
| 刷新間隔 | 60 秒 |
| 刷新指示 | 顯示「上次更新：X 秒前」 |
| 手動刷新 | 提供刷新按鈕 |

### 資料來源

| 資料 | 來源 | 說明 |
|------|------|------|
| 貼文基本資料 | `workspace_threads_posts` | L3 current 欄位 |
| 趨勢資料 | `workspace_threads_post_metrics_15m` | 15 分鐘快照 |
| 獨有指標 | Edge Function 計算 | ignition, heatmap |

---

## TypeScript 介面

### API 回傳格式

```typescript
interface RadarApiResponse {
  posts: ApiRadarPost[];
  summary: TrackingSummary;
  alerts: Array<{
    id: string;
    type: 'viral' | 'excellent';
    postId: string;
    message: string;
  }>;
  generatedAt: string;
}

interface ApiRadarPost {
  id: string;
  text: string;
  mediaType: string;
  mediaUrl: string | null;
  publishedAt: string;
  ageMinutes: number;
  timeStatus: 'golden' | 'early' | 'tracking';

  // 基本成效
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;

  // 計算指標（API 計算）
  viralityScore: number;
  viralityLevel: 'viral' | 'excellent' | 'good' | 'normal';
  engagementRate: number;
  repostRate: number;

  // 趨勢資料
  trend: TrendPoint[];

  // 獨有指標（API 計算）
  ignition: IgnitionMetrics | null;
  heatmap: HeatmapMetrics | null;
  diffusion: DiffusionMetrics | null;
}
```

### 獨有指標介面

```typescript
// 點火曲線資料點
interface IgnitionDataPoint {
  timestamp: number;
  timeLabel: string; // HH:MM 格式
  engagementPct: number; // 累計互動百分比
  viewsPct: number; // 累計曝光百分比
}

// 點火曲線指標
interface IgnitionMetrics {
  dataPoints: IgnitionDataPoint[];
  engagementLeadScore: number; // 互動領先指數
  peakEngagementTime: string; // 互動高峰時間
  peakViewsTime: string; // 曝光高峰時間
}

// 熱力圖單格
interface HeatmapCell {
  bucketIndex: number; // 0-11（12 個 15 分鐘區間）
  viralityDelta: number; // 該區間的 Virality Delta
  intensity: number; // 正規化強度 0-1
}

// 熱力圖指標
interface HeatmapMetrics {
  cells: HeatmapCell[];
  heatType: 'early' | 'slow' | 'steady';
  earlyDelta: number; // 前半總 Delta
  lateDelta: number; // 後半總 Delta
}

// 擴散動態指標
interface DiffusionMetrics {
  rHat: number; // R̂_t 數值
  status: 'accelerating' | 'stable' | 'decelerating'; // 狀態分類
  trend: DiffusionTrendPoint[]; // 歷史趨勢（可選，用於展開詳情）
}

interface DiffusionTrendPoint {
  timestamp: number;
  rHat: number;
}
```

### 前端介面

```typescript
interface TrackingPost {
  id: string;
  text: string;
  mediaType: string;
  thumbnailUrl: string | null;
  publishedAt: Date;

  // Current metrics
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;

  // Calculated metrics
  viralityScore: number;
  viralityLevel: 'viral' | 'excellent' | 'good' | 'normal';
  engagementRate: number;
  repostRate: number;

  // Time-based
  ageMinutes: number;
  timeStatus: 'golden' | 'early' | 'tracking';

  // Trend data
  trend: TrendPoint[];

  // 獨有指標（API 計算）
  ignition: IgnitionMetrics | null;
  heatmap: HeatmapMetrics | null;
  diffusion: DiffusionMetrics | null;
}

interface TrendPoint {
  timestamp: number;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  viralityScore: number;
}

interface TrackingSummary {
  totalPosts: number;
  goldenPosts: number;
  earlyPosts: number;
  trackingPosts: number;
  viralPotential: number;
}
```

---

## Edge Function API

### 端點

```
POST /functions/v1/insights-radar
Headers: Authorization: Bearer <access_token>
Body: { "account_id": "<uuid>" }
```

### 回傳結構

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

### 獨有指標計算（API 端）

```typescript
// Virality Score
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

// Engagement Lead Score
function calculateIgnitionMetrics(trend: TrendPoint[]): IgnitionMetrics {
  // 取前 3 小時資料
  // 計算累計互動 % 和累計曝光 %
  // engagementLeadScore = 最終互動% - 最終曝光%
}

// Heatmap Metrics
function calculateHeatmapMetrics(trend: TrendPoint[]): HeatmapMetrics {
  // 分成 12 個 15 分鐘區間
  // 計算每區間的 Virality Delta
  // 正規化強度 0-1
  // 判斷 heatType (early/slow/steady)
}

// Diffusion Rate (R̂_t)
function calculateDiffusionMetrics(trend: TrendPoint[]): DiffusionMetrics | null {
  // 需至少 2 個時間窗口
  if (trend.length < 2) return null;

  // 取最近 K 窗的 reposts 增量
  const K = Math.min(6, trend.length - 1);
  const weights = [0.4, 0.25, 0.15, 0.1, 0.05, 0.05]; // 近期權重較高

  // 計算當窗轉發數
  const I_t = trend[trend.length - 1].reposts - trend[trend.length - 2].reposts;

  // 計算加權歷史轉發數
  let weightedSum = 0;
  for (let k = 1; k <= K; k++) {
    const I_prev = trend[trend.length - k - 1]?.reposts - trend[trend.length - k - 2]?.reposts || 0;
    weightedSum += weights[k - 1] * Math.max(0, I_prev);
  }

  // 避免除以 0
  const rHat = weightedSum > 0 ? I_t / weightedSum : 0;

  // 判斷狀態
  const status = rHat > 1.2 ? 'accelerating' :
                 rHat < 0.8 ? 'decelerating' : 'stable';

  return { rHat, status, trend: [] };
}
```

---

## 響應式設計

| 斷點 | 佈局調整 |
|------|----------|
| Desktop (lg+) | 完整顯示所有圖表 |
| Tablet (md) | 圖表垂直堆疊 |
| Mobile (sm) | 簡化列表、隱藏部分欄位 |

### Mobile 簡化欄位

| 顯示 | 隱藏 |
|------|------|
| 狀態、內容、傳播力 | 轉發率、趨勢圖 |

---

## 元件依賴

| 元件 | 來源 |
|------|------|
| Card, CardHeader, CardContent, CardTitle | @/components/ui/card |
| Table, TableHead, TableRow, TableCell, TableHeader, TableBody | @/components/ui/table |
| Badge | @/components/ui/badge |
| Button | @/components/ui/button |
| Select, SelectTrigger, SelectValue, SelectContent, SelectItem | @/components/ui/select |
| Skeleton | @/components/ui/skeleton |
| LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer | recharts |
| ScatterChart, Scatter, ZAxis, Cell, ReferenceLine | recharts |

### 自定義元件

| 元件 | 說明 |
|------|------|
| TimeStatusBadge | 時間狀態標籤（黃金期/早期/追蹤中） |
| ViralityBadge | 傳播力等級標籤 |
| DiffusionStatusIcon | 擴散動態圖示（🔥↑ / ✨ / 💤↓） |
| MiniTrendChart | 迷你曝光趨勢圖 |
| ViewDeltaTrendChart | 72 小時曝光增量趨勢圖 |
| IgnitionCurveChart | 早期點火曲線（小多圖） |
| EarlySignalHeatmap | 早期訊號熱力圖 |
| QuadrantChart | 貼文表現四象限散佈圖 |
| SummaryCard | 摘要統計卡片 |
| AlertBanner | 頁面內提示橫幅 |
| PostsTable | 貼文列表表格 |

---

## 相關文件

- [Insights 總覽儀表板](insights-overview-dashboard.md) - 整體成效總覽
- [insights-radar Edge Function](../04-backend/functions/insights-radar.md) - API 文件
- [Virality Score](../06-metrics/virality-score.md) - 傳播力計算公式
- [Heat Type](../06-metrics/heat-type.md) - 熱力類型分類
- [Engagement Lead Score](../06-metrics/engagement-lead-score.md) - 互動領先指數
- [Diffusion Modeling](../06-metrics/diffusion-modeling.md) - 擴散模型理論基礎
