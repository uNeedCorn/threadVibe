# 發文追蹤雷達規格

> **頁面名稱**：發文追蹤雷達
> **頁面路徑**：`/insights/radar`
> **檔案位置**：`frontend/app/(auth)/insights/radar/page.tsx`
> **最後更新**：2026-01-11

---

## 概述

發文追蹤雷達是專為小編設計的「發文後監控」工具，像雷達一樣持續掃描新發布的貼文，觀察其成效表現。特別聚焦早期（前 30 分鐘）的擴散趨勢，幫助小編提早發現可能爆紅的訊號。

> 💡 **設計理念**：雷達能偵測到訊號，但不保證每個光點都是目標。同樣地，這個儀表板能讓你看到貼文的早期表現，但爆不爆紅最終還是要看內容和時機。

### 設計原則

- **即時監控**：聚焦 72 小時內的新貼文
- **早期預警**：透過早期指標（前 30 分鐘）預測爆紅潛力
- **快速判斷**：視覺化呈現，一眼看出哪些貼文值得關注
- **不干擾**：頁面內提示，不推送通知

---

## 目標使用者

| 角色 | 使用情境 |
|------|----------|
| 小編本人 | 發文後追蹤成效，判斷是否需要互動或調整策略 |

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
| 早期觀察 | 0-2 小時 | 趨勢確認期 |
| 持續追蹤 | 2-72 小時 | 長尾觀察期 |

---

## 核心指標

### 1. Virality Score（傳播力）

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

### 2. Engagement Rate（互動率）

```
Engagement Rate = (likes + replies + reposts + quotes) / views × 100
```

### 3. Repost Rate（轉發率）

```
Repost Rate = (reposts + quotes) / views × 100
```

轉發率反映內容的擴散力，高轉發率表示內容被認為值得分享。

### 4. Early Velocity（早期速度）

衡量貼文在前 30 分鐘的互動速度。

```
Early Velocity = 前 30 分鐘互動數 / 30 × 60  (互動數/分鐘)
```

**速度評級**：

| 等級 | 速度 | 說明 |
|------|------|------|
| 飛速 | > 10/min | 極高擴散潛力 |
| 快速 | 5-10/min | 高擴散潛力 |
| 正常 | 1-5/min | 一般表現 |
| 緩慢 | < 1/min | 需觀察 |

---

## 儀表板組件

### 1. 狀態摘要卡片

**位置**：頁面頂部（全寬）

| 卡片 | 內容 | 說明 |
|------|------|------|
| 追蹤中貼文 | 72 小時內貼文數 | 總數顯示 |
| 黃金期貼文 | 30 分鐘內貼文數 | 需密切關注 |
| 爆紅潛力 | Virality ≥ 5 的貼文數 | 值得關注的貼文 |

### 2. 貼文列表

**位置**：主要內容區域

#### 列表欄位

| 欄位 | 說明 | 寬度 |
|------|------|------|
| 狀態 | 發布時間標籤（黃金期/早期/追蹤中） | 80px |
| 貼文內容 | 文字前 50 字 + 媒體縮圖 | flex |
| 發布時間 | 相對時間（如「5 分鐘前」） | 100px |
| 曝光數 | current_views | 80px |
| Virality | Virality Score + 評級標籤 | 100px |
| 互動率 | Engagement Rate % | 80px |
| 轉發率 | Repost Rate % | 80px |
| 趨勢 | 迷你折線圖（過去 30 分鐘） | 120px |

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
| Virality 最高 | 按 Virality Score 降序 |
| 互動率最高 | 按 Engagement Rate 降序 |
| 曝光最多 | 按 views 降序 |

#### 篩選選項

| 篩選 | 選項 |
|------|------|
| 時間範圍 | 全部 / 黃金期 / 早期 / 追蹤中 |
| 表現 | 全部 / 爆紅潛力 / 表現優異 |

### 3. 趨勢圖區域

**位置**：列表上方或右側（可切換）

#### 整體趨勢圖

顯示選中貼文或全部貼文的趨勢。

| 設定 | 值 |
|------|------|
| 圖表類型 | 折線圖（LineChart） |
| X 軸 | 時間（每 15 分鐘一個資料點） |
| Y 軸（左） | 曝光數 |
| Y 軸（右） | Virality Score |

#### 互動分布圖

顯示各類互動的組成。

| 設定 | 值 |
|------|------|
| 圖表類型 | 堆疊長條圖（StackedBarChart） |
| X 軸 | 貼文（按發布時間） |
| Y 軸 | 互動數 |
| 分類 | Likes / Replies / Reposts / Quotes |

### 4. 頁面內提示

**位置**：頁面頂部（Toast 區域）

#### 提示觸發條件

