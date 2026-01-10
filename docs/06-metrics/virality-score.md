# Virality Score（病毒傳播分數）

## 指標目的

衡量貼文的病毒傳播潛力，透過加權計算反映不同互動類型對擴散的貢獻度。

---

## 用途

| 場景 | 說明 |
|------|------|
| **爆紅潛力評估** | 判斷貼文是否有病毒式擴散的潛力 |
| **內容排序** | 找出最具傳播力的貼文 |
| **即時警報** | 分數突然飆升時發出通知 |

---

## 計算公式

```
Virality Score = (replies × 3 + reposts × 2.5 + quotes × 2 + likes) / views × 100
```

### 權重說明

| 參數 | 權重 | 理由 |
|------|------|------|
| `replies` | 3 | 演算法王道，真實對話，權重最高 |
| `reposts` | 2.5 | 強擴散力，直接傳播給追蹤者 |
| `quotes` | 2 | 擴散 + 二次創作，引發討論 |
| `likes` | 1 | 基本好感，權重最低 |

### 程式碼範例

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
```

---

## 適用層級

| 層級 | 說明 |
|------|------|
| **Post-level** | 主要用於單則貼文分析 |

---

## 決議過程

### 討論背景

原始公式：
```
spreadScore = reposts × 3 + quotes × 2.5 + shares × 3
engagementScore = likes + replies × 1.5
viralityScore = (spreadScore × 2 + engagementScore) / views × 100
```

問題：
1. Replies 權重只有 1.5，但 Threads 演算法中 Replies 權重最高
2. 包含 Shares，但官方 ER 不含 Shares
3. 公式較複雜

### 決議結果

**調整為強調 Replies 的簡化版本**

```
Virality Score = (replies × 3 + reposts × 2.5 + quotes × 2 + likes) / views × 100
```

調整原因：
1. **Replies 權重提升至 3**：符合 Threads 演算法「Replies > Reposts > Likes」
2. **移除 Shares**：與 Engagement Rate 保持一致
3. **簡化公式**：更容易理解和維護

### 權重依據

根據 2026 年 Threads 演算法趨勢：

```
Replies > Reposts > Likes
```

- Threads 演算法偏好「真實對話」
- Replies 代表深度互動，最能觸發演算法推薦
- Reposts/Quotes 代表擴散力
- Likes 是最輕量的互動

---

## 與 Engagement Rate 的差異

| 指標 | 特性 |
|------|------|
| **Engagement Rate** | 無加權，純粹計算互動總量比例 |
| **Virality Score** | 有加權，強調傳播力強的互動類型 |

---

## 相關指標

| 指標 | 說明 |
|------|------|
| [Engagement Rate](engagement-rate.md) | 無加權的互動率 |
| [Early Velocity](early-velocity.md) | 早期互動速度 |
| [Growth Multiple](growth-multiple.md) | 曝光成長倍數 |

---

## 參考資料

- Threads 演算法權重：Replies > Reposts > Likes
- 2026 年 Threads 偏好「真實對話」，rage bait 被壓制
