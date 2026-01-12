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
│   followers_count: 取最後一筆          followers_count: 取最後一筆           │
│   profile_views: SUM(delta)           profile_views: SUM(delta)            │
│   ↑ 從 deltas 表累加                  ↑ 從 deltas 表累加                    │
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
followers_count    INTEGER   -- 粉絲數（累計總數，取最後一筆）
profile_views      INTEGER   -- Profile 觀看數（從 delta 表累加）
likes_count_7d     INTEGER   -- ⚠️ DEPRECATED：固定為 0，API 不提供
views_count_7d     INTEGER   -- ⚠️ DEPRECATED：固定為 0，保留供未來使用
demographics       JSONB     -- 受眾輪廓（需額外權限）
captured_at        TIMESTAMPTZ
```

> **Rollup 欄位語義**：
> - `followers_count`：累計總數 → 取最後一筆 snapshot
> - `profile_views`：當日累積（UTC 8 換日）→ 從 delta 表累加

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
  current_profile_views: insights.profile_views,  // 當日累積
  ...
});
```

---

## Delta 計算（換日處理）

### profile_views 的 Delta 計算

API 回傳的 `views` 是**當日累積值**，在 UTC 8（台灣 16:00）會重置歸零。因此 Delta 計算需要特別處理換日情境。

```typescript
// sync.ts - Delta 計算邏輯
if (prevSnapshot) {
  let profileViewsDelta = insights.profile_views - prevSnapshot.profile_views;

  // 檢測換日：如果 delta 是負值，表示跨日重置
  // 例如：前一筆 8000 → 當前 300 = delta -7700（錯誤）
  // 應該使用當前值 300 作為新一天的 delta
  if (profileViewsDelta < 0) {
    profileViewsDelta = insights.profile_views;
  }

  await supabase.from('workspace_threads_account_insights_deltas').insert({
    workspace_threads_account_id: accountId,
    profile_views_delta: profileViewsDelta,  // 已處理換日
    followers_delta: insights.followers_count - prevSnapshot.followers_count,
    period_start: prevSnapshot.captured_at,
    period_end: new Date().toISOString(),
  });
}
```

### 為什麼在 Sync 處理換日？

| 方案 | 優點 | 缺點 |
|------|------|------|
| ✅ **Sync 時處理** | Rollup 只需 SUM，邏輯單純 | Sync 稍複雜 |
| ❌ Rollup 時處理 | Sync 較單純 | Rollup 需知道換日時間，複雜 |

**選擇在 Sync 處理**：確保 Delta 表的數值永遠是「正確的增量」，後續 Rollup 只需簡單累加。

---

## Rollup 流程

### 欄位處理策略

| 欄位 | 策略 | 資料來源 | 說明 |
|------|------|----------|------|
| `followers_count` | 取最後一筆 | 15m/hourly 表 | 累計總數，取期間內最新 snapshot |
| `profile_views` | SUM(delta) | deltas 表 | 從 delta 累加，換日邏輯已在 Sync 處理 |
| `likes_count_7d` | 固定為 0 | - | ⚠️ DEPRECATED |
| `views_count_7d` | 固定為 0 | - | ⚠️ DEPRECATED |

### Hourly Rollup（每小時 :05）

```
輸入：
  - workspace_threads_account_insights_15m（前一小時內）
  - workspace_threads_account_insights_deltas（前一小時內）
輸出：workspace_threads_account_insights_hourly

邏輯：
1. 查詢前一小時的所有 15m 記錄
2. 按 account_id 分組，取最後一筆（用於 followers_count）
3. 從 deltas 表 SUM(profile_views_delta)（用於 profile_views）
4. 比對現有 hourly 值 vs 計算值
5. 若差異 > 5% 閾值，記錄警告
6. Upsert 到 hourly 表：
   - followers_count = 最後一筆 snapshot
   - profile_views = SUM(delta)
   - likes_count_7d = 0
   - views_count_7d = 0
```

### Daily Rollup（每日 01:00 UTC）

```
輸入：
  - workspace_threads_account_insights_hourly（前一天內）
  - workspace_threads_account_insights_deltas（前一天內）
輸出：workspace_threads_account_insights_daily

邏輯：
1. 查詢前一天的所有 hourly 記錄
2. 按 account_id 分組，取最後一筆（用於 followers_count）
3. 從 deltas 表 SUM(profile_views_delta)（用於 profile_views）
4. 比對現有 daily 值 vs 計算值
5. 若差異 > 5% 閾值，記錄警告
6. Upsert 到 daily 表：
   - followers_count = 最後一筆 snapshot
   - profile_views = SUM(delta)
   - likes_count_7d = 0
   - views_count_7d = 0
```

### Delta 累加函式

```typescript
// rollup-utils.ts
export async function sumProfileViewsDeltas(
  serviceClient,
  accountId: string,
  startTime: string,  // 含
  endTime: string     // 不含
): Promise<number> {
  const { data: deltas } = await serviceClient
    .from('workspace_threads_account_insights_deltas')
    .select('profile_views_delta')
    .eq('workspace_threads_account_id', accountId)
    .gte('period_end', startTime)
    .lt('period_end', endTime);

  return deltas?.reduce((sum, d) => sum + (d.profile_views_delta ?? 0), 0) ?? 0;
}
```

---

## API 回應語義

### followers_count

| 項目 | 說明 |
|------|------|
| **結構** | `total_value: { value }` |
| **語義** | **累計總數**（從帳號建立至今） |
| **更新頻率** | 即時 |

### views（Profile Views）

| 項目 | 說明 |
|------|------|
| **結構** | `values: [{ value, end_time }]` |
| **語義** | **當日累積 Profile Views**（從 UTC 8 開始累計） |
| **end_time** | 整點時間戳，如 `2026-01-12T08:00:00+0000` |
| **換日時間** | **UTC 8**（台灣時間 16:00）重置歸零 |
| **儲存欄位** | `profile_views`（不是 `views_count_7d`） |

```json
// 範例：API 回傳的 views
{
  "name": "views",
  "period": "day",
  "values": [
    { "value": 2789, "end_time": "2026-01-11T08:00:00+0000" },  // 1/11 當日累積
    { "value": 562, "end_time": "2026-01-12T08:00:00+0000" }    // 1/12 當日累積（換日後重置）
  ]
}
```

> **換日處理**：當 `profile_views` 比前一筆小（delta < 0）時，表示跨日重置。
> 此時 delta 應使用當前值（新一天的累積），而非負值。

---

## 欄位名稱對照

| 欄位 | 儲存內容 | 狀態 | 備註 |
|------|----------|------|------|
| `followers_count` | 粉絲累計總數 | ✅ 使用中 | 累計值，取最後一筆 |
| `profile_views` | API 回傳的 views | ✅ 使用中 | 當日累積，從 delta 累加 |
| `likes_count_7d` | - | ⚠️ DEPRECATED | 固定為 0，API 不提供 |
| `views_count_7d` | - | ⚠️ DEPRECATED | 固定為 0，保留欄位 |

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
