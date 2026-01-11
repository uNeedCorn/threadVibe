# 訂閱方案規劃

## 概述

ThreadsVibe 採用 Freemium 模式，提供免費基礎功能與付費進階功能。

---

## 方案設計

### 方案比較

| 功能 | Free | Pro |
|------|------|-----|
| Threads 帳號連結 | 1 個 | 無限 |
| 貼文同步 | ✅ | ✅ |
| 基礎成效數據 | ✅ | ✅ |
| 用戶自定義標籤 | ✅ | ✅ |
| **AI 標籤分析** | ❌ 鎖定 | ✅ |
| **進階 Insights** | ❌ 鎖定 | ✅ |
| 資料保留期 | 30 天 | 365 天 |
| 優先同步 | ❌ | ✅ |

---

## 付費功能清單

### 1. AI 標籤分析 (`ai_tagging`)

**功能說明：**
- LLM 自動分析貼文內容
- 5 維度分類（內容類型、語氣風格、互動意圖、情緒色彩、目標受眾）
- 每維度回傳前 3 個高信心度標籤
- 用於內容策略分析

**免費用戶體驗：**
- 顯示 AI 標籤區塊但呈現鎖定狀態（模糊 + 升級按鈕）
- 不執行 AI 分析，不消耗 LLM 資源

**技術實作：**
```typescript
// 預留接口
interface SubscriptionFeatures {
  ai_tagging: boolean;
  advanced_insights: boolean;
  // ... 其他功能
}

// 檢查點（目前暫不實作，預設 true）
async function hasFeature(workspaceId: string, feature: string): Promise<boolean> {
  // TODO: 實作訂閱檢查
  return true; // 暫時開放所有功能
}
```

---

### 2. 進階 Insights (`advanced_insights`)

**功能說明：**
- 受眾輪廓分析（性別、年齡、地區）
- 最佳發文時段建議
- 內容表現趨勢報告
- 競爭對手比較（未來）

**免費用戶體驗：**
- 顯示基礎 Insights（粉絲數、總互動）
- 進階圖表顯示鎖定狀態

---

## UI 鎖定狀態設計

### 視覺呈現

```
┌─────────────────────────────────────────────────────────────┐
│  AI 標籤分析                                    🔒 Pro 功能  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│                                                             │
│                    [ 升級至 Pro 方案 ]                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 實作方式

```tsx
interface LockedFeatureProps {
  feature: string;
  title: string;
  children: React.ReactNode; // 實際內容（模糊顯示）
}

function LockedFeature({ feature, title, children }: LockedFeatureProps) {
  const { hasFeature } = useSubscription();

  if (hasFeature(feature)) {
    return <>{children}</>;
  }

  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none">
        {children}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <UpgradePrompt feature={feature} title={title} />
      </div>
    </div>
  );
}
```

---

## 資料表設計（未來實作）

### user_subscriptions

```sql
CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free',  -- free, pro, enterprise
  features JSONB NOT NULL DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id)
);
```

### 功能權限對照

```jsonc
// plan = 'free'
{
  "ai_tagging": false,
  "advanced_insights": false,
  "max_accounts": 1,
  "data_retention_days": 30
}

// plan = 'pro'
{
  "ai_tagging": true,
  "advanced_insights": true,
  "max_accounts": -1,  // unlimited
  "data_retention_days": 365
}
```

---

## 預留接口

### Hook: useSubscription

```typescript
// hooks/use-subscription.ts

interface Subscription {
  plan: 'free' | 'pro' | 'enterprise';
  features: {
    ai_tagging: boolean;
    advanced_insights: boolean;
    max_accounts: number;
    data_retention_days: number;
  };
  expiresAt: Date | null;
}

export function useSubscription() {
  // TODO: 實作訂閱查詢

  // 暫時回傳 Pro 方案（開發期間）
  const subscription: Subscription = {
    plan: 'pro',
    features: {
      ai_tagging: true,
      advanced_insights: true,
      max_accounts: -1,
      data_retention_days: 365,
    },
    expiresAt: null,
  };

  const hasFeature = (feature: string): boolean => {
    return subscription.features[feature as keyof typeof subscription.features] === true;
  };

  return {
    subscription,
    hasFeature,
    isPro: subscription.plan === 'pro',
    isFree: subscription.plan === 'free',
  };
}
```

### 後端檢查函數

```typescript
// _shared/subscription.ts

export async function checkFeatureAccess(
  workspaceId: string,
  feature: string
): Promise<boolean> {
  // TODO: 查詢 user_subscriptions 表

  // 暫時開放所有功能
  return true;
}
```

---

## 實作優先順序

| 階段 | 內容 | 時機 |
|------|------|------|
| **Phase 1** | 預留接口（Hook + 後端函數） | 現在 |
| **Phase 2** | 鎖定狀態 UI 元件 | 現在 |
| **Phase 3** | user_subscriptions 資料表 | 付費上線前 |
| **Phase 4** | Stripe 整合 | 付費上線前 |
| **Phase 5** | 訂閱管理頁面 | 付費上線前 |

---

## 相關文件

- [tagging-system.md](../04-backend/ai/tagging-system.md) - AI 標籤系統
- [user-subscriptions.md](../03-database/tables/user-subscriptions.md) - 訂閱資料表
