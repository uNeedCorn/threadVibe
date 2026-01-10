# 成員管理

## 概述

管理 Workspace 成員：邀請、角色變更、移除。

---

## 操作清單

| 操作 | 權限 | 說明 |
|------|------|------|
| 邀請成員 | Owner | 發送邀請 |
| 接受邀請 | 被邀請者 | 加入 Workspace |
| 變更角色 | Owner | 升降級成員 |
| 移除成員 | Owner | 踢出成員 |
| 離開 | 成員自己 | 主動離開 |

---

## 邀請成員

### Edge Function: workspace-invite

```typescript
// supabase/functions/workspace-invite/index.ts
serve(async (req) => {
  const { workspaceId, email, role } = await req.json();
  const { data: { user } } = await supabase.auth.getUser();

  // 驗證是 Owner
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (membership?.role !== 'owner') {
    return new Response('Forbidden', { status: 403 });
  }

  // 查詢被邀請者是否已有帳號
  const { data: invitee } = await supabase
    .from('auth.users')
    .select('id')
    .eq('email', email)
    .single();

  // 建立邀請記錄
  const { error } = await supabase
    .from('workspace_members')
    .insert({
      workspace_id: workspaceId,
      user_id: invitee?.id, // 可能為 null（尚未註冊）
      role: role || 'viewer',
      invited_at: new Date().toISOString(),
      invited_by: user.id,
      // joined_at 為 null 表示待接受
    });

  // TODO: 發送邀請 Email

  return new Response(JSON.stringify({ success: true }));
});
```

---

## 接受邀請

### Edge Function: workspace-accept-invite

```typescript
// supabase/functions/workspace-accept-invite/index.ts
serve(async (req) => {
  const { workspaceId } = await req.json();
  const { data: { user } } = await supabase.auth.getUser();

  // 更新 joined_at
  const { error } = await supabase
    .from('workspace_members')
    .update({ joined_at: new Date().toISOString() })
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .is('joined_at', null);

  if (error) {
    return new Response('Invite not found', { status: 404 });
  }

  return new Response(JSON.stringify({ success: true }));
});
```

---

## 變更角色

### 前端呼叫

```typescript
async function updateMemberRole(
  workspaceId: string,
  targetUserId: string,
  newRole: 'owner' | 'editor' | 'viewer'
) {
  // 防止降級最後一個 Owner
  if (newRole !== 'owner') {
    const { data: owners } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .eq('role', 'owner');

    if (owners?.length === 1 && owners[0].user_id === targetUserId) {
      throw new Error('Cannot demote the last owner');
    }
  }

  const { error } = await supabase
    .from('workspace_members')
    .update({ role: newRole })
    .eq('workspace_id', workspaceId)
    .eq('user_id', targetUserId);

  if (error) throw error;
}
```

---

## 移除成員

### Edge Function（建議）

成員移除涉及 token 安全處理（`auto_revoke_at`），本專案已鎖定 `workspace_threads_tokens` 禁止 client 直接存取，因此請使用 Edge Function：

```
POST /functions/v1/workspace-member-remove
Headers: Authorization: Bearer <user_jwt>
Body: { "workspace_id": "uuid", "target_user_id": "uuid" }
```

- 權限：僅 Workspace `owner`
- 行為：
  - 若目標用戶曾授權過本 workspace 的 Threads tokens，會自動設定 `auto_revoke_at`（預設 7 天後）
  - 刪除 `workspace_members` 記錄

實作位置：`supabase/functions/workspace-member-remove/index.ts`

---

### （舊）直接查表（不建議，且會被拒絕）

> `workspace_threads_tokens` 已鎖定禁止 client 直接存取，請改用 `workspace-member-remove`。

---

## 成員離開

### 前端呼叫

```typescript
async function leaveWorkspace(workspaceId: string) {
  const { data: { user } } = await supabase.auth.getUser();

  // 檢查是否為最後一個 Owner
  const { data: membership } = await supabase
    .from('workspace_members')
    .select('role')
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id)
    .single();

  if (membership?.role === 'owner') {
    const { data: owners } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .eq('role', 'owner');

    if (owners?.length === 1) {
      throw new Error('Cannot leave as the last owner');
    }
  }

  // 離開
  await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', user.id);
}
```

---

## 列表成員

```typescript
async function listMembers(workspaceId: string) {
  const { data } = await supabase
    .from('workspace_members')
    .select(`
      user_id,
      role,
      invited_at,
      joined_at,
      invited_by
    `)
    .eq('workspace_id', workspaceId);

  return data;
}
```
