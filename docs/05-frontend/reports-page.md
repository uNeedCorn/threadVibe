# 報表下載頁面

## 概述

報表下載頁面提供用戶下載週報/月報 CSV 數據的功能。

**路由**：`/reports`

---

## 功能

### 報表類型

| 類型 | 說明 | 資料來源 |
|------|------|----------|
| **彙總報表** | 期間內的統計摘要（一行） | `workspace_threads_posts` (L3) |
| **明細報表** | 每小時成效快照（多行） | `workspace_threads_post_metrics_hourly` |

### 時間範圍

- 本週（本週一到今天）
- 上週（上週一到上週日）
- 本月（本月 1 日到今天）
- 上月（上月 1 日到上月最後一天）
- 自訂日期（起迄日期）

---

## CSV 欄位

### 彙總報表

```csv
期間, 發文數, 總觀看, 總讚數, 總回覆, 總轉發, 總引用, 平均互動率
```

範例：
```csv
2026-01-06 ~ 2026-01-12, 15, 45000, 1200, 89, 34, 12, 2.97%
```

### 明細報表

```csv
貼文ID, 貼文內容, 發文時間, 曝光日期, 曝光時間, 觀看數, 讚數, 回覆, 轉發數, 引用數, 分類標籤
```

範例：
```csv
18342xxx, 今天分享一個..., 2026-01-08, 2026-01-08, 14:00, 3500, 120, 8, 3, 1, 行銷,教學
18342xxx, 今天分享一個..., 2026-01-08, 2026-01-08, 15:00, 4200, 145, 10, 5, 2, 行銷,教學
```

---

## 元件結構

```
/reports/page.tsx
├── 報表設定 Card
│   └── ReportFilters              # 篩選器
│       ├── 報表類型 Select
│       ├── 時間範圍 Select
│       ├── 自訂日期 Input (when custom)
│       ├── 產生報表 Button
│       └── 下載 CSV Button
├── 錯誤提示 Alert
├── 彙總報表預覽 Card + Table     # 產生後顯示
└── 明細報表預覽 Card + Table     # 產生後顯示（前 100 筆）
```

---

## 資料流

### 彙總報表

```
用戶選擇 → 點擊「產生報表」
         → 前端查詢 workspace_threads_posts
         → 聚合計算 (SUM, AVG)
         → 表格預覽
         → 點擊「下載 CSV」→ 觸發下載
```

### 明細報表

```
用戶選擇 → 點擊「產生報表」
         → 查詢 workspace_threads_posts (取得 post IDs)
         → 查詢 workspace_threads_post_metrics_hourly (JOIN posts + tags)
         → 表格預覽（前 100 筆）
         → 點擊「下載 CSV」→ 觸發下載（完整資料）
```

---

## 檔案位置

| 檔案 | 說明 |
|------|------|
| `app/(auth)/reports/page.tsx` | 報表頁面 |
| `components/reports/report-filters.tsx` | 篩選器元件 |
| `components/reports/index.ts` | 模組導出 |
| `lib/csv-generator.ts` | CSV 生成工具 |

---

## 相關文件

- [workspace_threads_posts](../03-database/tables/workspace-threads-posts.md) - L3 Current 資料表
- [workspace_threads_post_metrics_hourly](../decisions/002-data-retention-rollup-strategy.md) - hourly 分層表
