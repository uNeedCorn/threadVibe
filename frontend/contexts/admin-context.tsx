"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";

const IMPERSONATION_WORKSPACE_KEY = "impersonation_workspace_id";
const IMPERSONATION_ACCOUNT_KEY = "impersonation_account_id";
const ORIGINAL_WORKSPACE_KEY = "original_workspace_id";
const ORIGINAL_ACCOUNT_KEY = "original_account_id";

interface ImpersonationTarget {
  workspaceId: string;
  workspaceName: string;
  accountId: string;
  accountUsername: string;
}

interface AdminContextValue {
  /** 是否為系統管理員 */
  isAdmin: boolean;
  /** 是否正在檢查 admin 狀態 */
  isCheckingAdmin: boolean;
  /** 是否正在模擬中 */
  isImpersonating: boolean;
  /** 模擬目標資訊 */
  impersonationTarget: ImpersonationTarget | null;
  /** 開始模擬 */
  startImpersonation: (target: ImpersonationTarget) => void;
  /** 結束模擬 */
  stopImpersonation: () => void;
  /** 取得有效的 workspace ID（模擬中返回被模擬的，否則返回原本的） */
  getEffectiveWorkspaceId: () => string | null;
  /** 取得有效的 account ID（模擬中返回被模擬的，否則返回原本的） */
  getEffectiveAccountId: () => string | null;
}

const AdminContext = createContext<AdminContextValue | null>(null);

interface AdminProviderProps {
  children: ReactNode;
}

export function AdminProvider({ children }: AdminProviderProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCheckingAdmin, setIsCheckingAdmin] = useState(true);
  const [impersonationTarget, setImpersonationTarget] =
    useState<ImpersonationTarget | null>(null);

  // 檢查是否為系統管理員
  useEffect(() => {
    const checkAdmin = async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("is_system_admin");

      if (!error && data === true) {
        setIsAdmin(true);

        // 從 localStorage 恢復 impersonation 狀態
        const savedWorkspaceId = localStorage.getItem(IMPERSONATION_WORKSPACE_KEY);
        const savedAccountId = localStorage.getItem(IMPERSONATION_ACCOUNT_KEY);

        if (savedWorkspaceId && savedAccountId) {
          // 查詢 workspace 和 account 名稱
          const [workspaceRes, accountRes] = await Promise.all([
            supabase
              .from("workspaces")
              .select("name")
              .eq("id", savedWorkspaceId)
              .single(),
            supabase
              .from("workspace_threads_accounts")
              .select("username")
              .eq("id", savedAccountId)
              .single(),
          ]);

          if (workspaceRes.data && accountRes.data) {
            setImpersonationTarget({
              workspaceId: savedWorkspaceId,
              workspaceName: workspaceRes.data.name,
              accountId: savedAccountId,
              accountUsername: accountRes.data.username,
            });
          }
        }
      }

      setIsCheckingAdmin(false);
    };

    checkAdmin();
  }, []);

  const startImpersonation = useCallback((target: ImpersonationTarget) => {
    const currentWorkspace = localStorage.getItem("currentWorkspaceId");
    const currentAccount = localStorage.getItem("currentThreadsAccountId");

    // 保存原本的 workspace/account（只在沒有保存過時才保存）
    // 確保不是已經在模擬中（避免覆蓋真正的原始值）
    const existingOriginalWorkspace = localStorage.getItem(ORIGINAL_WORKSPACE_KEY);
    if (!existingOriginalWorkspace && currentWorkspace && currentWorkspace !== target.workspaceId) {
      localStorage.setItem(ORIGINAL_WORKSPACE_KEY, currentWorkspace);
    }

    const existingOriginalAccount = localStorage.getItem(ORIGINAL_ACCOUNT_KEY);
    if (!existingOriginalAccount && currentAccount && currentAccount !== target.accountId) {
      localStorage.setItem(ORIGINAL_ACCOUNT_KEY, currentAccount);
    }

    setImpersonationTarget(target);
    localStorage.setItem(IMPERSONATION_WORKSPACE_KEY, target.workspaceId);
    localStorage.setItem(IMPERSONATION_ACCOUNT_KEY, target.accountId);

    // 更新 currentWorkspaceId 和 currentThreadsAccountId，觸發整個 app 重新載入資料
    localStorage.setItem("currentWorkspaceId", target.workspaceId);
    localStorage.setItem("currentThreadsAccountId", target.accountId);

    // 跳轉到 dashboard 以套用新的 workspace/account
    window.location.href = "/dashboard";
  }, []);

  const stopImpersonation = useCallback(() => {
    // 恢復原本的 workspace/account
    const originalWorkspace = localStorage.getItem(ORIGINAL_WORKSPACE_KEY);
    const originalAccount = localStorage.getItem(ORIGINAL_ACCOUNT_KEY);

    if (originalWorkspace) {
      localStorage.setItem("currentWorkspaceId", originalWorkspace);
    }
    if (originalAccount) {
      localStorage.setItem("currentThreadsAccountId", originalAccount);
    }

    // 清除 impersonation 狀態
    localStorage.removeItem(IMPERSONATION_WORKSPACE_KEY);
    localStorage.removeItem(IMPERSONATION_ACCOUNT_KEY);
    localStorage.removeItem(ORIGINAL_WORKSPACE_KEY);
    localStorage.removeItem(ORIGINAL_ACCOUNT_KEY);

    setImpersonationTarget(null);

    // 跳轉到 dashboard
    window.location.href = "/dashboard";
  }, []);

  const getEffectiveWorkspaceId = useCallback(() => {
    if (impersonationTarget) {
      return impersonationTarget.workspaceId;
    }
    return localStorage.getItem("currentWorkspaceId");
  }, [impersonationTarget]);

  const getEffectiveAccountId = useCallback(() => {
    if (impersonationTarget) {
      return impersonationTarget.accountId;
    }
    return localStorage.getItem("currentThreadsAccountId");
  }, [impersonationTarget]);

  const isImpersonating = impersonationTarget !== null;

  return (
    <AdminContext.Provider
      value={{
        isAdmin,
        isCheckingAdmin,
        isImpersonating,
        impersonationTarget,
        startImpersonation,
        stopImpersonation,
        getEffectiveWorkspaceId,
        getEffectiveAccountId,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin(): AdminContextValue {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error("useAdmin must be used within AdminProvider");
  }
  return context;
}
