"use client";

import { useState, useEffect } from "react";
import { ChevronsUpDown, Check } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";

interface ThreadsAccount {
  id: string;
  threadsUserId: string;
  username: string;
  profilePicUrl: string | null;
}

export function ThreadsAccountSwitcher() {
  const [accounts, setAccounts] = useState<ThreadsAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchAccounts() {
      const supabase = createClient();
      const workspaceId = localStorage.getItem("currentWorkspaceId");

      if (!workspaceId) {
        setIsLoading(false);
        return;
      }

      const { data } = await supabase
        .from("workspace_threads_accounts")
        .select("id, threads_user_id, username, profile_pic_url")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (data && data.length > 0) {
        const accountsList = data.map((a) => ({
          id: a.id,
          threadsUserId: a.threads_user_id,
          username: a.username,
          profilePicUrl: a.profile_pic_url,
        }));
        setAccounts(accountsList);

        // 從 localStorage 讀取上次選擇的帳號，或使用第一個
        const savedId = localStorage.getItem("currentThreadsAccountId");
        const validSavedId = savedId && accountsList.some((a) => a.id === savedId);
        const initialId = validSavedId ? savedId : accountsList[0].id;

        setSelectedAccountId(initialId);
        localStorage.setItem("currentThreadsAccountId", initialId);
      }

      setIsLoading(false);
    }

    fetchAccounts();
  }, []);

  const handleSelect = (accountId: string) => {
    setSelectedAccountId(accountId);
    localStorage.setItem("currentThreadsAccountId", accountId);
    // 重新整理頁面以載入新帳號的資料
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div className="border-b p-4">
        <div className="h-14 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  // 沒有帳號時不顯示
  if (accounts.length === 0) {
    return null;
  }

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);
  const hasMultipleAccounts = accounts.length > 1;

  // 帳號資訊顯示區塊
  const AccountInfo = () => (
    <div className="flex items-center gap-3">
      <Avatar className="size-10">
        <AvatarImage src={selectedAccount?.profilePicUrl || undefined} />
        <AvatarFallback className="text-sm">
          {selectedAccount?.username.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {selectedAccount?.username}
        </p>
        <p className="text-xs text-muted-foreground truncate">
          @{selectedAccount?.username}
        </p>
      </div>
    </div>
  );

  // 單一帳號：只顯示帳號資訊，不需要下拉選單
  if (!hasMultipleAccounts) {
    return (
      <div className="border-b p-4">
        <AccountInfo />
      </div>
    );
  }

  // 多帳號：顯示可切換的下拉選單
  return (
    <div className="border-b p-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="w-full h-auto p-2 justify-between hover:bg-accent"
          >
            <AccountInfo />
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="start">
          <DropdownMenuLabel>切換帳號</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {accounts.map((account) => (
            <DropdownMenuItem
              key={account.id}
              onClick={() => handleSelect(account.id)}
              className="cursor-pointer"
            >
              <div className="flex flex-1 items-center gap-2">
                <Avatar className="size-6">
                  <AvatarImage src={account.profilePicUrl || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {account.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{account.username}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    @{account.username}
                  </p>
                </div>
              </div>
              {account.id === selectedAccountId && <Check className="ml-2 size-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
