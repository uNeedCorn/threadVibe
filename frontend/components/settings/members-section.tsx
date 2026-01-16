"use client";

import { useState, useEffect } from "react";
import { Plus, MoreHorizontal, UserMinus, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";

interface Member {
  workspace_id: string;
  user_id: string;
  role: "owner" | "editor" | "viewer";
  joined_at: string;
  user: {
    id: string;
    email: string;
    raw_user_meta_data: {
      full_name?: string;
      avatar_url?: string;
    };
  };
}

const roleLabels: Record<string, string> = {
  owner: "擁有者",
  editor: "編輯者",
  viewer: "檢視者",
};

export function MembersSection() {
  const [members, setMembers] = useState<Member[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isOwner, setIsOwner] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("viewer");

  useEffect(() => {
    fetchMembers();
  }, []);

  async function fetchMembers() {
    const supabase = createClient();
    const workspaceId = localStorage.getItem("currentWorkspaceId");

    // 取得當前使用者
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentUserId(user.id);
    }

    if (!workspaceId) {
      setIsLoading(false);
      return;
    }

    // 取得成員列表
    const { data } = await supabase
      .from("workspace_members")
      .select(`
        workspace_id,
        user_id,
        role,
        joined_at
      `)
      .eq("workspace_id", workspaceId)
      .order("joined_at", { ascending: true });

    if (data) {
      // 檢查當前使用者是否為 owner
      const currentMember = data.find(m => m.user_id === user?.id);
      setIsOwner(currentMember?.role === "owner");

      // 模擬使用者資料（實際應該 join users 表或從 auth 取得）
      const membersWithUser = data.map(m => ({
        ...m,
        user: {
          id: m.user_id,
          email: `user-${m.user_id.slice(0, 8)}@example.com`,
          raw_user_meta_data: {
            full_name: `User ${m.user_id.slice(0, 8)}`,
          },
        },
      }));
      setMembers(membersWithUser as unknown as Member[]);
    }
    setIsLoading(false);
  }

  const handleInvite = async () => {
    // TODO: 實作邀請成員 API
    alert(`邀請 ${inviteEmail} 為 ${roleLabels[inviteRole]}`);
    setIsInviteOpen(false);
    setInviteEmail("");
    setInviteRole("viewer");
  };

  const handleRoleChange = async (memberId: string, newRole: string) => {
    // TODO: 實作變更角色 API
    alert(`變更角色為 ${roleLabels[newRole]}`);
  };

  const handleRemove = async (memberId: string) => {
    if (!confirm("確定要移除此成員嗎？")) return;
    // TODO: 實作移除成員 API
    alert("移除成員...");
  };

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "owner":
        return "default";
      case "editor":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>成員管理</CardTitle>
          <CardDescription>管理 Workspace 成員與權限</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>成員管理</CardTitle>
            <CardDescription>管理 Workspace 成員與權限</CardDescription>
          </div>
          {isOwner && (
            <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 size-4" />
                  邀請成員
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>邀請成員</DialogTitle>
                  <DialogDescription>
                    輸入 Email 邀請新成員加入此 Workspace
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="member@example.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">角色</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="editor">編輯者</SelectItem>
                        <SelectItem value="viewer">檢視者</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsInviteOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleInvite} disabled={!inviteEmail}>
                    發送邀請
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {members.map((member) => (
            <div
              key={member.user_id}
              className="flex items-center justify-between rounded-lg border p-4"
            >
              <div className="flex items-center gap-4">
                <Avatar className="size-10">
                  <AvatarImage src={member.user.raw_user_meta_data?.avatar_url} />
                  <AvatarFallback>
                    {(member.user.raw_user_meta_data?.full_name || member.user.email)
                      .slice(0, 2)
                      .toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">
                      {member.user.raw_user_meta_data?.full_name || member.user.email}
                    </span>
                    <Badge variant={getRoleBadgeVariant(member.role) as "default" | "secondary" | "outline"}>
                      {roleLabels[member.role]}
                    </Badge>
                    {member.user.id === currentUserId && (
                      <Badge variant="outline">你</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {member.user.email}
                  </p>
                </div>
              </div>
              {isOwner && member.user.id !== currentUserId && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleRoleChange(member.user_id, "editor")}>
                      <Shield className="mr-2 size-4" />
                      設為編輯者
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleRoleChange(member.user_id, "viewer")}>
                      <Shield className="mr-2 size-4" />
                      設為檢視者
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleRemove(member.user_id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <UserMinus className="mr-2 size-4" />
                      移除成員
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
