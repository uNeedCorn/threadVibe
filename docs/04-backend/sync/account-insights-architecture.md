# Account Insights 同步與 Rollup 架構

## 概述

Account Insights 採用**雙寫 + Rollup**架構，確保即時性與資料一致性。

---

## 資料流架構圖

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Threads API 回應                                     │
│  GET /me/threads_insights?metric=views,followers_count                      │
├─────────────────────────────────────────────────────────────────────────────┤
│  views:           { values: [{ value, end_time }] }  ← 每日時間序列          │
│  followers_count: { total_value: { value } }         ← 當前總數              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      同步寫入（每 15 分鐘）                                   │
│                      scheduled-sync / sync-account-insights                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                    雙寫模式（即時更新）                                │  │
│   ├──────────────────────────────────────────────────────────────────────┤  │
│   │                                                                      │  │
│   │  Legacy 表                    新分層表（ADR-002）                     │  │
│   │  ─────────                    ────────────────                       │  │
│   │  workspace_threads_           workspace_threads_account_insights_15m │  │
│   │  account_insights             workspace_threads_account_insights_hourly│ │
│   │  (L1 Snapshot)                workspace_threads_account_insights_daily │ │
│   │                                                                      │  │
│   │  workspace_threads_                                                  │  │
│   │  account_insights_deltas                                             │  │
│   │  (L2 Delta)                                                          │  │
│   │                                                                      │  │
│   │  workspace_threads_accounts.current_*                                │  │
│   │  (L3 Current)                                                        │  │
│   │                                                                      │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Rollup Jobs                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   hourly-rollup（每小時 :05）          daily-rollup（每日 01:00 UTC）        │
│   ─────────────────────────           ────────────────────────────          │
│   15m → hourly                        hourly → daily                        │
│   取該小時最後一筆                     取該日最後一筆                         │
│   比對同步值 vs 計算值                 比對同步值 vs 計算值                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 資料表結構

### Legacy 表（三層式）

| 表 | Layer | 說明 | 保留期 |
|----|-------|------|--------|
| `workspace_threads_account_insights` | L1 | Snapshot 快照（不可變） | 永久 |
| `workspace_threads_account_insights_deltas` | L2 | Delta 增量 | 永久 |
| `workspace_threads_accounts.current_*` | L3 | Current 當前值 | 即時更新 |

### 新分層表（ADR-002）

| 表 | 顆粒度 | Bucket 欄位 | 說明 |
|----|--------|-------------|------|
| `workspace_threads_account_insights_15m` | 15 分鐘 | `bucket_ts` | 最細顆粒度 |
| `workspace_threads_account_insights_hourly` | 1 小時 | `bucket_ts` | hourly rollup |
| `workspace_threads_account_insights_daily` | 1 天 | `bucket_date` | daily rollup |

### 欄位定義

```sql
-- 所有分層表共用欄位
followers_count    INTEGER   -- 粉絲數（當前總數）
profile_views      INTEGER   -- Profile 觀看數
likes_count_7d     INTEGER   -- 7 天按讚數（API 不支援）
views_count_7d     INTEGER   -- 觀看數（當日值，非 7 天累計）
demographics       JSONB     -- 受眾輪廓（需額外權限）
captured_at        TIMESTAMPTZ
```

---

## 同步流程

### Step 1: 呼叫 Threads API

```typescript
const response = await threadsClient.getUserInsights();
// response = { followers_count: 21, views: 481 }
```

### Step 2: 解析回應（重要！）

```typescript
// views: 使用 values 陣列（時間序列），取最後一筆
// followers_count: 使用 total_value（當前總數）

for (const metric of response.data) {
  if (metric.name === 'followers_count') {
    value = metric.total_value?.value;  // 當前總數
  } else {
    value = metric.values?.[metric.values.length - 1]?.value;  // 最新一筆
  }
}
```

### Step 3: 雙寫模式

```typescript
// 1. Legacy L1 Snapshot
await supabase.from('workspace_threads_account_insights').insert({ ... });

// 2. 新分層表（同時寫入三層）
await supabase.from('workspace_threads_account_insights_15m').upsert({ ... });
await supabase.from('workspace_threads_account_insights_hourly').upsert({ ... });
await supabase.from('workspace_threads_account_insights_daily').upsert({ ... });

// 3. Legacy L2 Delta
if (prevSnapshot) {
  await supabase.from('workspace_threads_account_insights_deltas').insert({
    followers_delta: current.followers_count - prev.followers_count,
    ...
  });
}

// 4. L3 Current
await supabase.from('workspace_threads_accounts').update({
  current_followers_count: insights.followers_count,
  current_views_count_7d: insights.views,
  ...
});
```

---

## Rollup 流程

### Hourly Rollup（每小時 :05）

```
輸入：workspace_threads_account_insights_15m（前一小時內）
輸出：workspace_threads_account_insights_hourly

邏輯：
1. 查詢前一小時的所有 15m 記錄
2. 按 account_id 分組，取最後一筆
3. 比對現有 hourly 值（同步時寫入）vs 計算值
4. 若差異 > 閾值，記錄警告
5. Upsert 到 hourly 表（以計算值為準）
```

### Daily Rollup（每日 01:00 UTC）

```
輸入：workspace_threads_account_insights_hourly（前一天內）
輸出：workspace_threads_account_insights_daily

邏輯：
1. 查詢前一天的所有 hourly 記錄
2. 按 account_id 分組，取最後一筆
3. 比對現有 daily 值 vs 計算值
4. 若差異 > 閾值，記錄警告
5. Upsert 到 daily 表（以計算值為準）
```

---

## API 回應語義

### followers_count

| 項目 | 說明 |
|------|------|
| **結構** | `total_value: { value }` |
| **語義** | **累計總數**（從帳號建立至今） |
| **更新頻率** | 即時 |

### views

| 項目 | 說明 |
|------|------|
| **結構** | `values: [{ value, end_time }]` |
| **語義** | 整點時間的觀看數（待確認是當日累計或該小時 delta） |
| **end_time** | 整點時間戳，如 `2026-01-12T08:00:00+0000` |

```json
// 範例：API 回傳的 views
{
  "name": "views",
  "period": "day",
  "values": [
    { "value": 2789, "end_time": "2026-01-11T08:00:00+0000" },  // 1/11 08:00 的值
    { "value": 562, "end_time": "2026-01-12T08:00:00+0000" }    // 1/12 08:00 的值
  ]
}
```

> **待確認**：`views` 的 value 是當日 00:00~end_time 的累計值，還是該小時的 delta 值？
> 目前策略：**原樣記錄**，待後續驗證確認語義。

---

## 欄位名稱說明

| 欄位 | 儲存內容 | 備註 |
|------|----------|------|
| `current_followers_count` | 粉絲累計總數 | 確認為累計值 |
| `views_count_7d` | API 回傳的 views 最新值 | 名稱待修正，實際非 7 天累計 |

---

## 排程時間表

| Job | 執行時間 | 功能 |
|-----|----------|------|
| `scheduled-sync` | 每 15 分鐘（:00/:15/:30/:45） | 同步 + 雙寫 |
| `hourly-rollup` | 每小時 :05 | 15m → hourly |
| `daily-rollup` | 每日 01:00 UTC | hourly → daily |

---

## 相關文件

- [sync-account-insights.md](sync-account-insights.md) - 同步流程詳細說明
- [ADR-002: 資料保留與 Rollup 策略](../../decisions/002-data-retention-rollup-strategy.md)
- [workspace-threads-accounts.md](../../03-database/tables/workspace-threads-accounts.md) - L3 Current 欄位
