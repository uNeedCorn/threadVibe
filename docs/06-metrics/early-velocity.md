# Early Velocity（早期互動速度）

## 指標目的

衡量貼文發布後早期的互動累積速度，預測貼文是否有爆紅潛力。

---

## 用途

| 場景 | 說明 |
|------|------|
| **爆紅預測** | 早期速度快，演算法更可能推薦 |
| **即時警報** | 速度異常快時發出通知 |
| **最佳發文時間** | 比較不同時段的早期表現 |

---

## 計算公式

```
Early Velocity = total_interactions / hours_since_publish
```

### 參數說明

| 參數 | 說明 |
|------|------|
| `total_interactions` | 互動總數（likes + replies + reposts + quotes） |
| `hours_since_publish` | 發布後經過的小時數 |

### 程式碼範例

```typescript
function calculateEarlyVelocity(
  likes: number,
  replies: number,
  reposts: number,
  quotes: number,
  publishedAt: Date
): number {
  const hoursSincePublish =
    (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60);

  if (hoursSincePublish === 0) return 0;

  const totalInteractions = likes + replies + reposts + quotes;
  return totalInteractions / hoursSincePublish;
}
```

---

## 基準值

| 等級 | 數值 | 說明 |
|------|------|------|
| 低 | < 0.02 | 互動緩慢 |
| 一般 | 0.02-0.05 | 平均速度 |
| 快 | > 0.05 | 有爆紅潛力 |
| 爆發 | > 0.1 | 高度關注 |

---

## 適用層級

| 層級 | 說明 |
|------|------|
| **Post-level** | 單則貼文的早期速度 |

---

## 觀測時間窗口

| 時間點 | 意義 |
|--------|------|
| **1 小時** | 最早期信號，演算法判斷黃金期 |
| **3 小時** | 早期趨勢確認 |
| **6 小時** | 是否進入推薦池 |
| **24 小時** | 完整早期週期 |

---

## 決議過程

### 討論背景

根據 2026 年 Threads 演算法趨勢：
- 早期互動速度是演算法推薦的重要信號
- 發布後 1-3 小時是黃金期
- 速度越快，越可能被推薦給更多用戶

### 決議結果

採用 `total_interactions / hours_since_publish` 計算互動累積速度。

### 計算時機

- 需要多時間點資料（L1 Snapshot）
- 計算時從 L1 取得時間序列資料
- 可即時計算，不需預存

---

## 相關指標

| 指標 | 說明 |
|------|------|
| [Growth Multiple](growth-multiple.md) | 曝光成長倍數 |
| [Virality Score](virality-score.md) | 病毒傳播潛力 |

---

## 參考資料

- Threads 演算法：早期互動速度影響推薦權重
- Early Velocity > 0.05 有爆紅潛力
