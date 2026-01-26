"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Users,
  Loader2,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  CheckCircle2,
  XCircle,
  AtSign,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { AdminOnly } from "@/components/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface UserOverview {
  user_id: string;
  email: string;
  registered_at: string;
  last_sign_in_at: string | null;
  last_active_at: string | null;
  days_since_login: number | null;
  days_since_active: number | null;
  workspace_id: string | null;
  workspace_name: string | null;
  workspace_role: string | null;
  threads_account_id: string | null;
  threads_username: string | null;
  threads_name: string | null;
  followers_count: number | null;
  threads_connected: boolean | null;
  last_sync_at: string | null;
}

type SortField =
  | "email"
  | "registered_at"
  | "last_sign_in_at"
  | "days_since_login"
  | "days_since_active"
  | "workspace_name"
  | "threads_username"
  | "followers_count";
type SortDirection = "asc" | "desc";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatNumber(num: number | null): string {
  if (num === null) return "-";
  return new Intl.NumberFormat("zh-TW").format(num);
}

export default function AdminUsersPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<UserOverview[]>([]);
  const [showOnlyConnected, setShowOnlyConnected] = useState(true);
  const [sortField, setSortField] = useState<SortField>("days_since_active");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const supabase = createClient();

    try {
      const { data: result, error } = await supabase.rpc(
        "get_admin_user_overview"
      );

      if (error) {
        console.error("Failed to fetch user overview:", error);
        return;
      }

      setData(result || []);
    } catch (error) {
      console.error("Failed to fetch user overview:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // 篩選與排序邏輯
  const filteredAndSortedData = useMemo(() => {
    let result = [...data];

    // 篩選：只顯示有連結 Threads 帳號的使用者
    if (showOnlyConnected) {
      result = result.filter((item) => item.threads_connected === true);
    }

    // 排序
    result.sort((a, b) => {
      let aVal: string | number | null = null;
      let bVal: string | number | null = null;

      switch (sortField) {
        case "email":
          aVal = a.email?.toLowerCase() || "";
          bVal = b.email?.toLowerCase() || "";
          break;
        case "registered_at":
          aVal = a.registered_at || "";
          bVal = b.registered_at || "";
          break;
        case "last_sign_in_at":
          aVal = a.last_sign_in_at || "";
          bVal = b.last_sign_in_at || "";
          break;
        case "days_since_login":
          aVal = a.days_since_login ?? 9999;
          bVal = b.days_since_login ?? 9999;
          break;
        case "days_since_active":
          aVal = a.days_since_active ?? 9999;
          bVal = b.days_since_active ?? 9999;
          break;
        case "workspace_name":
          aVal = a.workspace_name?.toLowerCase() || "";
          bVal = b.workspace_name?.toLowerCase() || "";
          break;
        case "threads_username":
          aVal = a.threads_username?.toLowerCase() || "";
          bVal = b.threads_username?.toLowerCase() || "";
          break;
        case "followers_count":
          aVal = a.followers_count ?? 0;
          bVal = b.followers_count ?? 0;
          break;
      }

      if (aVal === null && bVal === null) return 0;
      if (aVal === null) return 1;
      if (bVal === null) return -1;

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [data, showOnlyConnected, sortField, sortDirection]);

  // 計算統計
  const stats = useMemo(() => {
    const uniqueUsers = new Set(data.map((d) => d.user_id));
    const usersWithWorkspace = new Set(
      data.filter((d) => d.workspace_id).map((d) => d.user_id)
    );
    const usersWithThreads = new Set(
      data.filter((d) => d.threads_connected).map((d) => d.user_id)
    );
    const totalFollowers = data
      .filter((d) => d.threads_connected)
      .reduce((sum, d) => sum + (d.followers_count || 0), 0);

    return {
      totalUsers: uniqueUsers.size,
      usersWithWorkspace: usersWithWorkspace.size,
      usersWithThreads: usersWithThreads.size,
      totalFollowers,
    };
  }, [data]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 size-3 text-muted-foreground/50" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="ml-1 size-3" />
    ) : (
      <ArrowDown className="ml-1 size-3" />
    );
  };

  return (
    <AdminOnly>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">使用者管理</h1>
            <p className="text-muted-foreground">
              追蹤使用者、工作區與 Threads 帳號狀態
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
          >
            <RefreshCw
              className={`mr-2 size-4 ${isLoading ? "animate-spin" : ""}`}
            />
            重新整理
          </Button>
        </div>

        {/* 統計卡片 */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">總使用者</CardTitle>
              <Users className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">有工作區</CardTitle>
              <CheckCircle2 className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.usersWithWorkspace}
              </div>
              <p className="text-xs text-muted-foreground">
                {((stats.usersWithWorkspace / stats.totalUsers) * 100).toFixed(
                  0
                )}
                % 轉換率
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                有綁定 Threads
              </CardTitle>
              <AtSign className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.usersWithThreads}</div>
              <p className="text-xs text-muted-foreground">
                {((stats.usersWithThreads / stats.totalUsers) * 100).toFixed(0)}
                % 轉換率
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">總粉絲數</CardTitle>
              <Users className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatNumber(stats.totalFollowers)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 篩選器 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="size-4" />
              篩選條件
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Switch
                id="show-connected"
                checked={showOnlyConnected}
                onCheckedChange={setShowOnlyConnected}
              />
              <Label htmlFor="show-connected">
                只顯示有連結 Threads 帳號的使用者
              </Label>
            </div>
          </CardContent>
        </Card>

        {/* 使用者列表 */}
        <Card>
          <CardHeader>
            <CardTitle>使用者列表</CardTitle>
            <CardDescription>
              共 {filteredAndSortedData.length} 筆資料（點擊欄位標題可排序）
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex h-64 items-center justify-center">
                <Loader2 className="size-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 font-medium"
                        onClick={() => handleSort("email")}
                      >
                        Email
                        <SortIcon field="email" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 font-medium"
                        onClick={() => handleSort("days_since_active")}
                      >
                        最後活躍
                        <SortIcon field="days_since_active" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 font-medium"
                        onClick={() => handleSort("workspace_name")}
                      >
                        工作區
                        <SortIcon field="workspace_name" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 font-medium"
                        onClick={() => handleSort("threads_username")}
                      >
                        Threads 帳號
                        <SortIcon field="threads_username" />
                      </Button>
                    </TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 font-medium"
                        onClick={() => handleSort("followers_count")}
                      >
                        粉絲數
                        <SortIcon field="followers_count" />
                      </Button>
                    </TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-3 h-8 font-medium"
                        onClick={() => handleSort("last_sign_in_at")}
                      >
                        最後登入
                        <SortIcon field="last_sign_in_at" />
                      </Button>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAndSortedData.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="text-center text-muted-foreground"
                      >
                        無符合條件的資料
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAndSortedData.map((item, index) => (
                      <TableRow key={`${item.user_id}-${item.threads_account_id || index}`}>
                        <TableCell className="font-medium">
                          {item.email}
                        </TableCell>
                        <TableCell>
                          {item.last_active_at ? (
                            <div className="space-y-1">
                              <Badge
                                variant={
                                  (item.days_since_active ?? 999) <= 1
                                    ? "default"
                                    : (item.days_since_active ?? 999) <= 7
                                      ? "secondary"
                                      : "outline"
                                }
                              >
                                {item.days_since_active} 天前
                              </Badge>
                              <p className="text-xs text-muted-foreground">
                                {formatDate(item.last_active_at)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{item.workspace_name || "-"}</TableCell>
                        <TableCell>
                          {item.threads_username ? (
                            <span className="text-blue-600">
                              @{item.threads_username}
                            </span>
                          ) : (
                            "-"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatNumber(item.followers_count)}
                        </TableCell>
                        <TableCell>
                          {item.threads_connected ? (
                            <Badge
                              variant="outline"
                              className="gap-1 border-green-300 bg-green-50 text-green-700"
                            >
                              <CheckCircle2 className="size-3" />
                              同步中
                            </Badge>
                          ) : item.workspace_id ? (
                            <Badge
                              variant="outline"
                              className="gap-1 border-orange-300 bg-orange-50 text-orange-700"
                            >
                              <XCircle className="size-3" />
                              未綁定
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1">
                              <XCircle className="size-3" />
                              無工作區
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDate(item.last_sign_in_at)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminOnly>
  );
}
