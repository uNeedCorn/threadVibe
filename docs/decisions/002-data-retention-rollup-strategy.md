# ADR-002: 資料保留與 Rollup 策略

## 狀態

已採納 (Accepted)

## 日期

2026-01-11

## 背景

目前系統每 15 分鐘同步一次，所有 snapshot 資料永久保留，無 rollup 機制。隨著用戶和貼文數量增長，資料量將呈指數成長：

```
每日每帳號資料量（100 篇貼文）：
├── post_metrics:     100 篇 × 96 次/天 = 9,600 筆/天
└── account_insights: 96 筆/天

10 個帳號 × 1 年 = 34,560,000 筆 post_metrics
100 個帳號 × 1 年 = 345,600,000 筆 post_metrics
```

## 問題

1. **資料庫容量爆炸** - 無限成長的 snapshot 資料
2. **API 成本過高** - 不分貼文年齡的統一高頻同步
3. **查詢效能下降** - 大量歷史資料影響查詢速度
4. **缺乏分層存取** - 無法依用戶方案區隔資料精度

## 決策

採用「貼文生命週期」為核心的分層策略，包含：

1. **同步頻率分層** - 依貼文年齡調整同步頻率
2. **資料粒度分層** - 15m / hourly / daily 三層儲存
3. **Rollup 機制** - 背景 Job 定期彙總
4. **自動清除** - 依保留策略清除過期資料

---

## 核心概念：貼文生命週期

社群貼文的成效監測價值隨時間遞減：

| 階段 | 時間範圍 | 監測需求 | 同步頻率 | 儲存粒度 |
|------|---------|---------|---------|---------|
| 黃金期 | 0 - 72h | 即時擴散監測 | 每 15 分鐘 | 15m |
| 穩定期 | 72h - 3 個月 | 成長趨勢追蹤 | 每小時 | hourly |
| 衰退期 | 3 - 6 個月 | 歷史紀錄 | 每日 | daily |
| 歸檔期 | 6 個月+ | 長期保存 | 每週 | daily |

---

## 資料表結構

### Post Metrics（貼文成效）

採用多表設計，各表生命週期獨立：

```
workspace_threads_post_metrics_15m      ← 15 分鐘粒度
workspace_threads_post_metrics_hourly   ← 小時粒度
workspace_threads_post_metrics_daily    ← 日粒度
```

### Account Insights（帳號 Insights）

同樣採用多表設計：

```
workspace_threads_account_insights_15m
workspace_threads_account_insights_hourly
workspace_threads_account_insights_daily
```

### Schema 設計

各表共用相同欄位結構，差異在於時間粒度：

```sql
-- 15m 表
CREATE TABLE workspace_threads_post_metrics_15m (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_post_id UUID NOT NULL REFERENCES workspace_threads_posts(id) ON DELETE CASCADE,
  views                     INTEGER NOT NULL DEFAULT 0,
  likes                     INTEGER NOT NULL DEFAULT 0,
  replies                   INTEGER NOT NULL DEFAULT 0,
  reposts                   INTEGER NOT NULL DEFAULT 0,
  quotes                    INTEGER NOT NULL DEFAULT 0,
  shares                    INTEGER NOT NULL DEFAULT 0,
  bucket_ts                 TIMESTAMPTZ NOT NULL,  -- 對齊到 15 分鐘
  captured_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- hourly 表
CREATE TABLE workspace_threads_post_metrics_hourly (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_post_id UUID NOT NULL REFERENCES workspace_threads_posts(id) ON DELETE CASCADE,
  views                     INTEGER NOT NULL DEFAULT 0,
  likes                     INTEGER NOT NULL DEFAULT 0,
  replies                   INTEGER NOT NULL DEFAULT 0,
  reposts                   INTEGER NOT NULL DEFAULT 0,
  quotes                    INTEGER NOT NULL DEFAULT 0,
  shares                    INTEGER NOT NULL DEFAULT 0,
  bucket_ts                 TIMESTAMPTZ NOT NULL,  -- 對齊到小時
  captured_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- daily 表
CREATE TABLE workspace_threads_post_metrics_daily (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_post_id UUID NOT NULL REFERENCES workspace_threads_posts(id) ON DELETE CASCADE,
  views                     INTEGER NOT NULL DEFAULT 0,
  likes                     INTEGER NOT NULL DEFAULT 0,
  replies                   INTEGER NOT NULL DEFAULT 0,
  reposts                   INTEGER NOT NULL DEFAULT 0,
  quotes                    INTEGER NOT NULL DEFAULT 0,
  shares                    INTEGER NOT NULL DEFAULT 0,
  bucket_date               DATE NOT NULL,  -- 日期
  captured_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 同步策略

### 寫入路徑

依貼文年齡決定寫入目標：

```
貼文年齡 0 - 72h：
  同步 → 寫入 15m 表

