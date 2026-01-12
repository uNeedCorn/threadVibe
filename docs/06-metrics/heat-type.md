# Heat Type（熱力類型）

> **類型**：獨有指標
> **適用層級**：Post
> **計算位置**：API（insights-radar Edge Function）
> **最後更新**：2026-01-11

---

## 概述

Heat Type 根據貼文前 3 小時的 Virality Delta 分布，將貼文分類為三種熱力類型：早熱（early）、慢熱（slow）、穩定（steady）。

---

## 類型定義

| 類型 | 英文 | 條件 | 說明 |
|------|------|------|------|
| 早熱 | early | 前半 Delta > 後半 Delta × 1.2 | 前期爆發力強，早期互動密集 |
| 慢熱 | slow | 後半 Delta > 前半 Delta × 1.2 | 後期逐漸增溫，需要時間發酵 |
| 穩定 | steady | 前後半 Delta 接近 | 平穩發展，互動分布均勻 |

---

## 計算方式

### 1. 時間區間劃分

將前 3 小時切分為 12 個 15 分鐘區間（bucket）：

```
Bucket 0: 0-15 分鐘
Bucket 1: 15-30 分鐘
...
Bucket 11: 165-180 分鐘
```

### 2. 計算每區間 Virality Delta

```typescript
// 每區間的增量
const viewsDelta = currentViews - previousViews;
const likesDelta = currentLikes - previousLikes;
const repliesDelta = currentReplies - previousReplies;
const repostsDelta = currentReposts - previousReposts;
const quotesDelta = currentQuotes - previousQuotes;

// 加權互動增量
const weightedDelta =
  repliesDelta * 3 +
  repostsDelta * 2.5 +
  quotesDelta * 2 +
  likesDelta * 1;

// Virality Delta
const viralityDelta = viewsDelta > 0
  ? (weightedDelta / viewsDelta) * 100
  : 0;
```

### 3. 計算前後半總 Delta

```typescript
// 前半（Bucket 0-5）
const earlyDelta = cells.slice(0, 6).reduce((sum, c) => sum + c.viralityDelta, 0);

// 後半（Bucket 6-11）
const lateDelta = cells.slice(6, 12).reduce((sum, c) => sum + c.viralityDelta, 0);
```

### 4. 判斷類型

```typescript
function determineHeatType(earlyDelta: number, lateDelta: number): HeatType {
  if (earlyDelta > lateDelta * 1.2) {
    return 'early';
  } else if (lateDelta > earlyDelta * 1.2) {
    return 'slow';
  } else {
    return 'steady';
  }
}
```

---

## 視覺化

在發文追蹤雷達的「早期訊號熱力圖」中：
- 每列代表一則貼文
- 每格代表一個 15 分鐘區間
- 顏色深淺：灰色 → 淺琥珀 → 深琥珀（強度 0 → 1）
- 最右側欄顯示 Heat Type 標籤

---

## 強度正規化

為了讓不同貼文的熱力圖可比較，需要進行全局正規化：

```typescript
function normalizeHeatmapIntensity(posts: RadarPost[]): void {
  // 找出所有貼文中的最大 Virality Delta
  const maxDelta = Math.max(
    ...posts.flatMap(p => p.heatmap?.cells.map(c => c.viralityDelta) || [0])
  );

  // 正規化每個 cell 的強度
  posts.forEach(post => {
    if (post.heatmap) {
      post.heatmap.cells.forEach(cell => {
        cell.intensity = maxDelta > 0 ? cell.viralityDelta / maxDelta : 0;
      });
    }
  });
}
```

---

## 使用情境

| 類型 | 特徵 | 建議 |
|------|------|------|
| 早熱 | 發布後立即獲得高互動 | 黃金內容，研究成功模式 |
| 慢熱 | 需要時間發酵才受關注 | 持續觀察，可能是長尾內容 |
| 穩定 | 互動分布均勻 | 內容穩定，可作為基準 |

---

## 相關指標

- [Virality Score](virality-score.md) - 傳播力分數
- [Engagement Lead Score](engagement-lead-score.md) - 互動領先指數
- [Early Velocity](early-velocity.md) - 早期互動速度

---

## 相關文件

- [發文追蹤雷達](../05-frontend/post-tracking-dashboard.md)
- [insights-radar Edge Function](../04-backend/functions/insights-radar.md)
