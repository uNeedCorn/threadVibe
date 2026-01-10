"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

export function WorkspaceSettingsSection() {
  const [name, setName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchWorkspace();
  }, []);

  async function fetchWorkspace() {
    const supabase = createClient();
    const workspaceId = localStorage.getItem("currentWorkspaceId");

    if (!workspaceId) {
      setIsLoading(false);
      return;
    }

    const { data } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", workspaceId)
      .single();

    if (data) {
      setName(data.name);
      setOriginalName(data.name);
    }
    setIsLoading(false);
  }

  const handleSave = async () => {
    const supabase = createClient();
    const workspaceId = localStorage.getItem("currentWorkspaceId");

    if (!workspaceId || name === originalName) return;

    setIsSaving(true);

    const { error } = await supabase
      .from("workspaces")
      .update({ name })
      .eq("id", workspaceId);

    if (error) {
      alert("儲存失敗：" + error.message);
    } else {
      setOriginalName(name);
      // 重新載入頁面以更新 Sidebar
      window.location.reload();
    }

    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Workspace 設定</CardTitle>
          <CardDescription>修改 Workspace 名稱</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-10 animate-pulse rounded-lg bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Workspace 設定</CardTitle>
        <CardDescription>修改 Workspace 名稱</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="workspace-name">名稱</Label>
          <Input
            id="workspace-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="輸入 Workspace 名稱"
          />
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving || name === originalName || !name.trim()}
        >
          {isSaving ? "儲存中..." : "儲存變更"}
        </Button>
      </CardContent>
    </Card>
  );
}
