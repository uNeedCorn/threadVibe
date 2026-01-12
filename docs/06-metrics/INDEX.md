# 指標體系總覽

## 概述

本文件定義 ThreadsVibe 使用的所有成效指標，包含計算公式、用途說明與決議過程。

指標設計基於：
- [Threads 官方 Insights](https://developers.facebook.com/docs/threads/insights)
- 2026 年 Threads 演算法趨勢（Replies 權重最高）
- 問題導向設計（回答社群經營常見問題）

---

## 指標分類

### 基礎 Rate 指標

可靜態顯示（總覽頁），也可時間序列呈現（貼文詳情頁）。

| 指標 | 文件 | 適用層級 | 說明 |
|------|------|----------|------|
| Engagement Rate | [engagement-rate.md](engagement-rate.md) | Both | 互動率 |
| Reply Rate | [reply-rate.md](reply-rate.md) | Post | 回覆率（演算法王道） |
| Repost Rate | [repost-rate.md](repost-rate.md) | Post | 轉發率 |
| Quote Rate | [quote-rate.md](quote-rate.md) | Post | 引用率 |

### 綜合評分指標

加權計算，適合時間序列分解顯示。

| 指標 | 文件 | 適用層級 | 說明 |
|------|------|----------|------|
| Virality Score | [virality-score.md](virality-score.md) | Post | 病毒傳播分數 |

### 獨有指標（Proprietary）

ThreadsVibe 專屬指標，於 API 端計算。

| 指標 | 文件 | 適用層級 | 說明 |
|------|------|----------|------|
| Engagement Lead Score | [engagement-lead-score.md](engagement-lead-score.md) | Post | 互動領先指數（點火判斷） |
| Heat Type | [heat-type.md](heat-type.md) | Post | 熱力類型（早熱/慢熱/穩定） |
| Diffusion Rate (R̂_t) | [diffusion-modeling.md](diffusion-modeling.md) | Post | 擴散動態（加速/減速判斷） |

### 成長類指標

天生需要多時間點資料，用於趨勢分析。

| 指標 | 文件 | 適用層級 | 說明 |
|------|------|----------|------|
| Early Velocity | [early-velocity.md](early-velocity.md) | Post | 早期互動速度 |
| Growth Multiple | [growth-multiple.md](growth-multiple.md) | Post | 曝光成長倍數 |
| Follower Growth | [follower-growth.md](follower-growth.md) | Account | 粉絲成長 |

### 擴散建模（Algorithm Notes）

以時間序列的方式描述「曝光 → 採納 → 傳播」，並在缺少 `shares` 等欄位時提供可落地的推估方法。

| 指標 | 文件 | 適用層級 | 說明 |
|------|------|----------|------|
| Diffusion Modeling | [diffusion-modeling.md](diffusion-modeling.md) | Post | 用 `views/reposts` 估 `lift`（出圈代理）與類 `R̂_t`（加速/衰退） |

---

## 指標呈現方式

指標的呈現取決於**使用情境**，而非指標本身：

| 頁面 | 呈現方式 | 範例 |
|------|----------|------|
| **總覽頁** | 靜態數值 | 「平均 ER 5.8%」 |
| **貼文詳情頁** | 時間序列圖表 | ER 變化曲線（1h → 24h） |

### 貼文詳情頁的時間序列呈現

| 指標類型 | 圖表內容 |
|----------|----------|
| Rate 指標 | 數值隨時間變化曲線 |
| Virality Score | 分數變化 + 各互動類型貢獻分解 |
| 成長類指標 | 累積曲線 + 關鍵時間點標記 |

### 時間呈現模式

| 模式 | 說明 | 用途 |
|------|------|------|
| **關鍵時間點** | 1h / 3h / 6h / 24h 快照 | 預設顯示，快速掃描 |
| **完整曲線** | 30 分鐘顆粒度折線圖 | 可展開，詳細分析 |

---

## 原始數據（從 Threads API 取得）

### 貼文層級

| 欄位 | 說明 | API 支援 |
|------|------|----------|
| `views` | 曝光數 | ✅ |
| `likes` | 按讚數 | ✅ |
| `replies` | 回覆數 | ✅ |
| `reposts` | 轉發數 | ✅ |
| `quotes` | 引用數 | ✅ |
| `shares` | 分享數 | ✅ |

### 帳號層級

| 欄位 | 說明 | API 支援 |
|------|------|----------|
| `followers_count` | 粉絲數 | ✅ |
| `views` | 7 天曝光 | ✅ |
| `likes` | 7 天按讚 | ✅ |

---

## 演算法權重參考

根據 2026 年 Threads 演算法趨勢：

```
Replies > Reposts > Likes
```

- **Replies**：權重最高，代表真實對話
- **Reposts/Quotes**：擴散力指標
- **Likes**：基本好感，權重最低

---

## 基準值參考

| 指標 | 基準值 | 說明 |
|------|--------|------|
| Engagement Rate | 5-6% | 好表現 |
| Engagement Rate | >10% | 出圈潛力 |
| Reply Rate | >0.5% | 對話引發力佳 |
| Reply Rate | >1% | 演算法極度偏好 |
| Repost/Quote Rate | >1% | 有擴散潛力 |
| Repost/Quote Rate | >2% | 爆紅跡象 |
| Early Velocity | >0.05 | 有爆紅潛力 |
| Growth Multiple | >3x | 首小時小爆預警 |
| Growth Multiple | >5x | 爆紅 |

---

## 資料架構

### 三層式架構

| Layer | 用途 | 說明 |
|-------|------|------|
| L1 Snapshot | 原始快照 | 每 15 分鐘存一筆，不可變 |
| L3 Current | 當前值 | 每次同步更新，快速查詢 |

> 註：L2 Delta 已移除，成長率改由 L1 即時計算。

### 時間顆粒度

- **同步頻率**：每 15 分鐘
- **顯示顆粒度**：30 分鐘（聚合顯示）

---

## 備註清單

| 項目 | 狀態 | 說明 |
|------|------|------|
| 即時警報功能 | 📌 後續迭代 | 爆紅預測推送通知（Telegram/Email） |
| 長尾貼文圖表 | 📌 後續迭代 | 追蹤舊文流量變化（常青內容、舊文爆發、生命週期） |
| 情緒分析 | 📌 後續迭代 | 分析 Replies 正負面比例 |
| Non-Followers Ratio | ❌ 無法實現 | API 不支援 |
| Clicks | ❌ 無法實現 | API 不支援 |

---

## 相關資源

- [Threads API 文件](https://developers.facebook.com/docs/threads)
- [排程同步主流程](../04-backend/sync/scheduled-sync.md)
- [Cron 排程設定](../04-backend/jobs/cron-setup.md)
