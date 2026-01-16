"use client";

import { useState, useEffect } from "react";
import { ChevronsUpDown, Plus, Check, Shield } from "lucide-react";
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

interface Workspace {
  id: string;
  name: string;
}

interface WorkspaceSwitcherProps {
  /** 是否為系統管理員（可查看所有 workspace） */
  isAdmin?: boolean;
}

export function WorkspaceSwitcher({ isAdmin = false }: WorkspaceSwitcherProps) {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchWorkspaces() {
      const supabase = createClient();

      let ws: Workspace[] = [];

      if (isAdmin) {
        // 管理員：查詢所有 workspace
        const { data: allWorkspaces } = await supabase
          .from("workspaces")
          .select("id, name")
          .order("created_at", { ascending: true });

        if (allWorkspaces) {
          ws = allWorkspaces;
        }
      } else {
        // 一般使用者：只查詢自己有成員權限的 workspace
        const { data: memberships } = await supabase
          .from("workspace_members")
          .select("workspace_id, workspaces(id, name)")
          .order("joined_at", { ascending: true });

        if (memberships && memberships.length > 0) {
          ws = memberships.map((m) => ({
            id: (m.workspaces as unknown as Workspace).id,
            name: (m.workspaces as unknown as Workspace).name,
          }));
        }
      }

      if (ws.length > 0) {
        setWorkspaces(ws);

        // 從 localStorage 讀取上次選擇的 Workspace，或使用第一個
        const savedId = localStorage.getItem("currentWorkspaceId");
        const saved = ws.find((w) => w.id === savedId);
        setCurrentWorkspace(saved || ws[0]);
      }

      setIsLoading(false);
    }

    fetchWorkspaces();
  }, [isAdmin]);

  const handleSelect = (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    localStorage.setItem("currentWorkspaceId", workspace.id);
    // 重新載入頁面以更新資料
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div className="border-b p-4">
        <div className="h-10 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (!currentWorkspace) {
    return null;
  }

  return (
    <div className="border-b p-4">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="w-full justify-between"
          >
            <span className="flex items-center gap-2 truncate">
              {isAdmin && <Shield className="size-4 text-amber-500" />}
              {currentWorkspace.name}
            </span>
            <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-56" align="start">
          {isAdmin && (
            <>
              <DropdownMenuLabel className="flex items-center gap-2 text-amber-600">
                <Shield className="size-4" />
                管理員模式（僅供查看）
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
            </>
          )}
          {workspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace.id}
              onClick={() => handleSelect(workspace)}
              className="cursor-pointer"
            >
              <span className="flex-1 truncate">{workspace.name}</span>
              {workspace.id === currentWorkspace.id && (
                <Check className="ml-2 size-4" />
              )}
            </DropdownMenuItem>
          ))}
          {/* 一般使用者才顯示建立新工作區（管理員不可建立） */}
          {!isAdmin && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer">
                <Plus className="mr-2 size-4" />
                建立新工作區
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
