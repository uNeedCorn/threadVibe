"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Activity,
  Loader2,
  AlertCircle,
  ExternalLink,
  Users,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";

interface HealthCheckEntry {
  id: string;
  user_id: string;
  threads_id: string | null;
  followers: number;
  post_count: number;
  total_views: number;
  cumulative_vfr: number;
  cumulative_status: string;
  max_vfr: number;
  max_status: string;
  latest_vfr: number;
  latest_status: string;
  in_cooldown: boolean;
  source: string | null;
  created_at: string;
  // Join from profiles
  profiles: {
    email: string | null;
    display_name: string | null;
  } | null;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  normal: { label: "正常", color: "bg-green-100 text-green-800" },
  warning: { label: "警戒", color: "bg-yellow-100 text-yellow-800" },
  danger: { label: "爆發", color: "bg-red-100 text-red-800" },
};

export default function HealthCheckLeadsPage() {
  const { isAdmin, isLoading: isUserLoading } = useCurrentUser();
  const [entries, setEntries] = useState<HealthCheckEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("health_check_submissions")
        .select("*, profiles(email, display_name)")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setEntries(data || []);
    } catch (err) {
      console.error("Failed to fetch health check leads:", err);
      setError("載入活動名單失敗");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchEntries();
    }
  }, [isAdmin, fetchEntries]);

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription>您沒有權限訪問此頁面</AlertDescription>
      </Alert>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatNumber = (num: number) => {
    return num.toLocaleString("zh-TW");
  };

  // 統計
  const totalEntries = entries.length;
  const uniqueUsers = new Set(entries.map((e) => e.user_id)).size;
  const withThreadsId = entries.filter((e) => e.threads_id).length;
  const dangerCount = entries.filter((e) => e.max_status === "danger").length;

  const StatusBadge = ({ status }: { status: string }) => {
    const config = STATUS_LABELS[status] || STATUS_LABELS.normal;
    return (
      <Badge variant="outline" className={config.color}>
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">活動名單</h1>
        <p className="text-muted-foreground">
          健康檢測工具收集的潛在用戶名單
        </p>
      </div>

      {/* 統計 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>總檢測次數</CardDescription>
            <CardTitle className="text-3xl">{totalEntries}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>獨立用戶數</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <Users className="size-6 text-muted-foreground" />
              {uniqueUsers}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>有填 Threads ID</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <TrendingUp className="size-6 text-green-600" />
              {withThreadsId}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>爆發帳號數</CardDescription>
            <CardTitle className="text-3xl flex items-center gap-2">
              <AlertTriangle className="size-6 text-red-600" />
              {dangerCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* 錯誤訊息 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 名單 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="size-5" />
            檢測記錄
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              尚無檢測記錄
            </div>
          ) : (
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Threads ID</TableHead>
                    <TableHead className="text-right">粉絲數</TableHead>
                    <TableHead className="text-right">貼文數</TableHead>
                    <TableHead className="text-right">總曝光</TableHead>
                    <TableHead className="text-right">最高倍數</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>冷卻期</TableHead>
                    <TableHead>來源</TableHead>
                    <TableHead>檢測時間</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div className="max-w-[180px]">
                          <p className="text-sm truncate" title={entry.profiles?.email || ""}>
                            {entry.profiles?.email || "-"}
                          </p>
                          {entry.profiles?.display_name && (
                            <p className="text-xs text-muted-foreground truncate">
                              {entry.profiles.display_name}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.threads_id ? (
                          <a
                            href={`https://www.threads.net/@${entry.threads_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            @{entry.threads_id}
                            <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">未提供</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(entry.followers)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {entry.post_count}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {formatNumber(entry.total_views)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {entry.max_vfr}x
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={entry.max_status} />
                      </TableCell>
                      <TableCell>
                        {entry.in_cooldown ? (
                          <Badge variant="outline" className="bg-blue-100 text-blue-800">
                            是
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {entry.source || "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(entry.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
