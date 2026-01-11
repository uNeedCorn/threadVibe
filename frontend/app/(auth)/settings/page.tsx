import { Suspense } from "react";
import {
  ThreadsAccountsSection,
  WorkspaceSettingsSection,
  MembersSection,
  DangerZoneSection,
} from "@/components/settings";
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

export default function SettingsPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold">設定</h1>
        <p className="text-muted-foreground">
          {featureFlags.workspaceTeamMode
            ? "管理你的工作區設定"
            : "管理你的帳號設定"}
        </p>
      </div>

      {/* Threads 帳號管理 */}
      <Suspense fallback={<ThreadsAccountsSkeleton />}>
        <ThreadsAccountsSection />
      </Suspense>

      {/* Workspace 設定 - 僅團隊模式顯示 */}
      {featureFlags.workspaceTeamMode && <WorkspaceSettingsSection />}

      {/* 成員管理 - 僅團隊模式顯示 */}
      {featureFlags.workspaceTeamMode && <MembersSection />}

      {/* 危險區域 - 僅團隊模式顯示 */}
      {featureFlags.workspaceTeamMode && <DangerZoneSection />}
    </div>
  );
}
