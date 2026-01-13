"use client";

import { useState, useEffect } from "react";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const SIDEBAR_COLLAPSED_KEY = "sidebarCollapsed";

export function Header() {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 從 localStorage 讀取收折狀態
  useEffect(() => {
    const saved = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (saved === "true") {
      setIsCollapsed(true);
    }

    // 監聽 storage 事件（跨組件同步）
    const handleStorage = () => {
      const current = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      setIsCollapsed(current === "true");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const toggleCollapsed = () => {
    const newValue = !isCollapsed;
    setIsCollapsed(newValue);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newValue));
    // 觸發 storage 事件讓 Sidebar 更新
    window.dispatchEvent(new Event("storage"));
  };

  return (
    <header className="flex h-16 items-center border-b bg-card px-6">
      {/* Sidebar Toggle Button */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className="size-9"
          >
            {isCollapsed ? (
              <PanelLeft className="size-5" />
            ) : (
              <PanelLeftClose className="size-5" />
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {isCollapsed ? "展開側邊欄" : "收合側邊欄"}
        </TooltipContent>
      </Tooltip>
    </header>
  );
}
