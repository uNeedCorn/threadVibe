# workspace_threads_account_tags

## 概述

用戶自定義標籤表，用於儲存用戶為 Threads 帳號建立的自訂分類標籤。

- **層級**：Account（每個 Threads 帳號獨立）
- **用途**：手動為貼文分類
- **關聯**：透過 `workspace_threads_post_tags` 與貼文關聯

---

## Schema

```sql
CREATE TABLE workspace_threads_account_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_threads_account_id UUID NOT NULL REFERENCES workspace_threads_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#6B7280',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 同一帳號下標籤名稱不可重複
  UNIQUE (workspace_threads_account_id, name)
);

-- 索引
CREATE INDEX idx_account_tags_account_id
  ON workspace_threads_account_tags(workspace_threads_account_id);
```

---

## 欄位說明

| 欄位 | 類型 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| id | UUID | ✅ | gen_random_uuid() | 主鍵 |
| workspace_threads_account_id | UUID | ✅ | - | 所屬 Threads 帳號 |
| name | TEXT | ✅ | - | 標籤名稱 |
| color | TEXT | ❌ | #6B7280 | 標籤顏色（Hex） |
| created_at | TIMESTAMPTZ | ✅ | now() | 建立時間 |
| updated_at | TIMESTAMPTZ | ✅ | now() | 更新時間 |

---

## 約束

| 約束 | 說明 |
|------|------|
| UNIQUE (workspace_threads_account_id, name) | 同一帳號下標籤名稱不可重複 |
| ON DELETE CASCADE | 帳號刪除時連帶刪除所有標籤 |

---

## RLS 政策

使用 `is_workspace_member()` 函數避免 RLS 遞歸問題：

```sql
-- 啟用 RLS
ALTER TABLE workspace_threads_account_tags ENABLE ROW LEVEL SECURITY;

-- 查詢：工作區成員可查詢
CREATE POLICY "Members can view account tags"
  ON workspace_threads_account_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_threads_accounts a
      WHERE a.id = workspace_threads_account_tags.workspace_threads_account_id
        AND is_workspace_member(a.workspace_id)
    )
  );

-- 新增：工作區成員可新增
CREATE POLICY "Members can create account tags"
  ON workspace_threads_account_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_threads_accounts a
      WHERE a.id = workspace_threads_account_id
        AND is_workspace_member(a.workspace_id)
    )
  );

-- 更新：工作區成員可更新
CREATE POLICY "Members can update account tags"
  ON workspace_threads_account_tags FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_threads_accounts a
      WHERE a.id = workspace_threads_account_tags.workspace_threads_account_id
        AND is_workspace_member(a.workspace_id)
    )
  );

-- 刪除：工作區成員可刪除
CREATE POLICY "Members can delete account tags"
  ON workspace_threads_account_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_threads_accounts a
      WHERE a.id = workspace_threads_account_tags.workspace_threads_account_id
        AND is_workspace_member(a.workspace_id)
    )
  );
```

---

## 預設顏色選項

建議提供以下顏色供用戶選擇：

| 顏色名稱 | Hex | 用途 |
|----------|-----|------|
| 灰色 | #6B7280 | 預設 |
| 紅色 | #EF4444 | 重要/警告 |
| 橙色 | #F97316 | 注意 |
| 黃色 | #EAB308 | 提醒 |
| 綠色 | #22C55E | 成功/正向 |
| 藍色 | #3B82F6 | 資訊 |
| 紫色 | #8B5CF6 | 特殊 |
| 粉色 | #EC4899 | 活動 |

---

## 相關資料表

| 資料表 | 關係 | 說明 |
|--------|------|------|
| workspace_threads_accounts | N:1 | 標籤屬於帳號 |
| workspace_threads_post_tags | 1:N | 標籤與貼文的關聯 |

---

## 相關文件

- [標籤系統](../../04-backend/ai/tagging-system.md)
- [workspace_threads_post_tags](workspace-threads-post-tags.md)
