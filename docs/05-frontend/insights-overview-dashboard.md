# Insights 總覽儀表板規格

> **頁面路徑**：`/insights`
> **檔案位置**：`frontend/app/(auth)/insights/page.tsx`
> **最後更新**：2026-01-11

---

## 概述

總覽頁面是 Insights 的首頁，提供帳號成效的快速概覽。採用「數據儀表板」設計，讓用戶一眼掌握本週/本月的整體表現。

### 設計原則

- **一眼掌握**：重要指標突出顯示
- **趨勢對比**：與上期/基準比較
- **視覺化**：圖表優先於數字表格

---

## 期間切換

| 模式 | 時間範圍 | 對比基準 | 趨勢圖刻度 |
|------|----------|----------|------------|
| 本週 | 近 7 天 | 上週（前 7 天） | 小時 |
| 本月 | 近 30 天 | 上月（前 30 天） | 日 |

---

## 儀表板組件

### 1. 帳號資訊卡片

**位置**：第一列左側（1/4 寬度）

| 欄位 | 資料來源 | 說明 |
|------|----------|------|
| 頭貼 | `profile_pic_url` | 圓形頭像 |
| 顯示名稱 | `name` 或 `username` | 優先顯示 name |
| 帳號 | `@username` | 灰色次要文字 |
| 追蹤者數 | `current_followers_count` | 格式化顯示（K/M） |
| 追蹤者成長 | 計算值 | vs 上週/上月 百分比 |

**特殊狀態**：
- 追蹤者數為 0：顯示 `--` 和提示「追蹤數需達到 100 才能顯示，請加油！」

**資料來源**：
- `workspace_threads_accounts`
- `workspace_threads_account_insights`（歷史對比）

---

### 2. 發文數卡片

**位置**：第一列中間偏左（1/4 寬度）

| 欄位 | 說明 |
|------|------|
| 發文數 | 當期發布的貼文數量 |
| 成長率 | vs 上期 百分比 |
| Benchmark | 高於/低於基準 X% |

**Benchmark 計算**：
- 週模式：與平均每週發文數比較
- 月模式：與平均每月發文數比較
- 需至少 10 篇貼文才顯示 Benchmark

**資料來源**：
- `workspace_threads_posts`（`published_at` 篩選）

---

### 3. 發文時間熱力圖

**位置**：第一列右側（2/4 寬度）

| 維度 | 說明 |
|------|------|
| Y 軸 | 星期（日~六） |
| X 軸 | 小時（0~23） |
| 顏色 | Teal 色階（發文越多越深） |

**互動**：
- Hover 顯示 tooltip：時間、發文數、總曝光數

**色階**（Teal）：
```
少 ← F0FDFA → CCFBF1 → 99F6E4 → 5EEAD4 → 2DD4BF → 14B8A6 → 0D9488 → 0F766E → 多
```

**資料來源**：
- `workspace_threads_posts`（`published_at` 分組）

---

### 4. 發文分類統計（直條圖）

**位置**：第二列左側（1/2 寬度）

| 設定 | 值 |
|------|------|
| 圖表類型 | 垂直直條圖 |
| X 軸 | 標籤名稱 |
| Y 軸 | 發文數量 |
| 最大標籤數 | 8 個（+ 未分類） |
| 排序 | 按數量高到低 |

**說明文字**：
> 一篇貼文可能有多個標籤，因此各標籤數量總和可能大於發文總數

**資料來源**：
- `workspace_threads_posts.ai_selected_tags`

---

### 5. 曝光數佔比（圓餅圖）

**位置**：第二列右側（1/2 寬度）

| 設定 | 值 |
|------|------|
| 圖表類型 | 環形圓餅圖（Donut） |
| 資料 | 各標籤的總曝光數 |
| 最大標籤數 | 6 個（+ 未分類） |
| 排序 | 按曝光數高到低 |

**圖例**：
- 右側顯示各標籤名稱和佔比百分比

**資料來源**：
- `workspace_threads_posts.ai_selected_tags`
- `workspace_threads_posts.current_views`

---

### 6. 成效趨勢折線圖

**位置**：第三列（全寬）

#### 圖表規格

