"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/client";

interface WorkspaceInfo {
  id: string;
  name: string;
  accounts_count: number;
  posts_count: number;
  members_count: number;
}

interface BlockingWorkspace {
  workspace_id: string;
  workspace_name: string;
  other_members_count: number;
}

export function DangerZoneSection() {
  const router = useRouter();

  // Workspace info
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);

  // Delete Workspace (L2)
  const [isDeleteWorkspaceOpen, setIsDeleteWorkspaceOpen] = useState(false);
  const [workspaceConfirmText, setWorkspaceConfirmText] = useState("");
  const [isDeletingWorkspace, setIsDeletingWorkspace] = useState(false);
  const [deleteWorkspaceError, setDeleteWorkspaceError] = useState<string | null>(null);

  // Delete Account (L3)
  const [isDeleteAccountOpen, setIsDeleteAccountOpen] = useState(false);
  const [accountConfirmText, setAccountConfirmText] = useState("");
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [deleteAccountError, setDeleteAccountError] = useState<string | null>(null);
  const [blockingWorkspaces, setBlockingWorkspaces] = useState<BlockingWorkspace[]>([]);

  useEffect(() => {
    fetchWorkspaceInfo();
  }, []);

  async function fetchWorkspaceInfo() {
    const workspaceId = localStorage.getItem("currentWorkspaceId");
    if (!workspaceId) {
      setIsLoadingWorkspace(false);
      return;
    }

    const supabase = createClient();

    // Get workspace details
    const { data: workspaceData } = await supabase
      .from("workspaces")
      .select("id, name")
      .eq("id", workspaceId)
      .single();

    if (!workspaceData) {
      setIsLoadingWorkspace(false);
      return;
    }

    // Get counts
    const { data: accounts, count: accountsCount } = await supabase
      .from("workspace_threads_accounts")
      .select("id", { count: "exact" })
      .eq("workspace_id", workspaceId)
      .eq("is_active", true);

    // Get posts count via account IDs (workspace_threads_posts doesn't have workspace_id)
    const accountIds = accounts?.map((a) => a.id) || [];
    let postsCount = 0;
    if (accountIds.length > 0) {
      const { count } = await supabase
        .from("workspace_threads_posts")
        .select("*", { count: "exact", head: true })
        .in("workspace_threads_account_id", accountIds);
      postsCount = count || 0;
    }

    const { count: membersCount } = await supabase
      .from("workspace_members")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);

    setWorkspace({
      id: workspaceData.id,
      name: workspaceData.name,
      accounts_count: accountsCount || 0,
      posts_count: postsCount || 0,
      members_count: membersCount || 0,
    });
    setIsLoadingWorkspace(false);
  }

  const handleDeleteWorkspace = async () => {
    if (!workspace || workspaceConfirmText !== workspace.name) return;

    setIsDeletingWorkspace(true);
    setDeleteWorkspaceError(null);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setDeleteWorkspaceError("請先登入");
        return;
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/delete-workspace`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            workspace_id: workspace.id,
            confirmation: workspace.name,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "刪除 Workspace 失敗");
      }

      // Clear local storage and redirect
      localStorage.removeItem("currentWorkspaceId");
      router.push("/dashboard");
      router.refresh();
    } catch (error) {
      console.error("Delete workspace error:", error);
      setDeleteWorkspaceError(
        error instanceof Error ? error.message : "刪除 Workspace 失敗"
      );
    } finally {
      setIsDeletingWorkspace(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (accountConfirmText !== "刪除我的帳號") return;

    setIsDeletingAccount(true);
    setDeleteAccountError(null);
    setBlockingWorkspaces([]);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setDeleteAccountError("請先登入");
        return;
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/delete-user-account`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            confirmation: "刪除我的帳號",
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (result.error === "SOLE_OWNER_WITH_MEMBERS") {
          setBlockingWorkspaces(result.blocking_workspaces || []);
          setDeleteAccountError(result.message);
          return;
        }
        throw new Error(result.message || "刪除帳號失敗");
      }

      // Sign out and redirect to home
      await supabase.auth.signOut();
      localStorage.clear();
      router.push("/?deleted=true");
    } catch (error) {
      console.error("Delete account error:", error);
      setDeleteAccountError(
        error instanceof Error ? error.message : "刪除帳號失敗"
      );
    } finally {
      setIsDeletingAccount(false);
    }
  };

  if (isLoadingWorkspace) {
    return (
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">危險區域</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 animate-pulse rounded-lg bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-destructive/50">
      <CardHeader>
        <CardTitle className="text-destructive">危險區域</CardTitle>
        <CardDescription>以下操作不可逆，請謹慎操作</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Delete Workspace (L2) */}
        {workspace && (
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <div>
              <p className="font-medium">刪除 Workspace</p>
              <p className="text-sm text-muted-foreground">
                刪除「{workspace.name}」及所有相關資料
              </p>
            </div>
            <Button
              variant="destructive"
              onClick={() => setIsDeleteWorkspaceOpen(true)}
            >
              <Trash2 className="mr-2 size-4" />
              刪除
            </Button>
          </div>
        )}

        {/* Delete Account (L3) */}
        <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-4">
          <div>
            <p className="font-medium">刪除我的帳號</p>
            <p className="text-sm text-muted-foreground">
              永久刪除你的帳號及所有相關資料
            </p>
          </div>
          <Button
            variant="destructive"
            onClick={() => setIsDeleteAccountOpen(true)}
          >
            <Trash2 className="mr-2 size-4" />
            刪除
          </Button>
        </div>
      </CardContent>

      {/* Delete Workspace Dialog */}
      <Dialog open={isDeleteWorkspaceOpen} onOpenChange={setIsDeleteWorkspaceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              刪除 Workspace
            </DialogTitle>
            <DialogDescription>
              此操作不可逆。刪除後，所有資料將被永久刪除。
            </DialogDescription>
          </DialogHeader>

          {workspace && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-destructive/10 p-4 text-sm">
                <p className="font-medium mb-2">這將永久刪除：</p>
                <ul className="space-y-1 text-muted-foreground">
                  <li>• {workspace.accounts_count} 個已連結的 Threads 帳號</li>
                  <li>• {workspace.posts_count} 篇貼文及所有成效數據</li>
                  <li>• {workspace.members_count} 位成員的存取權限</li>
                  <li>• 所有自訂標籤</li>
                </ul>
              </div>

              <div className="space-y-2">
                <Label htmlFor="workspace-confirm">
                  請輸入 Workspace 名稱「<span className="font-mono font-bold">{workspace.name}</span>」確認刪除
                </Label>
                <Input
                  id="workspace-confirm"
                  value={workspaceConfirmText}
                  onChange={(e) => setWorkspaceConfirmText(e.target.value)}
                  placeholder={workspace.name}
                />
              </div>

              {deleteWorkspaceError && (
                <Alert variant="destructive">
                  <AlertDescription>{deleteWorkspaceError}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteWorkspaceOpen(false);
                setWorkspaceConfirmText("");
                setDeleteWorkspaceError(null);
              }}
              disabled={isDeletingWorkspace}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteWorkspace}
              disabled={
                !workspace ||
                workspaceConfirmText !== workspace.name ||
                isDeletingWorkspace
              }
            >
              {isDeletingWorkspace ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  刪除中...
                </>
              ) : (
                "確認刪除"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Account Dialog */}
      <Dialog open={isDeleteAccountOpen} onOpenChange={setIsDeleteAccountOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              刪除帳號
            </DialogTitle>
            <DialogDescription>
              此操作不可逆。刪除後，你的帳號及所有資料將被永久刪除。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-destructive/10 p-4 text-sm">
              <p className="font-medium mb-2">這將永久刪除：</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• 你的所有個人資料</li>
                <li>• 你擁有的所有 Workspace 及其資料</li>
                <li>• 你在其他 Workspace 的成員資格</li>
              </ul>
            </div>

            {blockingWorkspaces.length > 0 && (
              <Alert variant="destructive">
                <AlertTriangle className="size-4" />
                <AlertDescription>
                  <p className="font-medium mb-2">你是以下 Workspace 的唯一擁有者：</p>
                  <ul className="list-disc list-inside">
                    {blockingWorkspaces.map((ws) => (
                      <li key={ws.workspace_id}>
                        {ws.workspace_name}（{ws.other_members_count} 位成員）
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2">請先轉移擁有權或刪除這些 Workspace。</p>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="account-confirm">
                請輸入「<span className="font-mono font-bold">刪除我的帳號</span>」確認
              </Label>
              <Input
                id="account-confirm"
                value={accountConfirmText}
                onChange={(e) => setAccountConfirmText(e.target.value)}
                placeholder="刪除我的帳號"
              />
            </div>

            {deleteAccountError && !blockingWorkspaces.length && (
              <Alert variant="destructive">
                <AlertDescription>{deleteAccountError}</AlertDescription>
              </Alert>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteAccountOpen(false);
                setAccountConfirmText("");
                setDeleteAccountError(null);
                setBlockingWorkspaces([]);
              }}
              disabled={isDeletingAccount}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteAccount}
              disabled={accountConfirmText !== "刪除我的帳號" || isDeletingAccount}
            >
              {isDeletingAccount ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  刪除中...
                </>
              ) : (
                "確認刪除帳號"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
