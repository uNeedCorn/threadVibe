# llm_usage_logs

## 概述

LLM 使用記錄表，用於追蹤 AI 功能的 token 消耗與成本。

- **用途**：記錄每次 LLM API 調用的使用量
- **目的**：成本追蹤、用量分析、異常偵測

---

## Schema

```sql
CREATE TABLE llm_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  workspace_threads_account_id UUID REFERENCES workspace_threads_accounts(id) ON DELETE SET NULL,

  -- 模型資訊
  model_name TEXT NOT NULL,
  model_version TEXT,

  -- Token 使用量
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  total_tokens INTEGER NOT NULL DEFAULT 0,

  -- 用途與上下文
  purpose TEXT NOT NULL,
  reference_id UUID,
  reference_type TEXT,

  -- 額外資訊
  request_metadata JSONB DEFAULT '{}',

  -- 時間
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 索引
CREATE INDEX idx_llm_usage_workspace_id ON llm_usage_logs(workspace_id);
CREATE INDEX idx_llm_usage_account_id ON llm_usage_logs(workspace_threads_account_id);
CREATE INDEX idx_llm_usage_purpose ON llm_usage_logs(purpose);
CREATE INDEX idx_llm_usage_created_at ON llm_usage_logs(created_at);
CREATE INDEX idx_llm_usage_model ON llm_usage_logs(model_name);
```

---

## 欄位說明

| 欄位 | 類型 | 必填 | 預設值 | 說明 |
|------|------|------|--------|------|
| id | UUID | ✅ | gen_random_uuid() | 主鍵 |
| workspace_id | UUID | ✅ | - | 所屬工作區 |
| workspace_threads_account_id | UUID | ❌ | - | 所屬帳號（可為 null） |
| model_name | TEXT | ✅ | - | 模型名稱 |
| model_version | TEXT | ❌ | - | 模型版本 |
| input_tokens | INTEGER | ✅ | 0 | 輸入 token 數 |
| output_tokens | INTEGER | ✅ | 0 | 輸出 token 數 |
| total_tokens | INTEGER | ✅ | 0 | 總 token 數 |
| purpose | TEXT | ✅ | - | 用途標記 |
| reference_id | UUID | ❌ | - | 關聯對象 ID |
| reference_type | TEXT | ❌ | - | 關聯對象類型 |
| request_metadata | JSONB | ❌ | {} | 額外資訊 |
| created_at | TIMESTAMPTZ | ✅ | now() | 建立時間 |

---

## Purpose 用途標記

| 值 | 說明 | reference_type |
|----|------|----------------|
| `post_tagging` | 貼文 AI 標籤 | post |
| `content_analysis` | 內容分析 | post |
| `sentiment_analysis` | 情緒分析（未來） | post |

---

## 模型資訊

### 目前支援

| model_name | model_version | 用途 |
|------------|---------------|------|
| gemini-2-flash | gemini-2.0-flash-001 | 貼文標籤 |

### 欄位用途

| 欄位 | 說明 |
|------|------|
| model_name | 模型系列名稱，用於分組統計 |
| model_version | 精確版本號，用於成本計算（不同版本定價可能不同） |

---

## 成本追蹤

### 計算公式

```
成本 = (input_tokens × input_price) + (output_tokens × output_price)
```

### Gemini 2 Flash 定價參考

| 項目 | 價格（USD / 1M tokens） |
|------|------------------------|
| Input | $0.10 |
| Output | $0.40 |

### 統計查詢

```sql
-- 某工作區本月總使用量
SELECT
  SUM(input_tokens) as total_input,
  SUM(output_tokens) as total_output,
  SUM(total_tokens) as total,
  COUNT(*) as request_count
FROM llm_usage_logs
WHERE workspace_id = $1
  AND created_at >= date_trunc('month', now());

-- 依帳號統計
SELECT
  a.username,
  SUM(l.total_tokens) as total_tokens,
  COUNT(*) as request_count
FROM llm_usage_logs l
JOIN workspace_threads_accounts a ON a.id = l.workspace_threads_account_id
WHERE l.workspace_id = $1
GROUP BY a.id, a.username
ORDER BY total_tokens DESC;

-- 依用途統計
SELECT
  purpose,
  SUM(total_tokens) as total_tokens,
  COUNT(*) as request_count
FROM llm_usage_logs
WHERE workspace_id = $1
GROUP BY purpose;
```

---

## RLS 政策

```sql
-- 啟用 RLS
ALTER TABLE llm_usage_logs ENABLE ROW LEVEL SECURITY;

-- 查詢：工作區成員可查詢
CREATE POLICY "Members can view llm usage logs"
  ON llm_usage_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members m
      WHERE m.workspace_id = llm_usage_logs.workspace_id
        AND m.user_id = auth.uid()
    )
  );

-- 新增：僅 service_role 可新增
-- 透過 Edge Function 使用 service_role 寫入
```

---

## 寫入範例

```typescript
// Edge Function 中記錄 LLM 使用
async function logLlmUsage(
  supabase: SupabaseClient,
  params: {
    workspaceId: string;
    accountId?: string;
    modelName: string;
    modelVersion?: string;
    inputTokens: number;
    outputTokens: number;
    purpose: string;
    referenceId?: string;
    referenceType?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const { error } = await supabase
    .from('llm_usage_logs')
    .insert({
      workspace_id: params.workspaceId,
      workspace_threads_account_id: params.accountId,
      model_name: params.modelName,
      model_version: params.modelVersion,
      input_tokens: params.inputTokens,
      output_tokens: params.outputTokens,
      total_tokens: params.inputTokens + params.outputTokens,
      purpose: params.purpose,
      reference_id: params.referenceId,
      reference_type: params.referenceType,
      request_metadata: params.metadata ?? {},
    });

  if (error) {
    console.error('Failed to log LLM usage:', error);
  }
}
```

---

## 相關文件

- [標籤系統](../../04-backend/ai/tagging-system.md)