| 設定 | 週模式 | 月模式 |
|------|--------|--------|
| X 軸刻度 | 每 6 小時（0, 6, 12, 18） | 每 5 天 |
| X 軸標籤 | 0 點顯示日期 + 時間 | 日期（M/D） |
| 資料粒度 | 小時 | 日 |

#### Y 軸設定

| 軸 | 位置 | 資料 | 顏色 |
|------|------|------|------|
| 左軸 | 左側 | 曝光數 | Teal 500 (#14B8A6) |
| 右軸 | 右側 | 互動率 | Amber 500 (#F59E0B) |

#### 線條樣式

| 線條 | 樣式 | 顏色 |
|------|------|------|
| 曝光數 | 曲線（monotone） | #14B8A6 |
| 互動率 | 曲線（monotone） | #F59E0B |

#### Tooltip 內容

| 欄位 | 說明 |
|------|------|
| 時間 | 週模式：M/D HH:00，月模式：M/D |
| 曝光數 | 該時段總曝光增量 |
| 互動率 | 該時段平均互動率（百分比） |
| 貼文明細 | Top 3 貼文（按曝光排序） |

**貼文明細格式**：
```
貼文文字（前 20 字）...
曝光 1.2K  互動率 5.23%
```

#### 資料來源

| 模式 | 資料表 | 計算方式 |
|------|--------|----------|
| 週模式 | `workspace_threads_post_metrics_hourly` | 相鄰時間桶差值 |
| 月模式 | `workspace_threads_post_metrics_daily` | 相鄰時間桶差值 |

**Delta 計算**：
```
delta = 當前時間桶快照值 - 上一個時間桶快照值
```

---

### 7. 成效 KPI 卡片

**位置**：第四列（3 欄）

| 卡片 | 值 | 成長率 | Benchmark | 圖示 |
|------|------|--------|-----------|------|
| 總曝光數 | 累計 views | vs 上期 | 週/月平均曝光 | Eye |
| 總互動數 | likes + replies + reposts + quotes | vs 上期 | 週/月平均互動 | Heart |
| 平均互動率 | 各貼文 engagement_rate 平均 | vs 上期 | 全時間平均互動率 | TrendingUp |

**成長率計算**：
```
growth = ((current - previous) / previous) * 100
```

**Benchmark 顯示條件**：
- 至少 10 篇貼文才顯示

**資料來源**：
- `workspace_threads_posts`（current_* 欄位）

---

### 8. 互動明細 KPI 卡片

**位置**：第五列（4 欄）

| 卡片 | 值 | 成長率 | Benchmark | 圖示 |
|------|------|--------|-----------|------|
| 讚 | 累計 likes | vs 上期 | 週/月平均讚數 | Heart |
| 回覆 | 累計 replies | vs 上期 | 週/月平均回覆數 | MessageSquare |
| 轉發 | 累計 reposts | vs 上期 | 週/月平均轉發數 | Repeat2 |
| 引用 | 累計 quotes | vs 上期 | 週/月平均引用數 | Quote |

**資料來源**：
- `workspace_threads_posts`（current_likes, current_replies, current_reposts, current_quotes）

---

## 資料結構

### TypeScript 介面

```typescript
interface AccountData {
  username: string;
  name: string | null;
  profilePicUrl: string | null;
  currentFollowers: number;
  followersGrowth: number;
}

interface KPIData {
  // 曝光
  totalViews: number;
  viewsGrowth: number;
  // 互動明細
  totalLikes: number;
  likesGrowth: number;
  totalReplies: number;
  repliesGrowth: number;
  totalReposts: number;
  repostsGrowth: number;
  totalQuotes: number;
  quotesGrowth: number;
  // 互動總計
  totalInteractions: number;
  interactionsGrowth: number;
  engagementRate: number;
  engagementGrowth: number;
  // 貼文
  postsCount: number;
  postsGrowth: number;
}

interface BenchmarkData {
  avgEngagementRate: number;
  avgPostsPerWeek: number;
  avgPostsPerMonth: number;
  avgViewsPerWeek: number;
  avgViewsPerMonth: number;
  avgInteractionsPerWeek: number;
  avgInteractionsPerMonth: number;
  avgLikesPerWeek: number;
  avgLikesPerMonth: number;
  avgRepliesPerWeek: number;
  avgRepliesPerMonth: number;
  avgRepostsPerWeek: number;
  avgRepostsPerMonth: number;
  avgQuotesPerWeek: number;
  avgQuotesPerMonth: number;
  totalPosts: number;
}

interface TrendDataPoint {
  timestamp: number;
  label: string;
  dateLabel?: string;
  views: number;
  interactions: number;
  engagementRate: number;
  postCount: number;
  postDetails: PostContribution[];
}

interface PostContribution {
  postId: string;
  text: string;
  views: number;
  interactions: number;
  engagementRate: number;
}
```

---

## 查詢策略

### 並行查詢

頁面載入時並行執行以下查詢：

| # | 查詢 | 資料表 | 用途 |
|---|------|--------|------|
| 1 | 帳號資料 | `workspace_threads_accounts` | 帳號卡片 |
| 2 | 當期貼文 | `workspace_threads_posts` | KPI、圖表 |
| 3 | 上期貼文 | `workspace_threads_posts` | 成長率計算 |
| 4 | 帳號歷史 | `workspace_threads_account_insights` | 追蹤者成長 |
| 5 | 全時間貼文 | `workspace_threads_posts` | Benchmark |
| 6 | Hourly 快照 | `workspace_threads_post_metrics_hourly` | 週趨勢圖 |
| 7 | Daily 快照 | `workspace_threads_post_metrics_daily` | 月趨勢圖 |

### 時間範圍

| 模式 | 當期起點 | 上期範圍 |
|------|----------|----------|
| 週 | now - 7 天 | (now - 14 天) ~ (now - 7 天) |
| 月 | now - 30 天 | (now - 60 天) ~ (now - 30 天) |

---

## 元件依賴

| 元件 | 來源 |
|------|------|
| Card, CardHeader, CardContent, CardTitle | @/components/ui/card |
| ChartContainer, ChartTooltip | @/components/ui/chart |
| Skeleton | @/components/ui/skeleton |
| Tabs, TabsList, TabsTrigger | @/components/ui/tabs |
| Avatar, AvatarImage, AvatarFallback | @/components/ui/avatar |
| BarChart, PieChart, LineChart | recharts |

---

## 圖表庫

使用 **Recharts** 繪製所有圖表：

| 圖表 | Recharts 元件 |
|------|---------------|
| 直條圖 | `<BarChart>` + `<Bar>` |
| 圓餅圖 | `<PieChart>` + `<Pie>` |
| 折線圖 | `<LineChart>` + `<Line>` |
| 熱力圖 | 自訂 SVG（非 Recharts） |

---

## 色彩規範

### Teal 色階（主題色）

| 名稱 | HEX | 用途 |
|------|-----|------|
| Teal 50 | #F0FDFA | 熱力圖最淺 |
| Teal 100 | #CCFBF1 | - |
| Teal 200 | #99F6E4 | - |
| Teal 300 | #5EEAD4 | - |
| Teal 400 | #2DD4BF | - |
| Teal 500 | #14B8A6 | 主色、曝光數線條 |
| Teal 600 | #0D9488 | - |
| Teal 700 | #0F766E | 熱力圖最深 |

### 輔助色

| 用途 | 顏色 | HEX |
|------|------|-----|
| 互動率線條 | Amber 500 | #F59E0B |
| 未分類標籤 | Stone 400 | #A8A29E |
| 正成長 | Green 600 | - |
| 負成長 | Red 600 | - |
| 高於基準 | Blue 600 | - |
| 低於基準 | Orange 600 | - |

---

## 響應式設計

| 斷點 | 佈局調整 |
|------|----------|
| Desktop (lg+) | 4 欄第一列、2 欄第二列、4 欄 KPI |
| Tablet (md) | 2 欄 KPI |
| Mobile (sm) | 1 欄 |

---

## 相關文件

- [發文追蹤雷達](post-tracking-dashboard.md) - 發文後即時追蹤
- [Insight 頁面設計（問題導向）](insight-page.md)
- [UI 開發指引](ui-guidelines.md)
- [設計 Tokens](../references/design-tokens.md)
- [指標體系](../06-metrics/INDEX.md)