貼文年齡 72h - 3 個月：
  同步 → 直接寫入 hourly 表（不經過 15m）

貼文年齡 3 - 6 個月：
  同步 → 直接寫入 daily 表

貼文年齡 6 個月+：
  同步 → 直接寫入 daily 表（每週一筆）
```

### 同步頻率控制

```typescript
function getSyncFrequency(publishedAt: Date): SyncFrequency {
  const ageHours = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60);

  if (ageHours <= 72) {
    return '15m';  // 每 15 分鐘
  } else if (ageHours <= 24 * 90) {  // 3 個月
    return 'hourly';
  } else if (ageHours <= 24 * 180) {  // 6 個月
    return 'daily';
  } else {
    return 'weekly';
  }
}
```

---

## Rollup 機制

### Rollup 規則

指標為累積值（cumulative total），rollup 規則：

| 來源 | 目標 | 規則 |
|------|------|------|
| 15m → hourly | 取該小時最後一筆 15m 的 total 值 |
| hourly → daily | 取當日最後一筆 hourly 的 total 值 |

**不需要 daily → weekly rollup**，6 個月以上直接寫入 daily 表。

### Rollup Job 時程

| Job | 執行時間 | 處理內容 |
|-----|---------|---------|
| hourly_rollup | 每小時 :05 分 | 處理前一小時的 15m 資料 |
| daily_rollup | 每日 01:00 UTC | 處理前一天的 hourly 資料 |

### Rollup 實作

```typescript
// Hourly Rollup
async function rollupToHourly(supabase: SupabaseClient, targetHour: Date) {
  const hourStart = startOfHour(targetHour);
  const hourEnd = addHours(hourStart, 1);

  // 取得該小時所有 15m 資料，按 post 分組取最後一筆
  const { data: lastSnapshots } = await supabase
    .from('workspace_threads_post_metrics_15m')
    .select('*')
    .gte('bucket_ts', hourStart.toISOString())
    .lt('bucket_ts', hourEnd.toISOString())
    .order('bucket_ts', { ascending: false });

  // 按 post_id 分組，取每個 post 的最後一筆
  const byPost = groupBy(lastSnapshots, 'workspace_threads_post_id');

  for (const [postId, snapshots] of Object.entries(byPost)) {
    const lastSnapshot = snapshots[0];  // 最後一筆

    await supabase
      .from('workspace_threads_post_metrics_hourly')
      .insert({
        workspace_threads_post_id: postId,
        views: lastSnapshot.views,
        likes: lastSnapshot.likes,
        replies: lastSnapshot.replies,
        reposts: lastSnapshot.reposts,
        quotes: lastSnapshot.quotes,
        shares: lastSnapshot.shares,
        bucket_ts: hourStart,
      });
  }
}

// Daily Rollup
async function rollupToDaily(supabase: SupabaseClient, targetDate: Date) {
  const dayStart = startOfDay(targetDate);
  const dayEnd = addDays(dayStart, 1);

  // 取得當日所有 hourly 資料，按 post 分組取最後一筆
  const { data: lastSnapshots } = await supabase
    .from('workspace_threads_post_metrics_hourly')
    .select('*')
    .gte('bucket_ts', dayStart.toISOString())
    .lt('bucket_ts', dayEnd.toISOString())
    .order('bucket_ts', { ascending: false });

  const byPost = groupBy(lastSnapshots, 'workspace_threads_post_id');

  for (const [postId, snapshots] of Object.entries(byPost)) {
    const lastSnapshot = snapshots[0];

    await supabase
      .from('workspace_threads_post_metrics_daily')
      .insert({
        workspace_threads_post_id: postId,
        views: lastSnapshot.views,
        likes: lastSnapshot.likes,
        replies: lastSnapshot.replies,
        reposts: lastSnapshot.reposts,
        quotes: lastSnapshot.quotes,
        shares: lastSnapshot.shares,
        bucket_date: dayStart,
      });
  }
}
```

---

## 資料保留策略

### Post Metrics

| 表 | 保留條件 | 清除頻率 |
|----|---------|---------|
| 15m | 貼文發布後 72h 內 | 每小時 |
| hourly | 貼文發布後 3 個月內 | 每日 |
| daily | 貼文發布後 365 天內 | 每週 |

### Account Insights

Account 沒有「發布時間」，改用日曆時間：

| 表 | 保留條件 | 清除頻率 |
|----|---------|---------|
| 15m | 最近 7 天 | 每小時 |
| hourly | 最近 30 天 | 每日 |
| daily | 最近 365 天 | 每週 |

### 清除 Job

```typescript
// 清除 15m 表（每小時執行）
async function cleanup15m(supabase: SupabaseClient) {
  // Post Metrics: 貼文發布超過 72h
  await supabase.rpc('cleanup_post_metrics_15m', {
    age_hours: 72
  });

  // Account Insights: 超過 7 天
  await supabase.rpc('cleanup_account_insights_15m', {
    days: 7
  });
}

