# Quote Rate（引用率）

## 指標目的

衡量貼文被引用的比例，反映內容引發二次創作和討論的能力。

---

## 用途

| 場景 | 說明 |
|------|------|
| **討論度評估** | 引用代表用戶想加上自己的觀點 |
| **二次創作追蹤** | 內容是否引發衍生討論 |
| **爆紅預測** | Quote Rate > 2% 是爆紅跡象 |

---

## 計算公式

```
Quote Rate = quotes / views × 100%
```

### 參數說明

| 參數 | 說明 |
|------|------|
| `quotes` | 引用數 |
| `views` | 曝光數 |

### 程式碼範例

```typescript
function calculateQuoteRate(quotes: number, views: number): number {
  if (views === 0) return 0;
  return (quotes / views) * 100;
}
```

---

## 基準值

| 等級 | 數值 | 說明 |
|------|------|------|
| 低 | < 0.5% | 較少引發討論 |
| 一般 | 0.5-1% | 平均表現 |
| 好 | > 1% | 有擴散潛力 |
| 爆紅 | > 2% | 爆紅跡象 |

---

## 適用層級

| 層級 | 說明 |
|------|------|
| **Post-level** | 單則貼文的引用率 |

---

## 與 Repost Rate 的差異

| 指標 | 特性 |
|------|------|
| **Repost Rate** | 純轉發，不加評論 |
| **Quote Rate** | 轉發 + 加上自己的評論，代表更深度的互動 |

---

## 決議過程

### 討論背景

Quote（引用）在 Threads 中是一種特殊的互動：
- 用戶轉發時加上自己的觀點
- 代表內容引發了「討論」而非單純「分享」
- 在 Virality Score 中權重為 2（介於 Reposts 和 Likes 之間）

### 決議結果

採用標準公式 `quotes / views × 100%`，獨立追蹤引用比例。

---

## 相關指標

| 指標 | 說明 |
|------|------|
| [Repost Rate](repost-rate.md) | 轉發率（類似指標） |
| [Virality Score](virality-score.md) | 綜合傳播分數 |

---

## 參考資料

- Threads 指南：Quote Rate > 1% 有擴散潛力，> 2% 爆紅跡象
