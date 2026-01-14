"use client";

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

const STORAGE_KEY = "currentThreadsAccountId";

interface ThreadsAccount {
  id: string;
  threadsUserId: string;
  username: string;
  profilePicUrl: string | null;
}

interface SelectedAccountContextValue {
  /** 所有可用的帳號列表 */
  accounts: ThreadsAccount[];
  /** 選擇的帳號 ID */
  selectedAccountId: string | null;
  /** 選擇的帳號物件 */
  selectedAccount: ThreadsAccount | null;
  /** 是否正在載入 */
  isLoading: boolean;
  /** 是否有多個帳號 */
  hasMultipleAccounts: boolean;
  /** 切換帳號 */
  switchAccount: (accountId: string) => void;
  /** 重新載入帳號列表 */
  refreshAccounts: () => Promise<void>;
}

const SelectedAccountContext = createContext<SelectedAccountContextValue | null>(null);

interface SelectedAccountProviderProps {
  children: ReactNode;
}

export function SelectedAccountProvider({ children }: SelectedAccountProviderProps) {
  const [accounts, setAccounts] = useState<ThreadsAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAccounts = useCallback(async () => {
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
      const savedId = localStorage.getItem(STORAGE_KEY);
      const validSavedId = savedId && accountsList.some((a) => a.id === savedId);
      const initialId = validSavedId ? savedId : accountsList[0].id;

      setSelectedAccountId(initialId);
      localStorage.setItem(STORAGE_KEY, initialId);
    } else {
      setAccounts([]);
      setSelectedAccountId(null);
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const switchAccount = useCallback((accountId: string) => {
    if (accountId === selectedAccountId) return;

    setSelectedAccountId(accountId);
    localStorage.setItem(STORAGE_KEY, accountId);
  }, [selectedAccountId]);

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId) || null;
  const hasMultipleAccounts = accounts.length > 1;

  return (
    <SelectedAccountContext.Provider
      value={{
        accounts,
        selectedAccountId,
        selectedAccount,
        isLoading,
        hasMultipleAccounts,
        switchAccount,
        refreshAccounts: fetchAccounts,
      }}
    >
      {children}
    </SelectedAccountContext.Provider>
  );
}

export function useSelectedAccountContext(): SelectedAccountContextValue {
  const context = useContext(SelectedAccountContext);
  if (!context) {
    throw new Error("useSelectedAccountContext must be used within SelectedAccountProvider");
  }
  return context;
}
