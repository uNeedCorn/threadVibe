"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, RefreshCw, Unlink, ExternalLink, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/client";

interface ThreadsAccount {
  id: string;
  threads_user_id: string;
  username: string;
  profile_pic_url: string | null;
  is_active: boolean;
  last_insights_sync_at: string | null;
}

export function ThreadsAccountsSection() {
  const searchParams = useSearchParams();
  const [accounts, setAccounts] = useState<ThreadsAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // 處理 OAuth 回調的 URL 參數
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");
    const account = searchParams.get("account");
    const errorMessage = searchParams.get("message");

    if (success === "threads_connected" && account) {
      setMessage({ type: "success", text: `已成功連結 @${account}` });
      // 清除 URL 參數
      window.history.replaceState({}, "", "/settings");
    } else if (error === "threads_auth_failed") {
      setMessage({ type: "error", text: errorMessage || "連結 Threads 帳號失敗" });
      window.history.replaceState({}, "", "/settings");
    }
  }, [searchParams]);

  useEffect(() => {
    fetchAccounts();
  }, []);

  async function fetchAccounts() {
    const supabase = createClient();
    const workspaceId = localStorage.getItem("currentWorkspaceId");

    if (!workspaceId) {
      setIsLoading(false);
      return;
    }

    const { data } = await supabase
      .from("workspace_threads_accounts")
      .select("id, threads_user_id, username, profile_pic_url, is_active, last_insights_sync_at")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });

    if (data) {
      setAccounts(data);
    }
    setIsLoading(false);
  }

  const handleConnectAccount = async () => {
    const workspaceId = localStorage.getItem("currentWorkspaceId");
    if (!workspaceId) {
      setMessage({ type: "error", text: "請先選擇 Workspace" });
      return;
    }

    setIsConnecting(true);
    setMessage(null);

    // 使用 Next.js API route 處理 OAuth（會自動帶上 session）
    window.location.href = `/api/threads-oauth?workspace_id=${workspaceId}`;
  };

  const handleReauthorize = async (accountId: string) => {
    // 重新授權使用相同的 OAuth 流程
    await handleConnectAccount();
  };

  const handleUnlink = async (accountId: string) => {
    if (!confirm("確定要解除連結此帳號嗎？相關的貼文資料將會被刪除。")) {
      return;
    }

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setMessage({ type: "error", text: "請先登入" });
        return;
      }

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const response = await fetch(
        `${supabaseUrl}/functions/v1/threads-account-unlink`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ workspace_threads_account_id: accountId }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "解除連結失敗");
      }

      setMessage({ type: "success", text: "已成功解除連結" });
      fetchAccounts();
    } catch (error) {
      console.error("Unlink account error:", error);
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "解除連結失敗",
      });
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Threads 帳號</CardTitle>
          <CardDescription>管理連結的 Threads 帳號</CardDescription>
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
            <CardTitle>Threads 帳號</CardTitle>
            <CardDescription>管理連結的 Threads 帳號</CardDescription>
          </div>
          <Button onClick={handleConnectAccount} disabled={isConnecting}>
            {isConnecting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Plus className="mr-2 size-4" />
            )}
            {isConnecting ? "連結中..." : "連結帳號"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 訊息提示 */}
        {message && (
          <Alert variant={message.type === "error" ? "destructive" : "default"}>
            {message.type === "success" ? (
              <CheckCircle2 className="size-4" />
            ) : (
              <AlertCircle className="size-4" />
            )}
            <AlertDescription>{message.text}</AlertDescription>
          </Alert>
        )}

        {accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-muted-foreground">尚未連結任何 Threads 帳號</p>
            <Button variant="outline" className="mt-4" onClick={handleConnectAccount} disabled={isConnecting}>
              {isConnecting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Plus className="mr-2 size-4" />
              )}
              連結你的第一個帳號
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {accounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-4">
                  <Avatar className="size-12">
                    <AvatarImage src={account.profile_pic_url || undefined} />
                    <AvatarFallback>
                      {account.username?.slice(0, 2).toUpperCase() || "TH"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">@{account.username}</span>
                      {account.is_active && <Badge variant="default" className="bg-green-500">有效</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {account.last_insights_sync_at
                        ? `最後同步：${new Date(account.last_insights_sync_at).toLocaleString("zh-TW")}`
                        : "尚未同步"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.open(`https://threads.net/@${account.username}`, "_blank")}
                  >
                    <ExternalLink className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleReauthorize(account.id)}
                  >
                    <RefreshCw className="mr-2 size-4" />
                    重新授權
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleUnlink(account.id)}
                  >
                    <Unlink className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
