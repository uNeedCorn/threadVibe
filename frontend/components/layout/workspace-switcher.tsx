"use client";

import { useState, useEffect } from "react";
import { ChevronsUpDown, Plus, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";

interface Workspace {
  id: string;
  name: string;
}

export function WorkspaceSwitcher() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchWorkspaces() {
      const supabase = createClient();

      // 取得用戶的所有 Workspace
      const { data: memberships } = await supabase
        .from("workspace_members")
        .select("workspace_id, workspaces(id, name)")
        .order("joined_at", { ascending: true });

      if (memberships && memberships.length > 0) {
        const ws = memberships.map((m) => ({
          id: (m.workspaces as unknown as Workspace).id,
          name: (m.workspaces as unknown as Workspace).name,
        }));
        setWorkspaces(ws);

        // 從 localStorage 讀取上次選擇的 Workspace，或使用第一個
        const savedId = localStorage.getItem("currentWorkspaceId");
        const saved = ws.find((w) => w.id === savedId);
        setCurrentWorkspace(saved || ws[0]);
      }

      setIsLoading(false);
    }

    fetchWorkspaces();
  }, []);

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
          <span className="truncate">{currentWorkspace.name}</span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
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
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer">
          <Plus className="mr-2 size-4" />
          建立新 Workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
