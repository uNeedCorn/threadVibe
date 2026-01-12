"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Settings,
  Tags,
  ChevronRight,
  TrendingUp,
  Users,
  Eye,
  MessageSquare,
  Radar,
  FileSpreadsheet,
  FlaskConical,
  Shield,
  Coins,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { featureFlags } from "@/lib/feature-flags";
import { useCurrentUser } from "@/hooks/use-current-user";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { ThreadsAccountSwitcher } from "./threads-account-switcher";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
}

interface NavGroup {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  basePath: string;
  children: NavItem[];
  adminOnly?: boolean;
}

type NavEntry = NavItem | NavGroup;

const isNavGroup = (item: NavEntry): item is NavGroup => {
  return "children" in item;
};

const navItems: NavEntry[] = [
  {
    title: "成效洞察",
    icon: BarChart3,
    basePath: "/insights",
    children: [
      {
        title: "總覽",
        href: "/insights",
        icon: LayoutDashboard,
      },
      {
        title: "發文追蹤雷達",
        href: "/insights/radar",
        icon: Radar,
      },
      {
        title: "曝光分析",
        href: "/insights/reach",
        icon: Eye,
        adminOnly: true,
      },
      {
        title: "互動分析",
        href: "/insights/engagement",
        icon: MessageSquare,
        adminOnly: true,
      },
      {
        title: "粉絲趨勢",
        href: "/insights/followers",
        icon: Users,
        adminOnly: true,
      },
    ],
  },
  {
    title: "貼文",
    href: "/posts",
    icon: FileText,
  },
  {
    title: "標籤",
    href: "/tags",
    icon: Tags,
  },
  {
    title: "報表",
    href: "/reports",
    icon: FileSpreadsheet,
  },
  {
    title: "管理員",
    icon: Shield,
    basePath: "/admin",
    adminOnly: true,
    children: [
      {
        title: "API 測試",
        href: "/admin/api-test",
        icon: FlaskConical,
      },
      {
        title: "LLM 費用",
        href: "/admin/llm-usage",
        icon: Coins,
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { isAdmin } = useCurrentUser();

  // 展開狀態：當路徑匹配時自動展開
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  // 根據當前路徑自動展開對應的群組
  useEffect(() => {
    navItems.forEach((item) => {
      if (isNavGroup(item) && pathname.startsWith(item.basePath)) {
        setOpenGroups((prev) => ({ ...prev, [item.basePath]: true }));
      }
    });
  }, [pathname]);

  const toggleGroup = (basePath: string) => {
    setOpenGroups((prev) => ({ ...prev, [basePath]: !prev[basePath] }));
  };

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
        <span className="text-lg font-semibold">Postlyzer</span>
      </div>

      {/* Workspace Switcher - 團隊模式或管理員可見 */}
      {showWorkspaceSwitcher && <WorkspaceSwitcher isAdmin={isAdmin} />}

      {/* Threads Account Switcher */}
      <ThreadsAccountSwitcher />

      {/* Navigation */}
      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        {navItems
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => {
          if (isNavGroup(item)) {
            // 樹狀選單群組
            const isGroupActive = pathname.startsWith(item.basePath);
            const isOpen = openGroups[item.basePath] ?? isGroupActive;

            return (
              <Collapsible
                key={item.basePath}
                open={isOpen}
                onOpenChange={() => toggleGroup(item.basePath)}
              >
                <CollapsibleTrigger
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isGroupActive
                      ? "text-primary"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="size-5" />
                  <span className="flex-1 text-left">{item.title}</span>
                  <ChevronRight
                    className={cn(
                      "size-4 transition-transform duration-200",
                      isOpen && "rotate-90"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1 space-y-1 pl-4">
                  {item.children
                    .filter((child) => !child.adminOnly || isAdmin)
                    .map((child) => {
                    const isChildActive = pathname === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          isChildActive
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <child.icon className="size-4" />
                        {child.title}
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          }

          // 一般導航項目
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
