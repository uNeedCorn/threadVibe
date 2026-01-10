# Follower Growth（粉絲成長）

## 指標目的

追蹤帳號粉絲數的變化，衡量帳號整體成長健康度。

---

## 用途

| 場景 | 說明 |
|------|------|
| **帳號健康監測** | 追蹤粉絲數長期趨勢 |
| **內容策略驗證** | 確認策略是否帶來粉絲成長 |
| **爆文關聯分析** | 觀察爆文是否帶動漲粉 |

---

## 計算公式

### 粉絲淨成長

```
Follower Growth = current_followers - previous_followers
```

### 粉絲成長率

```
Follower Growth Rate = (current_followers - previous_followers) / previous_followers × 100%
```

### 參數說明

| 參數 | 說明 |
|------|------|
| `current_followers` | 當前粉絲數 |
| `previous_followers` | 前一時間點粉絲數 |

### 程式碼範例

```typescript
function calculateFollowerGrowth(
  currentFollowers: number,
  previousFollowers: number
): { growth: number; rate: number } {
  const growth = currentFollowers - previousFollowers;
  const rate = previousFollowers === 0
    ? 0
    : (growth / previousFollowers) * 100;

  return { growth, rate };
}
```

---

## 觀測時間窗口

| 區間 | 用途 |
|------|------|
| **日成長** | 每日淨增減 |
| **週成長** | 7 天趨勢 |
| **月成長** | 30 天長期趨勢 |

---

## 適用層級

| 層級 | 說明 |
|------|------|
| **Account-level** | 帳號層級指標 |

---

## 決議過程

### 討論背景

粉絲成長是帳號經營的核心 KPI：
- 反映帳號整體吸引力
- 可與單篇貼文成效交叉分析
- 驗證內容策略是否有效

### 決議結果

- 追蹤 `followers_count` 的變化
- 提供絕對成長數和成長率兩種指標
- 從 L1 帳號 Insights Snapshot 計算

### 資料來源

Threads API 支援 `followers_count` 欄位：
- 存於 `workspace_threads_accounts.current_followers`（L3）
- 快照存於 `workspace_threads_account_insights`（L1）

---

## 相關指標

| 指標 | 說明 |
|------|------|
| [Engagement Rate](engagement-rate.md) | 互動率（帳號平均） |

---

## 參考資料

- Threads API：支援 followers_count
- 帳號 Insights 每次同步更新
