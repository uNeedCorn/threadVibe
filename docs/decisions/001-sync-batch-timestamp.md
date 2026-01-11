# ADR-001: 同步批次時間戳 (sync_batch_at)

## 狀態

已採納 (Accepted)

## 日期

2026-01-11

## 背景

目前系統每 15 分鐘執行一次同步，將 Threads API 的資料寫入 `workspace_threads_post_metrics` 和 `workspace_threads_account_insights` 表。

每筆記錄使用 `captured_at` 欄位記錄寫入時間，但隨著同步資料量增長，API 回應時間延長，導致同一批次的資料出現「時間抖動」：

```
排程 13:15:00 開始執行
├── Post A captured_at: 13:15:01
├── Post B captured_at: 13:15:03
├── Post C captured_at: 13:15:08
│   ... API 延遲 ...
├── Post X captured_at: 13:15:45
└── Post Y captured_at: 13:16:02  ← 跨到下一個時間區間
```

## 問題

1. **時間分組不一致** - 同一批次的資料可能被分到不同的時間區間
2. **趨勢圖抖動** - 圖表出現不規則波動
3. **跨指標比較困難** - 難以對齊同一時間點的多個指標
4. **查詢複雜** - 需要額外邏輯處理時間對齊

## 決策

新增 `sync_batch_at` 欄位，記錄排程的邏輯時間（對齊到 15 分鐘區間）。

| 欄位 | 用途 | 範例 |
|------|------|------|
| `captured_at` | 實際寫入時間（技術用） | `2026-01-11 13:15:45.123` |
| `sync_batch_at` | 排程批次時間（業務用） | `2026-01-11 13:15:00` |

### 時間對齊規則

```
sync_batch_at = date_trunc('minute', scheduled_time)
                - (EXTRACT(MINUTE FROM scheduled_time)::int % 15) * interval '1 minute'
```

| 排程觸發時間 | sync_batch_at |
|-------------|---------------|
| 13:15:02 | 13:15:00 |
| 13:30:45 | 13:30:00 |
| 13:45:01 | 13:45:00 |
| 14:00:30 | 14:00:00 |

## 影響範圍

### 資料庫

需要修改的資料表：

| Layer | 資料表 | 新增欄位 | 用途 |
|-------|--------|----------|------|
| L1 快照 | `workspace_threads_post_metrics` | `sync_batch_at` | 時序資料分組 |
| L1 快照 | `workspace_threads_account_insights` | `sync_batch_at` | 時序資料分組 |
| L2 增量 | `workspace_threads_post_metrics_deltas` | `sync_batch_at` | 增量統計分組 |
| L2 增量 | `workspace_threads_account_insights_deltas` | `sync_batch_at` | 增量統計分組 |
| L3 當前 | `workspace_threads_posts` | `last_sync_batch_at` | UI 顯示統一同步時間 |
| L3 當前 | `workspace_threads_accounts` | `last_sync_batch_at` | UI 顯示統一同步時間 |

### 欄位命名

- **L1/L2**: `sync_batch_at` - 每筆記錄的批次時間
- **L3**: `last_sync_batch_at` - 最後同步的批次時間（語意更清晰）

### 後端

需要修改的檔案：

| 檔案 | 變更 |
|------|------|
| `supabase/functions/_shared/sync.ts` | 傳入並寫入 `sync_batch_at` |
| `supabase/functions/scheduled-sync/index.ts` | 計算並傳遞批次時間 |

### 前端

趨勢圖查詢改為使用 `sync_batch_at` 進行分組，確保時間對齊。

## 資料遷移

現有資料需要回填 `sync_batch_at`：

```sql
UPDATE workspace_threads_post_metrics
SET sync_batch_at = date_trunc('minute', captured_at)
                    - (EXTRACT(MINUTE FROM captured_at)::int % 15) * interval '1 minute'
WHERE sync_batch_at IS NULL;
```

## 替代方案

### 方案 A：只使用 captured_at 並在查詢時對齊

- 優點：不需要新增欄位
- 缺點：每次查詢都需要計算，效能較差

### 方案 B：使用時間桶（Time Bucket）儲存

- 優點：更彈性的時間粒度
- 缺點：過度設計，目前不需要

## 結論

採用新增 `sync_batch_at` 欄位的方案，因為：

1. 查詢效能更好（直接 GROUP BY）
2. 業務語意清晰（批次 vs 寫入時間）
3. 實作簡單，影響範圍可控
4. 資料遷移成本低
