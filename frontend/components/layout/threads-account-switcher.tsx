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
        .select("id, username, profile_pic_url")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .order("created_at", { ascending: true });

      if (data && data.length > 0) {
        const accountsList = data.map((a) => ({
          id: a.id,
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
    // 觸發 storage 事件讓其他元件更新
    window.dispatchEvent(new Event("storage"));
  };

  if (isLoading) {
    return (
      <div className="border-b p-4">
        <div className="h-10 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  // 沒有帳號或只有一個帳號時不顯示切換器
  if (accounts.length <= 1) {
    return null;
  }

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  return (
    <div className="border-b p-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between"
          >
            <span className="flex items-center gap-2 truncate">
              <Avatar className="size-5">
                <AvatarImage src={selectedAccount?.profilePicUrl || undefined} />
                <AvatarFallback className="text-[10px]">
                  {selectedAccount?.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span>@{selectedAccount?.username}</span>
            </span>
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
                <Avatar className="size-5">
                  <AvatarImage src={account.profilePicUrl || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {account.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span>@{account.username}</span>
              </div>
              {account.id === selectedAccountId && <Check className="ml-2 size-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
