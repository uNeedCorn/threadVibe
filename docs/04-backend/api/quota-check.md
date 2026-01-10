# 額度檢查

## 概述

檢查使用者的訂閱方案額度，用於建立 Workspace、新增帳號等操作前的驗證。

---

## API 端點

### GET /quota-check

檢查當前使用者的額度狀態。

---

## 實作

```typescript
// supabase/functions/quota-check/index.ts
serve(async (req) => {
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // 取得使用者訂閱方案
  const { data: subscription } = await supabase
    .from('user_subscriptions')
    .select('plan_type, limits')
    .eq('user_id', user.id)
    .single();

  // 如果沒有訂閱記錄，使用預設 Free 方案
  const limits = subscription?.limits || DEFAULT_FREE_LIMITS;

  // 計算當前使用量
  const usage = await calculateUsage(user.id);

  return new Response(JSON.stringify({
    plan: subscription?.plan_type || 'free',
    limits,
    usage,
    canCreate: {
      workspace: usage.workspaces < limits.max_workspaces,
      account: usage.accounts < limits.max_accounts_per_workspace,
      member: usage.members < limits.max_members_per_workspace,
    },
  }));
});

// 計算使用量
async function calculateUsage(userId: string) {
  // 使用者擁有的 Workspace 數量
  const { count: workspacesCount } = await supabase
    .from('workspace_members')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('role', 'owner');

  return {
    workspaces: workspacesCount || 0,
    // 其他使用量需要在 Workspace 層級計算
  };
}
```

---

## 預設額度

```typescript
const DEFAULT_FREE_LIMITS = {
  max_workspaces: 1,
  max_accounts_per_workspace: 1,
  max_members_per_workspace: 1,
  sync_interval_minutes: 60,
  data_retention_days: 30,
};

const PRO_LIMITS = {
  max_workspaces: 5,
  max_accounts_per_workspace: 5,
  max_members_per_workspace: 10,
  sync_interval_minutes: 15,
  data_retention_days: 365,
};

const ENTERPRISE_LIMITS = {
  max_workspaces: -1, // 無限
  max_accounts_per_workspace: -1,
  max_members_per_workspace: -1,
  sync_interval_minutes: 5,
  data_retention_days: -1, // 永久
};
```

---

## 回應格式

```typescript
interface QuotaResponse {
  plan: 'free' | 'pro' | 'enterprise';
  limits: {
    max_workspaces: number;
    max_accounts_per_workspace: number;
    max_members_per_workspace: number;
    sync_interval_minutes: number;
    data_retention_days: number;
  };
  usage: {
    workspaces: number;
    // 其他使用量
  };
  canCreate: {
    workspace: boolean;
    account: boolean;
    member: boolean;
  };
}
```

---

## 前端使用

### 建立 Workspace 前檢查

```typescript
async function checkAndCreateWorkspace(name: string) {
  // 先檢查額度
  const quota = await fetch('/api/quota-check').then(r => r.json());

  if (!quota.canCreate.workspace) {
    throw new Error(`已達 Workspace 上限 (${quota.limits.max_workspaces})`);
  }

  // 建立 Workspace
  return createWorkspace(name);
}
```

### 顯示使用狀態

```typescript
function QuotaStatus({ quota }) {
  return (
    <div>
      <p>方案：{quota.plan}</p>
      <p>
        Workspace：{quota.usage.workspaces} / {quota.limits.max_workspaces}
      </p>
      {!quota.canCreate.workspace && (
        <p>已達上限，請升級方案</p>
      )}
    </div>
  );
}
```

---

## 注意事項

1. **預留功能**：目前不強制執行額度限制
2. **未來擴展**：可與付費系統整合
3. **-1 表示無限**：用於企業方案