| 條件 | 提示內容 | 樣式 |
|------|----------|------|
| Virality ≥ 10 | 「🔥 貼文可能正在爆紅中！」 | Red alert |
| 30 分鐘內 Virality ≥ 5 | 「⭐ 這篇貼文表現優異，值得關注」 | Amber alert |
| 早期速度 > 10/min | 「🚀 貼文擴散速度飛快！」 | Teal alert |

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

| 資料 | 來源表 | 說明 |
|------|--------|------|
| 貼文基本資料 | `workspace_threads_posts` | L3 current 欄位 |
| 趨勢資料 | `workspace_threads_post_metrics_15m` | 15 分鐘快照 |
| 早期速度 | `workspace_threads_post_metrics_15m` | 計算前 2 個時間桶差值 |

---

## TypeScript 介面

```typescript
interface TrackingPost {
  id: string;
  text: string;
  mediaType: 'TEXT' | 'IMAGE' | 'VIDEO' | 'CAROUSEL';
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

  // Trend data (last 30 minutes)
  trend: TrendPoint[];
}

interface TrendPoint {
  timestamp: Date;
  views: number;
  viralityScore: number;
  interactions: number;
}

interface TrackingSummary {
  totalPosts: number;
  goldenPosts: number;     // ≤ 30 minutes
  earlyPosts: number;      // 30 min - 2 hours
  trackingPosts: number;   // 2 - 72 hours
  viralPotential: number;  // Virality ≥ 5
}

interface PageAlert {
  id: string;
  type: 'viral' | 'excellent' | 'fast';
  postId: string;
  message: string;
  createdAt: Date;
  dismissed: boolean;
}
```

---

## 計算函式

### Virality Score

```typescript
function calculateViralityScore(
  replies: number,
  reposts: number,
  quotes: number,
  likes: number,
  views: number
): number {
  if (views === 0) return 0;

  const weightedSum =
    replies * 3 +
    reposts * 2.5 +
    quotes * 2 +
    likes * 1;

  return (weightedSum / views) * 100;
}

function getViralityLevel(score: number): string {
  if (score >= 10) return 'viral';
  if (score >= 5) return 'excellent';
  if (score >= 2) return 'good';
  return 'normal';
}
```

### Early Velocity

```typescript
function calculateEarlyVelocity(
  metrics15m: MetricSnapshot[]
): number {
  // 取前 30 分鐘的快照（2 個 15 分鐘時間桶）
  const earlySnapshots = metrics15m
    .filter(m => m.minutesSincePublish <= 30)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (earlySnapshots.length < 2) return 0;

  const firstSnapshot = earlySnapshots[0];
  const lastSnapshot = earlySnapshots[earlySnapshots.length - 1];

  const totalInteractions =
    (lastSnapshot.likes - firstSnapshot.likes) +
    (lastSnapshot.replies - firstSnapshot.replies) +
    (lastSnapshot.reposts - firstSnapshot.reposts) +
    (lastSnapshot.quotes - firstSnapshot.quotes);

  const durationMinutes =
    (lastSnapshot.timestamp - firstSnapshot.timestamp) / 1000 / 60;

  return durationMinutes > 0 ? totalInteractions / durationMinutes : 0;
}
```

---

## 響應式設計

| 斷點 | 佈局調整 |
|------|----------|
| Desktop (lg+) | 列表 + 右側趨勢圖 |
| Tablet (md) | 列表上方趨勢圖 |
| Mobile (sm) | 簡化列表（隱藏部分欄位）、趨勢圖收合 |

### Mobile 簡化欄位

| 顯示 | 隱藏 |
|------|------|
| 狀態、內容、Virality | 轉發率、趨勢圖 |

---

## 元件依賴

| 元件 | 來源 |
|------|------|
| Card, CardHeader, CardContent | @/components/ui/card |
| Table, TableHead, TableRow, TableCell | @/components/ui/table |
| Badge | @/components/ui/badge |
| Button | @/components/ui/button |
| Select | @/components/ui/select |
| Skeleton | @/components/ui/skeleton |
| Toast | @/components/ui/toast |
| LineChart | recharts |
| BarChart | recharts |

---

## 未來擴展

| 功能 | 說明 | 優先級 |
|------|------|--------|
| 自訂提示閾值 | 讓使用者自訂 Virality 閾值 | P2 |
| 比較模式 | 同時比較多篇貼文趨勢 | P3 |
| 標籤篩選 | 按貼文標籤篩選 | P3 |
| 歷史回顧 | 查看超過 72 小時的貼文早期表現 | P3 |

---

## 相關文件

- [Insights 總覽儀表板](insights-overview-dashboard.md) - 整體成效總覽
- [Virality Score](../06-metrics/virality-score.md) - 傳播力計算公式
- [Early Velocity](../06-metrics/early-velocity.md) - 早期速度指標
- [Engagement Rate](../06-metrics/engagement-rate.md) - 互動率計算公式
