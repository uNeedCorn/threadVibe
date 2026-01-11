"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, FileText, BarChart3, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { featureFlags } from "@/lib/feature-flags";
import { useCurrentUser } from "@/hooks/use-current-user";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { ThreadsAccountSwitcher } from "./threads-account-switcher";

const navItems = [
  {
    title: "總覽",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "貼文",
    href: "/posts",
    icon: FileText,
  },
  {
    title: "數據分析",
    href: "/insights",
    icon: BarChart3,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin } = useCurrentUser();

  // 顯示 Workspace 切換器的條件：團隊模式 或 管理員
  const showWorkspaceSwitcher = featureFlags.workspaceTeamMode || isAdmin;

  return (
    <aside className="flex h-screen w-64 flex-col border-r bg-card">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="size-4"
          >
            <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
            <path d="M8.5 8.5v.01" />
            <path d="M16 15.5v.01" />
            <path d="M12 12v.01" />
            <path d="M11 17v.01" />
            <path d="M7 14v.01" />
          </svg>
        </div>
        <span className="text-lg font-semibold">ThreadsVibe</span>
      </div>

      {/* Workspace Switcher - 團隊模式或管理員可見 */}
      {showWorkspaceSwitcher && <WorkspaceSwitcher isAdmin={isAdmin} />}

      {/* Threads Account Switcher */}
      <ThreadsAccountSwitcher />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="size-5" />
              {item.title}
            </Link>
          );
        })}
      </nav>

      {/* Settings at bottom */}
      <div className="border-t p-4">
        <Link
          href="/settings"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname.startsWith("/settings")
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          )}
        >
          <Settings className="size-5" />
          設定
        </Link>
      </div>
    </aside>
  );
}
