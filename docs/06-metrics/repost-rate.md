# Repost Rate（轉發率）

## 指標目的

衡量貼文被轉發的比例，反映內容的擴散力和二次傳播能力。

---

## 用途

| 場景 | 說明 |
|------|------|
| **擴散力評估** | 判斷內容是否容易被分享 |
| **爆紅預測** | Repost Rate > 2% 是爆紅跡象 |
| **內容優化** | 找出高轉發率的內容類型 |

---

## 計算公式

```
Repost Rate = reposts / views × 100%
```

### 參數說明

| 參數 | 說明 |
|------|------|
| `reposts` | 轉發數 |
| `views` | 曝光數 |

### 程式碼範例

```typescript
function calculateRepostRate(reposts: number, views: number): number {
  if (views === 0) return 0;
  return (reposts / views) * 100;
}
```

---

## 基準值

| 等級 | 數值 | 說明 |
|------|------|------|
| 低 | < 0.5% | 擴散力弱 |
| 一般 | 0.5-1% | 平均表現 |
| 好 | > 1% | 有擴散潛力 |
| 爆紅 | > 2% | 爆紅跡象 |

---

## 適用層級

| 層級 | 說明 |
|------|------|
| **Post-level** | 單則貼文的轉發率 |

---

## 決議過程

### 討論背景

轉發率是衡量內容擴散力的核心指標之一。根據 Threads 指南：

- 轉發代表用戶願意將內容分享給自己的追蹤者
- 是出圈的重要信號
- Repost Rate > 1% 表示有擴散潛力

### 決議結果

採用標準公式 `reposts / views × 100%`，直接計算轉發比例。

---

## 相關指標

| 指標 | 說明 |
|------|------|
| [Quote Rate](quote-rate.md) | 引用率（類似指標） |
| [Virality Score](virality-score.md) | 綜合傳播分數 |

---

## 參考資料

- Threads 指南：Repost Rate > 1% 有擴散潛力，> 2% 爆紅跡象