// 清除 hourly 表（每日執行）
async function cleanupHourly(supabase: SupabaseClient) {
  // Post Metrics: 貼文發布超過 3 個月
  await supabase.rpc('cleanup_post_metrics_hourly', {
    months: 3
  });

  // Account Insights: 超過 30 天
  await supabase.rpc('cleanup_account_insights_hourly', {
    days: 30
  });
}

// 清除 daily 表（每週執行）
async function cleanupDaily(supabase: SupabaseClient) {
  // Post Metrics: 貼文發布超過 365 天
  await supabase.rpc('cleanup_post_metrics_daily', {
    days: 365
  });

  // Account Insights: 超過 365 天
  await supabase.rpc('cleanup_account_insights_daily', {
    days: 365
  });
}
```

---

## Delta 計算

**決策：移除獨立的 Delta 表，查詢時即時計算**

原因：
1. Delta 可從相鄰 snapshot 相減得出
2. 減少儲存空間和寫入複雜度
3. Rollup 可重算，Delta 同樣可重算

查詢範例：

```sql
-- 計算某貼文每小時的 views 增量
WITH ordered AS (
  SELECT
    bucket_ts,
    views,
    LAG(views) OVER (ORDER BY bucket_ts) as prev_views
  FROM workspace_threads_post_metrics_hourly
  WHERE workspace_threads_post_id = $1
)
SELECT
  bucket_ts,
  views,
  views - COALESCE(prev_views, 0) as views_delta
FROM ordered;
```

---

## 時區處理

**決策：所有時間計算以 UTC 為準**

- 資料庫儲存 UTC 時間
- 保留期限計算使用 UTC
- 前端顯示時轉換為用戶時區

---

## 方案存取區隔

**決策：在 API 層實作存取控制**

- 資料庫保留完整資料（方便升級解鎖）
- API 根據用戶方案限制可查詢的時間範圍和粒度

```typescript
function getAccessibleRange(plan: Plan): AccessRange {
  switch (plan) {
    case 'free':
      return { days: 7, granularity: 'daily' };
    case 'pro':
      return { days: 30, granularity: 'hourly' };
    case 'business':
      return { days: 90, granularity: '15m' };
  }
}
```

---

## 現有資料遷移

**決策：暫不遷移，標記現有表為 legacy**

- 現有 `workspace_threads_post_metrics` 表標記為 legacy
- 新資料寫入新的分層表
- 後續視情況決定是否 rollup 舊資料

---

## 過渡策略：雙寫模式

為確保平滑過渡，採用雙寫模式（Dual-Write）：

### 階段 1：雙寫

同步時同時寫入新舊表，確保資料一致性：

```typescript
async function syncMetrics(post: Post, metrics: Metrics) {
  // 1. 寫入舊表（維持現狀）
  await supabase
    .from('workspace_threads_post_metrics')
    .insert({ ... });

  // 2. 同時寫入新的分層表
  const targetTable = getTargetTable(post.published_at);
  await supabase
    .from(targetTable)
    .insert({ ... });
}
```

### 階段 2：驗證期

- 持續 1-3 天觀察
- 驗證新表資料正確性
- 比對新舊表數據一致性

### 階段 3：切換讀取

- 前端查詢改為讀取新表
- 舊表仍在寫入（作為備援）

### 階段 4：停止雙寫

- 確認前端正常後，停止寫入舊表
- 標記舊表為 legacy

### 回滾計劃

若新表出現問題：
1. 前端切回讀取舊表
2. 停止寫入新表
3. 修復問題後重新開始

---

## 完整資料流圖

```
貼文發布
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                     0 - 72 小時                                  │
├─────────────────────────────────────────────────────────────────┤
│  每 15 分鐘同步 → 寫入 15m 表                                    │
│        │                                                         │
│        ├──► 每小時 :05 Rollup Job → 寫入 hourly 表               │
│        │                                                         │
│        └──► 每日 01:00 Rollup Job → 寫入 daily 表                │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼ 72h 後，15m 表資料被清除
    │
