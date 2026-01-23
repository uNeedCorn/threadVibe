"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAdmin } from "@/contexts/admin-context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Building2, User, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface Workspace {
  id: string;
  name: string;
  owner_email: string;
  accounts_count: number;
}

interface Account {
  id: string;
  username: string;
  profile_pic_url: string | null;
}

export default function AdminPage() {
  const { isAdmin, isCheckingAdmin, isImpersonating, impersonationTarget, startImpersonation, stopImpersonation } = useAdmin();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [isLoadingWorkspaces, setIsLoadingWorkspaces] = useState(true);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

  // 載入所有 workspaces
  useEffect(() => {
    console.log("[Admin] isAdmin:", isAdmin, "isCheckingAdmin:", isCheckingAdmin);
    if (!isAdmin) return;

    const fetchWorkspaces = async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("rpc_admin_list_all_workspaces");

      console.log("[Admin] fetchWorkspaces result:", { data, error });

      if (!error && data) {
        setWorkspaces(data);
      }
      setIsLoadingWorkspaces(false);
    };

    fetchWorkspaces();
  }, [isAdmin, isCheckingAdmin]);

  // 載入選中 workspace 的 accounts
  useEffect(() => {
    if (!selectedWorkspace) {
      setAccounts([]);
      return;
    }

    const fetchAccounts = async () => {
      setIsLoadingAccounts(true);
      const supabase = createClient();
      const { data, error } = await supabase.rpc("rpc_admin_list_workspace_accounts", {
        p_workspace_id: selectedWorkspace.id,
      });

      if (!error && data) {
        setAccounts(data);
      }
      setIsLoadingAccounts(false);
    };

    fetchAccounts();
  }, [selectedWorkspace]);

  const handleStartImpersonation = (account: Account) => {
    if (!selectedWorkspace) return;

    startImpersonation({
      workspaceId: selectedWorkspace.id,
      workspaceName: selectedWorkspace.name,
      accountId: account.id,
      accountUsername: account.username,
    });
  };

  // 檢查中
  if (isCheckingAdmin) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 非 admin
  if (!isAdmin) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4">
        <div className="text-4xl font-bold text-destructive">Access Denied</div>
        <p className="text-muted-foreground">You do not have permission to access this page.</p>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen bg-background p-8", isImpersonating && "pt-16")}>
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Panel</h1>
            <p className="text-muted-foreground">Impersonate any workspace and account for debugging</p>
          </div>
          {isImpersonating && (
            <Button variant="destructive" onClick={stopImpersonation}>
              <EyeOff className="mr-2 h-4 w-4" />
              Stop Impersonation
            </Button>
          )}
        </div>

        {isImpersonating && impersonationTarget && (
          <Card className="mb-6 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="flex items-center gap-4 py-4">
              <Eye className="h-5 w-5 text-amber-600" />
              <div>
                <span className="font-medium">Currently impersonating: </span>
                <span className="font-bold">
                  {impersonationTarget.workspaceName} / @{impersonationTarget.accountUsername}
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Workspaces 列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Workspaces
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingWorkspaces ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : workspaces.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No workspaces found</p>
              ) : (
                <div className="space-y-2">
                  {workspaces.map((workspace) => (
                    <button
                      key={workspace.id}
                      onClick={() => setSelectedWorkspace(workspace)}
                      className={cn(
                        "w-full rounded-lg border p-4 text-left transition-colors hover:bg-accent",
                        selectedWorkspace?.id === workspace.id && "border-primary bg-accent"
                      )}
                    >
                      <div className="font-medium">{workspace.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {workspace.owner_email} &bull; {workspace.accounts_count} account(s)
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Accounts 列表 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Accounts
                {selectedWorkspace && (
                  <span className="text-sm font-normal text-muted-foreground">
                    in {selectedWorkspace.name}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!selectedWorkspace ? (
                <p className="py-8 text-center text-muted-foreground">
                  Select a workspace to view accounts
                </p>
              ) : isLoadingAccounts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : accounts.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No accounts in this workspace</p>
              ) : (
                <div className="space-y-2">
                  {accounts.map((account) => {
                    const isCurrentlyImpersonating =
                      isImpersonating &&
                      impersonationTarget?.workspaceId === selectedWorkspace.id &&
                      impersonationTarget?.accountId === account.id;

                    return (
                      <div
                        key={account.id}
                        className={cn(
                          "flex items-center justify-between rounded-lg border p-4",
                          isCurrentlyImpersonating && "border-amber-500 bg-amber-50 dark:bg-amber-950/20"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          {account.profile_pic_url ? (
                            <img
                              src={account.profile_pic_url}
                              alt={account.username}
                              className="h-10 w-10 rounded-full"
                            />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                              <User className="h-5 w-5 text-muted-foreground" />
                            </div>
                          )}
                          <span className="font-medium">@{account.username}</span>
                        </div>
                        {isCurrentlyImpersonating ? (
                          <Button variant="outline" size="sm" onClick={stopImpersonation}>
                            <EyeOff className="mr-2 h-4 w-4" />
                            Stop
                          </Button>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleStartImpersonation(account)}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Impersonate
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
