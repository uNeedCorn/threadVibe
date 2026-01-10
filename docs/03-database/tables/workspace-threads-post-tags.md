# workspace_threads_post_tags

## 概述

貼文與用戶自定義標籤的關聯表（多對多）。

- **用途**：記錄貼文與用戶自定義標籤的對應關係
- **關聯**：連結 `workspace_threads_posts` 與 `workspace_threads_account_tags`

---

## Schema

```sql
CREATE TABLE workspace_threads_post_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES workspace_threads_posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES workspace_threads_account_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- 同一貼文不可重複指定相同標籤
  UNIQUE (post_id, tag_id)
);

-- 索引
CREATE INDEX idx_post_tags_post_id ON workspace_threads_post_tags(post_id);
CREATE INDEX idx_post_tags_tag_id ON workspace_threads_post_tags(tag_id);
```

---

## 欄位說明

| 欄位 | 類型 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| id | UUID | ✅ | gen_random_uuid() | 主鍵 |
| post_id | UUID | ✅ | - | 貼文 ID |
| tag_id | UUID | ✅ | - | 標籤 ID |
| created_at | TIMESTAMPTZ | ✅ | now() | 建立時間 |

---

## 約束

| 約束 | 說明 |
|------|------|
| UNIQUE (post_id, tag_id) | 同一貼文不可重複指定相同標籤 |
| ON DELETE CASCADE (post_id) | 貼文刪除時連帶刪除關聯 |
| ON DELETE CASCADE (tag_id) | 標籤刪除時連帶刪除關聯 |

---

## RLS 政策

```sql
-- 啟用 RLS
ALTER TABLE workspace_threads_post_tags ENABLE ROW LEVEL SECURITY;

-- 查詢：工作區成員可查詢
CREATE POLICY "Members can view post tags"
  ON workspace_threads_post_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_threads_posts p
      JOIN workspace_threads_accounts a ON a.id = p.workspace_threads_account_id
      JOIN workspace_members m ON m.workspace_id = a.workspace_id
      WHERE p.id = workspace_threads_post_tags.post_id
        AND m.user_id = auth.uid()
    )
  );

-- 新增：工作區成員可新增
CREATE POLICY "Members can create post tags"
  ON workspace_threads_post_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_threads_posts p
      JOIN workspace_threads_accounts a ON a.id = p.workspace_threads_account_id
      JOIN workspace_members m ON m.workspace_id = a.workspace_id
      WHERE p.id = post_id
        AND m.user_id = auth.uid()
    )
  );

-- 刪除：工作區成員可刪除
CREATE POLICY "Members can delete post tags"
  ON workspace_threads_post_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM workspace_threads_posts p
      JOIN workspace_threads_accounts a ON a.id = p.workspace_threads_account_id
      JOIN workspace_members m ON m.workspace_id = a.workspace_id
      WHERE p.id = workspace_threads_post_tags.post_id
        AND m.user_id = auth.uid()
    )
  );
```

---

## 查詢範例

### 取得貼文的所有標籤

```sql
SELECT t.id, t.name, t.color
FROM workspace_threads_account_tags t
JOIN workspace_threads_post_tags pt ON pt.tag_id = t.id
WHERE pt.post_id = $1;
```

### 依標籤篩選貼文

```sql
SELECT p.*
FROM workspace_threads_posts p
JOIN workspace_threads_post_tags pt ON pt.post_id = p.id
WHERE pt.tag_id = $1
ORDER BY p.published_at DESC;
```

### 統計各標籤的貼文數量

```sql
SELECT
  t.id,
  t.name,
  t.color,
  COUNT(pt.post_id) as post_count
FROM workspace_threads_account_tags t
LEFT JOIN workspace_threads_post_tags pt ON pt.tag_id = t.id
WHERE t.workspace_threads_account_id = $1
GROUP BY t.id, t.name, t.color
ORDER BY post_count DESC;
```

---

## 相關資料表

| 資料表 | 關係 | 說明 |
|--------|------|------|
| workspace_threads_posts | N:1 | 關聯的貼文 |
| workspace_threads_account_tags | N:1 | 關聯的標籤 |

---

## 相關文件

- [標籤系統](../../04-backend/ai/tagging-system.md)
- [workspace_threads_account_tags](workspace-threads-account-tags.md)
- [workspace_threads_posts](workspace-threads-posts.md)
