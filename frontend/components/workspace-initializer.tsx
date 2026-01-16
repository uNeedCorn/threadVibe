"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";

/**
 * 確保使用者有 workspace 的初始化元件
 * 1. 從 URL 參數讀取 workspace_id 並儲存到 localStorage
 * 2. 如果沒有 workspace，呼叫 API 建立一個（補救機制）
 */
export function WorkspaceInitializer() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const hasChecked = useRef(false);

  useEffect(() => {
    const workspaceId = searchParams.get("workspace_id");

    if (workspaceId) {
      // 從 URL 參數儲存到 localStorage
      localStorage.setItem("currentWorkspaceId", workspaceId);

      // 清除 URL 參數
      const newSearchParams = new URLSearchParams(searchParams.toString());
      newSearchParams.delete("workspace_id");

      const newUrl = newSearchParams.toString()
        ? `${pathname}?${newSearchParams.toString()}`
        : pathname;

      router.replace(newUrl);
      return;
    }

    // 補救機制：如果 localStorage 沒有 workspace，嘗試取得或建立
    const storedWorkspaceId = localStorage.getItem("currentWorkspaceId");
    if (!storedWorkspaceId && !hasChecked.current) {
      hasChecked.current = true;
      ensureWorkspace();
    }
  }, [searchParams, router, pathname]);

  async function ensureWorkspace() {
    try {
      const response = await fetch("/api/ensure-workspace", {
        method: "POST",
      });

      if (response.ok) {
        const data = await response.json();
        if (data.workspace_id) {
          localStorage.setItem("currentWorkspaceId", data.workspace_id);
          // 觸發頁面重新整理以更新 UI
          window.location.reload();
        }
      }
    } catch (error) {
      console.error("Failed to ensure workspace:", error);
    }
  }

  return null;
}
