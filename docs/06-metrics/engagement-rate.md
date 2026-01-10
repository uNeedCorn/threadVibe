# Engagement Rate（互動率）

## 指標目的

衡量貼文的整體互動健康度，反映內容引發用戶參與的能力。

---

## 用途

| 場景 | 說明 |
|------|------|
| **貼文成效評估** | 判斷單則貼文表現好不好 |
| **內容策略優化** | 比較不同類型內容的互動表現 |
| **帳號健康監測** | 計算平均 ER 追蹤帳號整體狀態 |
| **出圈判斷** | ER > 10% 代表有出圈潛力 |

---

## 計算公式

```
Engagement Rate = (likes + replies + reposts + quotes) / views × 100%
```

### 參數說明

| 參數 | 說明 |
|------|------|
| `likes` | 按讚數 |
| `replies` | 回覆數 |
| `reposts` | 轉發數 |
| `quotes` | 引用數 |
| `views` | 曝光數 |

### 程式碼範例

```typescript
function calculateEngagementRate(
  likes: number,
  replies: number,
  reposts: number,
  quotes: number,
  views: number
): number {
  if (views === 0) return 0;
  return ((likes + replies + reposts + quotes) / views) * 100;
}
```

---

## 基準值

| 等級 | 數值 | 說明 |
|------|------|------|
| 低 | < 3% | 表現不佳 |
| 一般 | 3-5% | 平均表現 |
| 好 | 5-6% | 好表現（2026 年 Threads 平均） |
| 優秀 | 6-10% | 表現優異 |
| 出圈 | > 10% | 有出圈潛力 |

---

## 適用層級

| 層級 | 說明 |
|------|------|
| **Post-level** | 單則貼文的 ER |
| **Account-level** | 多則貼文的平均 ER |

---

## 決議過程

### 討論背景

制定指標時討論了兩種公式選項：

| 選項 | 公式 | 說明 |
|------|------|------|
| A（官方版） | `(likes + replies + reposts + quotes) / views` | 與 Threads 官方一致 |
| B（含 shares） | `(likes + replies + reposts + quotes + shares) / views` | 納入所有互動 |

### 決議結果

**選擇 A（官方版），不含 Shares**

理由：
1. 與 Threads 官方定義一致
2. 方便對標官方基準值（5-6%）
3. Shares 在官方 ER 公式中被排除

### 關於 Clicks

另有討論是否納入 Clicks：

**決議：不含 Clicks**

理由：
1. ER 專注「平台內社交互動」
2. Clicks 是「轉化行為」（離開平台）
3. Clicks 單獨用 Click Rate 追蹤

---

## 相關指標

| 指標 | 說明 |
|------|------|
| [Virality Score](virality-score.md) | 病毒傳播潛力（加權版本） |
| [Repost Rate](repost-rate.md) | 單獨的轉發率 |
| [Click Rate](click-rate.md) | 轉化追蹤 |

---

## 參考資料

- Threads 官方 Insights
- 2026 年 Threads 平均 ER 約 5-6%
