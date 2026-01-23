"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Settings,
  Tags,
  ChevronRight,
  Users,
  Eye,
  MessageSquare,
  Radar,
  Activity,
  TreeDeciduous,
  FileSpreadsheet,
  FlaskConical,
  Shield,
  Coins,
  KeyRound,
  ClipboardList,
  LogOut,
  User,
  CalendarClock,
  SquarePen,
  UserCog,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/use-current-user";
import { ThreadsAccountSwitcher } from "./threads-account-switcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { createClient } from "@/lib/supabase/client";

interface UserProfile {
  email: string;
  name: string;
  avatarUrl: string;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  adminOnly?: boolean;
  badge?: string; // 額外標記（如：開發中）
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

// 主要導航項目
const mainNavItems: NavEntry[] = [
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
        title: "中期追蹤",
        href: "/insights/midterm",
        icon: Activity,
      },
      {
        title: "長尾分析",
        href: "/insights/longtail",
        icon: TreeDeciduous,
      },
      {
        title: "曝光分析",
        href: "/insights/reach",
        icon: Eye,
      },
      {
        title: "互動分析",
        href: "/insights/engagement",
        icon: MessageSquare,
      },
      {
        title: "粉絲趨勢",
        href: "/insights/followers",
        icon: Users,
      },
    ],
  },
  {
    title: "發文",
    href: "/compose",
    icon: SquarePen,
  },
  {
    title: "貼文列表",
    href: "/posts",
    icon: FileText,
  },
  {
    title: "排程管理",
    href: "/scheduled",
    icon: CalendarClock,
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
];

// 管理員導航項目（固定在底部）
const adminNavGroup: NavGroup = {
  title: "管理員",
  icon: Shield,
  basePath: "/admin",
  adminOnly: true,
  children: [
    {
      title: "帳號模擬",
      href: "/admin",
      icon: UserCog,
    },
    {
      title: "帳號觀測",
      href: "/admin/watchlist",
      icon: Eye,
      badge: "開發中",
    },
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
    {
      title: "邀請碼管理",
      href: "/admin/invitations",
      icon: KeyRound,
    },
    {
      title: "等待名單",
      href: "/admin/waitlist",
      icon: ClipboardList,
    },
  ],
};

