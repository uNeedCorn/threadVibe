import { Suspense } from "react";
import {
  ThreadsAccountsSection,
  WorkspaceSettingsSection,
  MembersSection,
  DangerZoneSection,
} from "@/components/settings";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

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
        <p className="text-muted-foreground">管理你的 Workspace 設定</p>
      </div>

      {/* Threads 帳號管理 */}
      <Suspense fallback={<ThreadsAccountsSkeleton />}>
        <ThreadsAccountsSection />
      </Suspense>

      {/* Workspace 設定 */}
      <WorkspaceSettingsSection />

      {/* 成員管理 */}
      <MembersSection />

      {/* 危險區域 */}
      <DangerZoneSection />
    </div>
  );
}
