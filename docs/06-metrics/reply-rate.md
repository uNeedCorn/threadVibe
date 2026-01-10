# Reply Rate（回覆率）

## 指標目的

衡量貼文引發回覆的比例，反映內容引發真實對話的能力。這是 Threads 演算法最重視的互動類型。

---

## 用途

| 場景 | 說明 |
|------|------|
| **演算法友好度評估** | Replies 是演算法王道，Reply Rate 高 = 演算法偏好 |
| **對話引發力評估** | 判斷內容是否成功引發討論 |
| **內容優化** | 找出高回覆率的內容模式 |

---

## 計算公式

```
Reply Rate = replies / views × 100%
```

### 參數說明

| 參數 | 說明 |
|------|------|
| `replies` | 回覆數 |
| `views` | 曝光數 |

### 程式碼範例

```typescript
function calculateReplyRate(replies: number, views: number): number {
  if (views === 0) return 0;
  return (replies / views) * 100;
}
```

---

## 基準值

| 等級 | 數值 | 說明 |
|------|------|------|
| 低 | < 0.3% | 較少引發對話 |
| 一般 | 0.3-0.5% | 平均表現 |
| 好 | 0.5-1% | 對話引發力佳 |
| 優秀 | > 1% | 演算法極度偏好 |

---

## 適用層級

| 層級 | 說明 |
|------|------|
| **Post-level** | 單則貼文的回覆率 |

---

## 決議過程

### 討論背景

根據 2026 年 Threads 演算法趨勢：

```
Replies > Reposts > Likes
```

- Threads 演算法偏好「真實對話」
- Replies 代表最深度的互動
- 高 Reply Rate 的貼文更容易被演算法推薦

### 決議結果

**新增 Reply Rate 為獨立指標**

理由：
1. **演算法最重視**：Replies 權重最高，值得獨立追蹤
2. **內容策略價值**：幫助用戶識別「能引發對話」的內容模式
3. **與其他 Rate 指標一致**：已有 Repost Rate、Quote Rate，Reply Rate 補齊系列

---

## 與 Virality Score 的關係

| 指標 | 特性 |
|------|------|
| **Reply Rate** | 單獨追蹤回覆比例 |
| **Virality Score** | Replies 權重為 3（最高），綜合計算傳播力 |

Reply Rate 讓用戶專注於「對話引發力」，Virality Score 則是綜合評估。

---

## 相關指標

| 指標 | 說明 |
|------|------|
| [Engagement Rate](engagement-rate.md) | 整體互動率 |
| [Virality Score](virality-score.md) | 病毒傳播潛力（Replies 權重 3） |
| [Repost Rate](repost-rate.md) | 轉發率 |
| [Quote Rate](quote-rate.md) | 引用率 |

---

## 參考資料

- 2026 年 Threads 演算法：Replies > Reposts > Likes
- Threads 偏好「真實對話」，rage bait 被壓制
