# Workspace CRUD

## 概述

Workspace 的建立、讀取、更新、刪除操作，透過 Supabase Client 直接存取資料庫（RLS 控管權限）。

---

## 操作清單

| 操作 | 權限 | 說明 |
|------|------|------|
| Create | 登入用戶 | 建立新 Workspace |
| Read | 成員 | 查看 Workspace 資訊 |
| Update | Owner | 更新名稱等設定 |
| Delete | Owner | 軟刪除（需確認） |

---

## Create Workspace

### 前端呼叫

```typescript
async function createWorkspace(name: string) {
  const { data: { user } } = await supabase.auth.getUser();

  // 1. 建立 Workspace
  const { data: workspace, error: wsError } = await supabase
    .from('workspaces')
    .insert({ name, created_by_user_id: user.id })
    .select()
    .single();

  if (wsError) throw wsError;

  // 2. 建立 Owner 成員關係
  const { error: memberError } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id: user.id,
      role: 'owner',
      joined_at: new Date().toISOString(),
    });

  if (memberError) throw memberError;

  return workspace;
}
```

---

## Read Workspace

### 列表（使用者所屬的）

```typescript
async function listMyWorkspaces() {
  const { data, error } = await supabase
    .from('workspace_members')
    .select(`
      role,
      joined_at,
      workspaces (
        id,
        name,
        created_at
      )
    `)
    .not('joined_at', 'is', null);

  return data?.map(m => ({
    ...m.workspaces,
    role: m.role,
  }));
}
```

### 單一 Workspace 詳情

```typescript
async function getWorkspace(workspaceId: string) {
  const { data, error } = await supabase
    .from('workspaces')
    .select(`
      *,
      workspace_members (
        user_id,
        role,
        joined_at
      ),
      workspace_threads_accounts (
        id,
        username,
        is_active
      )
    `)
    .eq('id', workspaceId)
    .single();

  return data;
}
```

---

## Update Workspace

### 更新名稱

```typescript
async function updateWorkspace(workspaceId: string, name: string) {
  const { data, error } = await supabase
    .from('workspaces')
    .update({
      name,
      updated_at: new Date().toISOString(),
    })
    .eq('id', workspaceId)
    .select()
    .single();

  return data;
}
```

---

## Delete Workspace

### 軟刪除流程

```typescript
async function requestWorkspaceDeletion(workspaceId: string) {
  const { data: { user } } = await supabase.auth.getUser();

  // 取得 Workspace 與 Owners
  const { data: workspace } = await supabase
    .from('workspaces')
    .select(`
      id,
      deletion_confirmed_by,
      workspace_members!inner (user_id, role)
    `)
    .eq('id', workspaceId)
    .eq('workspace_members.role', 'owner')
    .single();

  const owners = workspace.workspace_members.map(m => m.user_id);
  const confirmedBy = workspace.deletion_confirmed_by || [];

  // 加入確認列表
  if (!confirmedBy.includes(user.id)) {
    confirmedBy.push(user.id);
  }

  // 檢查是否所有 Owner 都確認
  const allConfirmed = owners.every(ownerId => confirmedBy.includes(ownerId));

  if (allConfirmed) {
    // 執行軟刪除
    await supabase
      .from('workspaces')
      .update({
        deleted_at: new Date().toISOString(),
        deletion_confirmed_by: confirmedBy,
      })
      .eq('id', workspaceId);

    return { status: 'deleted' };
  } else {
    // 更新確認列表
    await supabase
      .from('workspaces')
      .update({ deletion_confirmed_by: confirmedBy })
      .eq('id', workspaceId);

    return {
      status: 'pending',
      confirmed: confirmedBy.length,
      total: owners.length,
    };
  }
}
```

### 取消刪除

```typescript
async function cancelWorkspaceDeletion(workspaceId: string) {
  await supabase
    .from('workspaces')
    .update({
      deleted_at: null,
      deletion_confirmed_by: [],
    })
    .eq('id', workspaceId);
}
```

---

## RLS 限制

| 操作 | RLS Policy |
|------|------------|
| SELECT | 成員才能查看 |
| INSERT | 登入用戶 |
| UPDATE | Owner 才能修改 |
| DELETE | Owner 才能刪除 |
