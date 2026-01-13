"use client";

import { Suspense } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useUIStore } from "@/stores/ui-store";
import { ThreadsAccountsSection } from "./threads-accounts-section";
import { WorkspaceSettingsSection } from "./workspace-settings-section";
import { MembersSection } from "./members-section";
import { DangerZoneSection } from "./danger-zone-section";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { featureFlags } from "@/lib/feature-flags";

function ThreadsAccountsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Threads 帳號</CardTitle>
        <CardDescription>管理連結的 Threads 帳號</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-20 animate-pulse rounded-lg bg-muted" />
      </CardContent>
    </Card>
  );
}

export function SettingsModal() {
  const { isSettingsOpen, closeSettings } = useUIStore();

  return (
    <Dialog open={isSettingsOpen} onOpenChange={(open) => !open && closeSettings()}>
      <DialogContent className="max-w-2xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>設定</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(85vh-80px)] px-6 pb-6">
          <div className="space-y-6">
            {/* Threads 帳號管理 */}
            <Suspense fallback={<ThreadsAccountsSkeleton />}>
              <ThreadsAccountsSection />
            </Suspense>

            {/* Workspace 設定 - 僅團隊模式顯示 */}
            {featureFlags.workspaceTeamMode && <WorkspaceSettingsSection />}

            {/* 成員管理 - 僅團隊模式顯示 */}
            {featureFlags.workspaceTeamMode && <MembersSection />}

            {/* 危險區域 - 始終顯示 */}
            <DangerZoneSection />
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