const SIDEBAR_COLLAPSED_KEY = "sidebarCollapsed";
const SIDEBAR_OPEN_GROUPS_KEY = "sidebarOpenGroups";

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { isAdmin } = useCurrentUser();

  // 客戶端掛載狀態（防止 hydration mismatch）
  const [mounted, setMounted] = useState(false);

  // Sidebar 收折狀態
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 登入者資訊
  const [user, setUser] = useState<UserProfile | null>(null);

  // 展開狀態：從 localStorage 讀取，預設成效洞察展開
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    "/insights": true, // 預設成效洞察展開
  });

  // 確保客戶端掛載後才渲染動態內容
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchUser() {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();

      if (authUser) {
        setUser({
          email: authUser.email || "",
          name: authUser.user_metadata?.full_name || authUser.email || "",
          avatarUrl: authUser.user_metadata?.avatar_url || "",
        });
      }
    }

    fetchUser();
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login_2026Q1");
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // 從 localStorage 讀取收折狀態和群組展開狀態
  useEffect(() => {
    // 讀取 sidebar 收折狀態
    const savedCollapsed = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (savedCollapsed === "true") {
      setIsCollapsed(true);
    }

    // 讀取群組展開狀態
    const savedGroups = localStorage.getItem(SIDEBAR_OPEN_GROUPS_KEY);
    if (savedGroups) {
      try {
        const parsed = JSON.parse(savedGroups);
        setOpenGroups(parsed);
      } catch {
        // 解析失敗時使用預設值
      }
    }

    // 監聽 storage 事件（與 Header 同步）
    const handleStorage = () => {
      const current = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      setIsCollapsed(current === "true");
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // 根據當前路徑自動展開對應的群組（僅在首次進入該路徑時）
  useEffect(() => {
    let shouldUpdate = false;
    const updates: Record<string, boolean> = {};

    // 檢查主要導航項目
    mainNavItems.forEach((item) => {
      if (isNavGroup(item) && pathname.startsWith(item.basePath)) {
        // 如果該群組尚未在 openGroups 中明確設定過，則自動展開
        if (openGroups[item.basePath] === undefined) {
          updates[item.basePath] = true;
          shouldUpdate = true;
        }
      }
    });

    // 檢查管理員群組
    if (pathname.startsWith(adminNavGroup.basePath)) {
      if (openGroups[adminNavGroup.basePath] === undefined) {
        updates[adminNavGroup.basePath] = true;
        shouldUpdate = true;
      }
    }

    if (shouldUpdate) {
      setOpenGroups((prev) => {
        const newState = { ...prev, ...updates };
        localStorage.setItem(SIDEBAR_OPEN_GROUPS_KEY, JSON.stringify(newState));
        return newState;
      });
    }
  }, [pathname, openGroups]);

  // 切換群組展開狀態並保存到 localStorage
  const toggleGroup = (basePath: string) => {
    setOpenGroups((prev) => {
      const newState = { ...prev, [basePath]: !prev[basePath] };
      localStorage.setItem(SIDEBAR_OPEN_GROUPS_KEY, JSON.stringify(newState));
      return newState;
    });
  };

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r bg-card transition-all duration-300",
        isCollapsed ? "w-[var(--sidebar-width-collapsed)]" : "w-[var(--sidebar-width)]"
      )}
    >
      {/* Logo - 高度與 Header 一致 */}
      <div
        className={cn(
          "flex h-[var(--header-height)] items-center border-b",
          isCollapsed ? "justify-center px-2" : "px-4"
        )}
      >
        {isCollapsed ? (
          <Image
            src="/logo-icon.png"
            alt="Postlyzer"
            width={28}
            height={28}
            className="size-7"
          />
        ) : (
          <Image
            src="/logo-full.png"
            alt="Postlyzer"
            width={189}
            height={43}
            className="h-11 w-auto"
          />
        )}
      </div>

      {/* Threads Account Switcher - 固定顯示，收折時隱藏 */}
      {!isCollapsed && <ThreadsAccountSwitcher />}

      {/* Navigation */}
      <nav className={cn("flex-1 space-y-0.5 overflow-y-auto", isCollapsed ? "p-2" : "px-3 py-2")}>
        {mainNavItems
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => {
          if (isNavGroup(item)) {
            // 樹狀選單群組
            const isGroupActive = pathname.startsWith(item.basePath);
            const isOpen = openGroups[item.basePath] ?? isGroupActive;

            // 收折模式：顯示群組圖示，點擊直接導向第一個子項
            if (isCollapsed) {
              const firstChild = item.children.find((child) => !child.adminOnly || isAdmin);
              if (!firstChild) return null;

              return (
                <Tooltip key={item.basePath}>
                  <TooltipTrigger asChild>
                    <Link
                      href={firstChild.href}
                      className={cn(
                        "flex items-center justify-center rounded-lg p-2 transition-colors",
                        isGroupActive
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                      )}
                    >
                      <item.icon className="size-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.title}</TooltipContent>
                </Tooltip>
              );
            }

            // 在客戶端掛載前，顯示靜態版本避免 hydration mismatch
            if (!mounted) {
              return (
                <div key={item.basePath}>
                  <div
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                      isGroupActive
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    <item.icon className="size-5" />
                    <span className="flex-1 text-left">{item.title}</span>
                    <ChevronRight className="size-4" />
                  </div>
                </div>
              );
            }

            return (
              <Collapsible
                key={item.basePath}
                open={isOpen}
                onOpenChange={() => toggleGroup(item.basePath)}
              >
                <CollapsibleTrigger
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
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
                <CollapsibleContent className="mt-0.5 space-y-0.5 pl-3">
                  {item.children
                    .filter((child) => !child.adminOnly || isAdmin)
                    .map((child) => {
                    const isChildActive = pathname === child.href;
                    const isAdminOnly = child.adminOnly;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                          isChildActive
                            ? isAdminOnly
                              ? "bg-orange-500 text-white"
                              : "bg-primary text-primary-foreground"
                            : isAdminOnly
                              ? "text-orange-500 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-950"
                              : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                        )}
                      >
                        <child.icon className={cn("size-4", isAdminOnly && !isChildActive && "text-orange-500")} />
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
          const isAdminItem = item.adminOnly;

          // 收折模式：只顯示圖示
          if (isCollapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center justify-center rounded-lg p-2 transition-colors",
                      isActive
                        ? isAdminItem
                          ? "bg-orange-500 text-white"
                          : "bg-primary text-primary-foreground"
                        : isAdminItem
                          ? "text-orange-500 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-950"
                          : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                    )}
                  >
                    <item.icon className="size-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {item.title}
                  {item.badge && <span className="ml-1 text-orange-400">({item.badge})</span>}
                </TooltipContent>
              </Tooltip>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                isActive
                  ? isAdminItem
                    ? "bg-orange-500 text-white"
                    : "bg-primary text-primary-foreground"
                  : isAdminItem
                    ? "text-orange-500 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-950"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="size-5" />
              {item.title}
              {item.badge && (
                <span className={cn(
                  "ml-auto text-[10px] px-1.5 py-0.5 rounded",
                  isActive
                    ? "bg-white/20 text-white"
                    : "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400"
                )}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Admin Navigation - 固定在底部 */}
      {isAdmin && (
        <div className={cn("border-t", isCollapsed ? "p-2" : "px-3 py-2")}>
          {(() => {
            const isGroupActive = pathname.startsWith(adminNavGroup.basePath);
            const isOpen = openGroups[adminNavGroup.basePath] ?? isGroupActive;

            // 收折模式
            if (isCollapsed) {
              const firstChild = adminNavGroup.children[0];
              return (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      href={firstChild.href}
                      className={cn(
                        "flex items-center justify-center rounded-lg p-2 transition-colors",
                        isGroupActive
                          ? "bg-teal-500 text-white"
                          : "text-teal-500 hover:bg-teal-50 hover:text-teal-600 dark:hover:bg-teal-950"
                      )}
                    >
                      <adminNavGroup.icon className="size-5" />
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{adminNavGroup.title}</TooltipContent>
                </Tooltip>
              );
            }

            // 展開模式 - 在客戶端掛載前顯示靜態版本
            if (!mounted) {
              return (
                <div
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                    isGroupActive
                      ? "text-teal-600"
                      : "text-teal-500"
                  )}
                >
                  <adminNavGroup.icon className="size-5" />
                  <span className="flex-1 text-left">{adminNavGroup.title}</span>
                  <ChevronRight className="size-4" />
                </div>
              );
            }

            return (
              <Collapsible
                open={isOpen}
                onOpenChange={() => toggleGroup(adminNavGroup.basePath)}
              >
                <CollapsibleTrigger
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                    isGroupActive
                      ? "text-teal-600"
                      : "text-teal-500 hover:bg-teal-50 hover:text-teal-600 dark:hover:bg-teal-950"
                  )}
                >
                  <adminNavGroup.icon className="size-5" />
                  <span className="flex-1 text-left">{adminNavGroup.title}</span>
                  <ChevronRight
                    className={cn(
                      "size-4 transition-transform duration-200",
                      isOpen && "rotate-90"
                    )}
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-0.5 space-y-0.5 pl-3">
                  {adminNavGroup.children.map((child) => {
                    const isChildActive = pathname === child.href;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                          isChildActive
                            ? "bg-teal-500 text-white"
                            : "text-teal-500 hover:bg-teal-50 hover:text-teal-600 dark:hover:bg-teal-950"
                        )}
                      >
                        <child.icon className="size-4" />
                        {child.title}
                        {child.badge && (
                          <span className={cn(
                            "ml-auto text-[10px] px-1.5 py-0.5 rounded",
                            isChildActive
                              ? "bg-white/20 text-white"
                              : "bg-teal-100 text-teal-600 dark:bg-teal-900/30 dark:text-teal-400"
                          )}>
                            {child.badge}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </CollapsibleContent>
              </Collapsible>
            );
          })()}
        </div>
      )}

      {/* Bottom: User + Settings */}
      <div className={cn("border-t flex items-center justify-between", isCollapsed ? "p-2" : "px-3 py-2")}>
        {/* User Menu - 左側 */}
        {!mounted ? (
          // 客戶端掛載前顯示靜態 Avatar
          <Avatar className={cn("cursor-pointer", isCollapsed ? "size-7" : "size-8")}>
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              U
            </AvatarFallback>
          </Avatar>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger className="outline-none">
              <Avatar className={cn("cursor-pointer", isCollapsed ? "size-7" : "size-8")}>
                <AvatarImage src={user?.avatarUrl} alt={user?.name} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {user ? getInitials(user.name) : "U"}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{user?.name}</p>
                <p className="text-xs text-muted-foreground">{user?.email}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer" disabled>
                <User className="mr-2 size-4" />
                個人資料
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 size-4" />
                登出
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Settings - 右側 */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/settings"
              className={cn(
                "flex items-center justify-center rounded-lg p-2 transition-colors",
                pathname.startsWith("/settings")
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Settings className="size-5" />
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">設定</TooltipContent>
        </Tooltip>
      </div>

    </aside>
  );
}
