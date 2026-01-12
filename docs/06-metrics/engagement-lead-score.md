# Engagement Lead Score（互動領先指數）

> **類型**：獨有指標
> **適用層級**：Post
> **計算位置**：API（insights-radar Edge Function）
> **最後更新**：2026-01-11

---

## 概述

Engagement Lead Score 衡量貼文發布後，互動訊號是否領先曝光增量。這是一個早期爆紅偵測指標，用於判斷貼文是否正在「點火」。

---

## 計算公式

```
Engagement Lead Score = 累計互動百分比 - 累計曝光百分比
```

### 計算步驟

1. 取前 3 小時的 15 分鐘趨勢資料
2. 計算各時間點的累計互動數：`likes + replies + reposts + quotes`
3. 計算各時間點的累計曝光數：`views`
4. 轉換為百分比（相對於最終值）
5. 取最終時間點的差值

### 範例

假設一則貼文前 3 小時的數據：

| 時間 | 累計互動 | 互動% | 累計曝光 | 曝光% |
|------|----------|-------|----------|-------|
| 0:30 | 50 | 25% | 500 | 10% |
| 1:00 | 100 | 50% | 1500 | 30% |
| 1:30 | 150 | 75% | 3000 | 60% |
| 2:00 | 180 | 90% | 4000 | 80% |
| 3:00 | 200 | 100% | 5000 | 100% |

**Engagement Lead Score = 100% - 100% = 0**

但如果互動在早期就達到高比例：

| 時間 | 互動% | 曝光% | 差值 |
|------|-------|-------|------|
| 0:30 | 40% | 10% | +30 |
| 1:00 | 70% | 30% | +40 |
| 3:00 | 100% | 100% | 0 |

表示在 1 小時時，互動已達 70%，但曝光才 30%，這代表早期互動強勁。

---

## 數值解讀

| 分數範圍 | 解讀 | 意義 |
|----------|------|------|
| > 20 | 強互動領先 | 早期互動非常強勁，正在「點火」 |
| 10 ~ 20 | 互動領先 | 互動訊號領先曝光，有爆紅潛力 |
| -10 ~ 10 | 平衡 | 互動與曝光同步增長 |
| -20 ~ -10 | 曝光領先 | 觸及廣但互動低，可能是推播流量 |
| < -20 | 強曝光領先 | 大量曝光但互動偏低，內容吸引力不足 |

---

## 視覺化

在發文追蹤雷達的「早期點火曲線」圖表中：
- 橙色曲線：互動訊號累計百分比
- 青色曲線：曝光增量累計百分比
- 橙色在上方 = 互動領先（正在點火）

---

## 實作

```typescript
function calculateIgnitionMetrics(trend: TrendPoint[]): IgnitionMetrics {
  const first3Hours = trend.filter(t =>
    t.timestamp <= publishedAt + 3 * 60 * 60 * 1000
  );

  const totalEngagement = first3Hours[first3Hours.length - 1].totalEngagement;
  const totalViews = first3Hours[first3Hours.length - 1].views;

  const dataPoints = first3Hours.map(point => ({
    timestamp: point.timestamp,
    timeLabel: formatTime(point.timestamp),
    engagementPct: (point.cumulativeEngagement / totalEngagement) * 100,
    viewsPct: (point.cumulativeViews / totalViews) * 100
  }));

  const finalPoint = dataPoints[dataPoints.length - 1];
  const engagementLeadScore = finalPoint.engagementPct - finalPoint.viewsPct;

  return {
    dataPoints,
    engagementLeadScore,
    peakEngagementTime: findPeakTime(dataPoints, 'engagement'),
    peakViewsTime: findPeakTime(dataPoints, 'views')
  };
}
```

---

## 相關指標

- [Virality Score](virality-score.md) - 傳播力分數
- [Heat Type](heat-type.md) - 熱力類型分類
- [Early Velocity](early-velocity.md) - 早期互動速度

---

## 相關文件

- [發文追蹤雷達](../05-frontend/post-tracking-dashboard.md)
- [insights-radar Edge Function](../04-backend/functions/insights-radar.md)
