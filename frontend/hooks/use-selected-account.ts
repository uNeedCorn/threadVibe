"use client";

import { useSelectedAccountContext } from "@/contexts/selected-account-context";

interface UseSelectedAccountResult {
  /** 選擇的帳號 ID */
  selectedAccountId: string | null;
  /** 是否正在載入 */
  isLoading: boolean;
}

/**
 * 取得當前選擇的 Threads 帳號
 *
 * 從 SelectedAccountContext 讀取當前選擇的帳號。
 * 切換帳號時會自動觸發使用此 hook 的元件重新渲染。
 */
export function useSelectedAccount(): UseSelectedAccountResult {
  const { selectedAccountId, isLoading } = useSelectedAccountContext();

  return {
    selectedAccountId,
    isLoading,
  };
}
