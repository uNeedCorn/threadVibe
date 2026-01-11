"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "currentThreadsAccountId";

interface UseSelectedAccountResult {
  /** 選擇的帳號 ID */
  selectedAccountId: string | null;
  /** 是否正在載入 */
  isLoading: boolean;
}

/**
 * 取得當前選擇的 Threads 帳號
 *
 * 從 localStorage 讀取 currentThreadsAccountId，
 * 並監聽 storage 事件以同步更新。
 */
export function useSelectedAccount(): UseSelectedAccountResult {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 初始讀取
    const saved = localStorage.getItem(STORAGE_KEY);
    setSelectedAccountId(saved);
    setIsLoading(false);

    // 監聽 storage 事件（由 ThreadsAccountSwitcher 觸發）
    const handleStorage = () => {
      const current = localStorage.getItem(STORAGE_KEY);
      setSelectedAccountId(current);
    };

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  return {
    selectedAccountId,
    isLoading,
  };
}