┌─────────────────────────────────────────────────────────────────┐
│                   72h - 3 個月                                   │
├─────────────────────────────────────────────────────────────────┤
│  每小時同步 → 直接寫入 hourly 表                                 │
│        │                                                         │
│        └──► 每日 01:00 Rollup Job → 寫入 daily 表                │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼ 3 個月後，hourly 表資料被清除
    │
┌─────────────────────────────────────────────────────────────────┐
│                   3 - 6 個月                                     │
├─────────────────────────────────────────────────────────────────┤
│  每日同步 → 直接寫入 daily 表                                    │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼ 6 個月後，同步頻率降為每週
    │
┌─────────────────────────────────────────────────────────────────┐
│                   6 個月以上                                     │
├─────────────────────────────────────────────────────────────────┤
│  每週同步 → 直接寫入 daily 表（每 7 天一筆）                     │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼ 365 天後，daily 表資料被清除
```

---

## 背景 Job 總覽

| Job | 頻率 | 執行時間 | 功能 |
|-----|------|---------|------|
| hourly_rollup | 每小時 | :05 分 | 15m → hourly rollup |
| daily_rollup | 每日 | 01:00 UTC | hourly → daily rollup |
| cleanup_15m | 每小時 | :10 分 | 清除過期 15m 資料 |
| cleanup_hourly | 每日 | 02:00 UTC | 清除過期 hourly 資料 |
| cleanup_daily | 每週 | 週日 03:00 UTC | 清除過期 daily 資料 |

---

## 容量預估（新架構）

### Post Metrics

假設：1 帳號 100 篇貼文

```
15m 表（只保留 72h 內的貼文）：
├── 假設 10% 貼文在黃金期 = 10 篇
├── 10 篇 × 4 筆/小時 × 72 小時 = 2,880 筆/帳號
└── 10 帳號 = 28,800 筆（固定上限）

hourly 表（保留 3 個月內的貼文）：
├── 100 篇 × 24 筆/天 × 90 天 = 216,000 筆/帳號
└── 10 帳號 = 2,160,000 筆

daily 表（保留 365 天）：
├── 100 篇 × 365 筆 = 36,500 筆/帳號
└── 10 帳號 = 365,000 筆/年

總計（10 帳號）：約 2,554,000 筆
vs 原架構：34,560,000 筆
節省：92%
```

---

## 替代方案

### 方案 A：時間分區（Time Partitioning）

- 優點：Postgres 原生支援，查詢優化
- 缺點：分區管理複雜，不如多表直觀

### 方案 B：單表 + granularity 欄位

- 優點：表數量少
- 缺點：各粒度生命週期不同，清除複雜

### 方案 C：TimescaleDB

- 優點：專業時序資料庫，自動壓縮
- 缺點：需要額外設定，增加複雜度

---

## 結論

採用多表 + 背景 Rollup + 自動清除的方案，因為：

1. **邏輯清晰** - 各粒度獨立表，生命週期明確
2. **效能優化** - 各表可獨立建立索引
3. **成本可控** - 自動清除過期資料，儲存成本降低 92%
4. **彈性擴展** - 可配合方案做存取區隔
5. **實作簡單** - 不需要額外依賴（如 TimescaleDB）

---

## 實作順序

採用雙寫模式的安全過渡順序：

```
Phase 1：建立新表
    │ 建立 6 張分層表 + 索引 + RLS
    ↓
Phase 2a：雙寫模式
    │ 同步時同時寫入新舊表
    ↓
Phase 3-4：Rollup + Cleanup Jobs
    │ 可與 Phase 2a 並行開發
    ↓
驗證期（1-3 天）
    │ 確認新表資料正確
    ↓
Phase 5：前端切換
    │ 查詢改為讀取新表
    ↓
Phase 2b：停止雙寫
    │ 停止寫入舊表
    ↓
Phase 6：標記舊表為 legacy
```
