"use client";

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
import { useSelectedAccountContext } from "@/contexts/selected-account-context";

export function ThreadsAccountSwitcher() {
  const {
    accounts,
    selectedAccount,
    selectedAccountId,
    isLoading,
    hasMultipleAccounts,
    switchAccount,
  } = useSelectedAccountContext();

  if (isLoading) {
    return (
      <div className="border-b px-3 py-2">
        <div className="h-10 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  // 沒有帳號時不顯示
  if (accounts.length === 0) {
    return null;
  }

  // 帳號資訊顯示區塊
  const AccountInfo = () => (
    <div className="flex items-center gap-2.5">
      <Avatar className="size-8">
        <AvatarImage src={selectedAccount?.profilePicUrl || undefined} />
        <AvatarFallback className="text-xs">
          {selectedAccount?.username.charAt(0).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate leading-tight">
          {selectedAccount?.username}
        </p>
        <p className="text-[11px] text-muted-foreground truncate leading-tight">
          @{selectedAccount?.username}
        </p>
      </div>
    </div>
  );

  // 單一帳號：只顯示帳號資訊，不需要下拉選單
  if (!hasMultipleAccounts) {
    return (
      <div className="border-b px-3 py-2">
        <AccountInfo />
      </div>
    );
  }

  // 多帳號：顯示可切換的下拉選單
  return (
    <div className="border-b px-3 py-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            className="w-full h-auto p-1.5 justify-between hover:bg-accent"
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
              onClick={() => switchAccount(account.id)}
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
