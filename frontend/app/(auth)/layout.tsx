import { Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { WorkspaceInitializer } from "@/components/workspace-initializer";
import { SelectedAccountProviderWrapper } from "@/components/providers/selected-account-provider";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SelectedAccountProviderWrapper>
      <div className="flex h-screen">
        {/* 從 URL 讀取並儲存 workspace_id */}
        <Suspense fallback={null}>
          <WorkspaceInitializer />
        </Suspense>

        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto bg-background p-6">
            {children}
          </main>
        </div>
      </div>
    </SelectedAccountProviderWrapper>
  );
}
