"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Check,
  Sparkles,
  RefreshCw,
  Eye,
  Clock,
  Heart,
  HeartCrack,
  Flame,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useSelectedAccount } from "@/hooks/use-selected-account";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  type MidtermStatus,
  type EngagementStatus,
  type HourlyMetric,
  type MidtermAnomaly,
  type EngagementMetrics,
  calculateMidtermMetrics,
  calculateEngagementMetrics,
  detectMidtermAnomaly,
  MIDTERM_STATUS_CONFIG,
  ENGAGEMENT_STATUS_CONFIG,
  getHoursSincePublish,
  formatAgeText,
  toLifecycleChartData,
} from "@/lib/midterm-utils";
import { TEAL, STONE } from "@/lib/design-tokens";

// ============================================================================
// Types
// ============================================================================

interface MidtermPost {
  id: string;
  text: string;
  mediaType: string | null;
  publishedAt: string;
  currentViews: number;
  currentLikes: number;
  currentReplies: number;
  currentReposts: number;
  currentQuotes: number;
  ageHours: number;
  status: MidtermStatus;
  recent6hDelta: number;
  avgHourlyDelta: number;
  recent24hDelta: number | null;
  hourlyMetrics: HourlyMetric[];
  anomaly: MidtermAnomaly | null;
  engagement: EngagementMetrics | null;
}

interface SummaryStats {
  total: number;
  growing: number;
  slowing: number;
  stabilized: number;
  // 互動狀態統計
  engagementActive: number;
  engagementHealthy: number;
  engagementWeakening: number;
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatNumber(v: number): string {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toLocaleString();
}

// ============================================================================
// Components
// ============================================================================

function MidtermStatusBadge({ status }: { status: MidtermStatus }) {
  const config = MIDTERM_STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 text-xs",
        config.bgColor,
        config.color,
        config.borderColor
      )}
    >
      <Icon className="size-3" />
      {config.label}
    </Badge>
  );
}

function EngagementStatusBadge({ status }: { status: EngagementStatus }) {
  const config = ENGAGEMENT_STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 text-xs",
        config.bgColor,
        config.color,
        config.borderColor
      )}
    >
      <Icon className="size-3" />
      {config.label}
    </Badge>
  );
}

function SummaryCard({
  title,
  value,
  icon,
  variant = "default",
  isLoading,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  variant?: "default" | "success" | "warning" | "muted" | "orange" | "rose";
  isLoading: boolean;
}) {
  const variantStyles = {
    default: "bg-card",
    success: "bg-green-500/5 border-green-200",
    warning: "bg-amber-500/5 border-amber-200",
    muted: "bg-stone-500/5 border-stone-200",
    orange: "bg-orange-500/5 border-orange-200",
    rose: "bg-rose-500/5 border-rose-200",
  };

  if (isLoading) {
    return (
      <Card className={variantStyles[variant]}>
        <CardContent className="flex items-center gap-4 p-4">
          <Skeleton className="size-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-8 w-12" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={variantStyles[variant]}>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function AnomalyAlert({
  anomalies,
  onDismiss,
}: {
  anomalies: MidtermAnomaly[];
  onDismiss: (postId: string) => void;
}) {
  if (anomalies.length === 0) return null;

  return (
    <div className="space-y-2">
      {anomalies.map((anomaly) => (
        <Alert
          key={anomaly.postId}
          className="border-violet-200 bg-violet-500/10"
        >
          <Sparkles className="size-4 text-violet-600" />
          <AlertTitle className="text-violet-600">舊文復活！</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>
              近 6 小時曝光增量是平均值的{" "}
              <span className="font-bold">{anomaly.ratio.toFixed(1)} 倍</span>
              （+{formatNumber(anomaly.recentDelta)} vs 預期 +
              {formatNumber(anomaly.expectedDelta)}）
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDismiss(anomaly.postId)}
            >
              關閉
            </Button>
          </AlertDescription>
        </Alert>
      ))}
    </div>
  );
}

function LifecycleChart({
  post,
  isLoading,
}: {
  post: MidtermPost | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5" />
            生命週期曲線
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!post) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5" />
            生命週期曲線
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-64 items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Activity className="mx-auto mb-2 size-12 opacity-20" />
            <p>點擊貼文查看生命週期曲線</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const chartData = toLifecycleChartData(
    post.hourlyMetrics,
    post.publishedAt
  );

  if (chartData.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5" />
            生命週期曲線
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-64 items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Clock className="mx-auto mb-2 size-12 opacity-20" />
            <p>資料累積中</p>
            <p className="text-sm">需要更多小時級數據才能顯示曲線</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-5" />
          生命週期曲線
          <MidtermStatusBadge status={post.status} />
        </CardTitle>
        <p className="text-sm text-muted-foreground line-clamp-1">
          {post.text || "(無文字)"}
        </p>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={TEAL[500]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={TEAL[500]} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatNumber(value)}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const data = payload[0].payload;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-lg">
                      <p className="mb-1 font-medium">發布後 {label}</p>
                      <p className="text-sm">
                        累計曝光：
                        <span className="font-mono font-medium">
                          {formatNumber(data.views)}
                        </span>
                      </p>
                    </div>
                  );
                }}
              />
              {/* 時間標記線 */}
              <ReferenceLine
                x="24h"
                stroke={STONE[400]}
                strokeDasharray="3 3"
                label={{ value: "1d", position: "top", fontSize: 10 }}
              />
              <ReferenceLine
                x="48h"
                stroke={STONE[400]}
                strokeDasharray="3 3"
                label={{ value: "2d", position: "top", fontSize: 10 }}
              />
              <ReferenceLine
                x="72h"
                stroke={STONE[400]}
                strokeDasharray="3 3"
                label={{ value: "3d", position: "top", fontSize: 10 }}
              />
              <ReferenceLine
                x="168h"
                stroke={STONE[400]}
                strokeDasharray="3 3"
                label={{ value: "7d", position: "top", fontSize: 10 }}
              />
              <Area
                type="monotone"
                dataKey="views"
                stroke={TEAL[500]}
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorViews)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-4 flex justify-center gap-6 text-sm">
          <div className="text-center">
            <p className="text-muted-foreground">近 6h 增量</p>
            <p className="font-mono font-medium">
              +{formatNumber(post.recent6hDelta)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-muted-foreground">平均時增量</p>
            <p className="font-mono font-medium">
              {formatNumber(Math.round(post.avgHourlyDelta))}/h
            </p>
          </div>
          {post.recent24hDelta !== null && (
            <div className="text-center">
              <p className="text-muted-foreground">近 24h 增量</p>
              <p className="font-mono font-medium">
                +{formatNumber(post.recent24hDelta)}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MiniTrendLine({ metrics }: { metrics: HourlyMetric[] }) {
  if (metrics.length < 3) {
    return (
      <div className="flex h-6 w-20 items-center justify-center text-xs text-muted-foreground">
        累積中
      </div>
    );
  }

  // 取最近 12 個點
  const recentMetrics = metrics.slice(-12);
  const maxViews = Math.max(...recentMetrics.map((m) => m.views));
  const minViews = Math.min(...recentMetrics.map((m) => m.views));
  const range = maxViews - minViews || 1;

  // 生成 SVG path
  const points = recentMetrics.map((m, i) => {
    const x = (i / (recentMetrics.length - 1)) * 80;
    const y = 24 - ((m.views - minViews) / range) * 20;
    return `${i === 0 ? "M" : "L"} ${x} ${y}`;
  });

  return (
    <svg width="80" height="24" className="text-primary">
      <path
        d={points.join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PostsTable({
  posts,
  isLoading,
  selectedPostId,
  onSelectPost,
}: {
  posts: MidtermPost[];
  isLoading: boolean;
  selectedPostId: string | null;
  onSelectPost: (post: MidtermPost) => void;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">貼文內容</TableHead>
                <TableHead className="w-20">曝光狀態</TableHead>
                <TableHead className="w-20">互動狀態</TableHead>
                <TableHead className="w-20">發布時間</TableHead>
                <TableHead className="w-16 text-right">曝光</TableHead>
                <TableHead className="w-16 text-right">互動率</TableHead>
                <TableHead className="w-16">趨勢</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  }

  if (posts.length === 0) {
    return (
      <Card>
        <CardContent className="flex h-64 items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Activity className="mx-auto mb-2 size-12 opacity-20" />
            <p>目前沒有中期追蹤中的貼文</p>
            <p className="text-sm">3 小時到 7 天內發布的貼文會顯示在這裡</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">貼文內容</TableHead>
              <TableHead className="w-20">曝光狀態</TableHead>
              <TableHead className="w-20">互動狀態</TableHead>
              <TableHead className="w-20">發布時間</TableHead>
              <TableHead className="w-16 text-right">曝光</TableHead>
              <TableHead className="w-16 text-right">互動率</TableHead>
              <TableHead className="w-16">趨勢</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.map((post) => (
              <TableRow
                key={post.id}
                className={cn(
                  "cursor-pointer transition-colors hover:bg-muted/50",
                  selectedPostId === post.id && "bg-muted",
                  post.anomaly && "bg-violet-500/5"
                )}
                onClick={() => onSelectPost(post)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    {post.anomaly && (
                      <Sparkles className="size-4 text-violet-600 shrink-0" />
                    )}
                    <p className="line-clamp-2 text-sm">
                      {post.text?.slice(0, 40) || "(無文字)"}
                      {(post.text?.length || 0) > 40 && "..."}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <MidtermStatusBadge status={post.status} />
                </TableCell>
                <TableCell>
                  {post.engagement ? (
                    <EngagementStatusBadge status={post.engagement.engagementStatus} />
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatAgeText(post.ageHours)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatNumber(post.currentViews)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {post.engagement ? (
                    <span
                      className={cn(
                        post.engagement.engagementStatus === "active"
                          ? "text-orange-600"
                          : post.engagement.engagementStatus === "weakening"
                            ? "text-stone-500"
                            : "text-rose-500"
                      )}
                    >
                      {post.engagement.engagementRate.toFixed(2)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <MiniTrendLine metrics={post.hourlyMetrics} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function MidtermPage() {
  const { selectedAccountId, isLoading: isAccountLoading } =
    useSelectedAccount();
  const supabase = createClient();

  const [posts, setPosts] = useState<MidtermPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPost, setSelectedPost] = useState<MidtermPost | null>(null);
  const [dismissedAnomalies, setDismissedAnomalies] = useState<Set<string>>(
    new Set()
  );

  // 用 ref 追蹤選中的貼文 ID，避免在 loadData 中造成依賴循環
  const selectedPostIdRef = useRef<string | null>(null);

  // 載入資料
  const loadData = useCallback(async () => {
    if (!selectedAccountId) return;

    setIsLoading(true);

    try {
      // 計算時間範圍：3 小時前到 7 天前
      const now = new Date();
      const hours3Ago = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const days7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // 1. 取得貼文
      const { data: postsData, error: postsError } = await supabase
        .from("workspace_threads_posts")
        .select(
          `
          id,
          text,
          media_type,
          published_at,
          current_views,
          current_likes,
          current_replies,
          current_reposts,
          current_quotes
        `
        )
        .eq("workspace_threads_account_id", selectedAccountId)
        .eq("is_reply", false)
        .neq("media_type", "REPOST_FACADE")
        .lt("published_at", hours3Ago.toISOString())
        .gte("published_at", days7Ago.toISOString())
        .order("published_at", { ascending: false });

      if (postsError) {
        console.error("Failed to fetch posts:", postsError);
        return;
      }

      if (!postsData || postsData.length === 0) {
        setPosts([]);
        setIsLoading(false);
        return;
      }

      const postIds = postsData.map((p) => p.id);

      // 2. 取得小時級成效數據（含互動欄位）
      const { data: metricsData, error: metricsError } = await supabase
        .from("workspace_threads_post_metrics_hourly")
        .select("workspace_threads_post_id, bucket_ts, views, likes, replies, reposts, quotes")
        .in("workspace_threads_post_id", postIds)
        .order("bucket_ts", { ascending: true });

      if (metricsError) {
        console.error("Failed to fetch hourly metrics:", metricsError);
      }

      // 3. 建立每篇貼文的小時級數據 Map（含互動欄位）
      const metricsMap = new Map<string, HourlyMetric[]>();
      for (const metric of metricsData || []) {
        const postId = metric.workspace_threads_post_id;
        if (!metricsMap.has(postId)) {
          metricsMap.set(postId, []);
        }
        metricsMap.get(postId)!.push({
          bucket_ts: metric.bucket_ts,
          views: metric.views,
          likes: metric.likes,
          replies: metric.replies,
          reposts: metric.reposts,
          quotes: metric.quotes,
        });
      }

      // 4. 處理貼文資料
      const processedPosts: MidtermPost[] = postsData.map((post) => {
        const hourlyMetrics = metricsMap.get(post.id) || [];
        const ageHours = getHoursSincePublish(post.published_at);

        // 計算中期指標
        const metrics = calculateMidtermMetrics(
          hourlyMetrics,
          post.current_views
        );

        // 偵測異常
        const anomaly = detectMidtermAnomaly(post.id, hourlyMetrics, ageHours);

        // 計算互動指標
        const currentEngagements =
          post.current_likes +
          post.current_replies +
          post.current_reposts +
          post.current_quotes;
        const engagement = calculateEngagementMetrics(
          hourlyMetrics,
          post.current_views,
          currentEngagements
        );

        return {
          id: post.id,
          text: post.text || "",
          mediaType: post.media_type,
          publishedAt: post.published_at,
          currentViews: post.current_views,
          currentLikes: post.current_likes,
          currentReplies: post.current_replies,
          currentReposts: post.current_reposts,
          currentQuotes: post.current_quotes,
          ageHours,
          status: metrics.status,
          recent6hDelta: metrics.recent6hDelta,
          avgHourlyDelta: metrics.avgHourlyDelta,
          recent24hDelta: metrics.recent24hDelta,
          hourlyMetrics,
          anomaly,
          engagement,
        };
      });

      setPosts(processedPosts);

      // 如果有選中的貼文，更新它（使用 ref 避免依賴循環）
      if (selectedPostIdRef.current) {
        const updated = processedPosts.find((p) => p.id === selectedPostIdRef.current);
        if (updated) {
          setSelectedPost(updated);
        }
      }
    } catch (error) {
      console.error("Error loading midterm data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccountId, supabase]);

  // 初始載入
  useEffect(() => {
    if (isAccountLoading) return;

    if (!selectedAccountId) {
      setIsLoading(false);
      return;
    }

    loadData();
  }, [selectedAccountId, isAccountLoading, loadData]);

  // 計算摘要統計
  const summary = useMemo<SummaryStats>(() => {
    return {
      total: posts.length,
      growing: posts.filter((p) => p.status === "growing").length,
      slowing: posts.filter((p) => p.status === "slowing").length,
      stabilized: posts.filter((p) => p.status === "stabilized").length,
      // 互動狀態統計
      engagementActive: posts.filter((p) => p.engagement?.engagementStatus === "active").length,
      engagementHealthy: posts.filter((p) => p.engagement?.engagementStatus === "healthy").length,
      engagementWeakening: posts.filter((p) => p.engagement?.engagementStatus === "weakening").length,
    };
  }, [posts]);

  // 過濾出未關閉的異常
  const activeAnomalies = useMemo(() => {
    return posts
      .filter((p) => p.anomaly && !dismissedAnomalies.has(p.id))
      .map((p) => p.anomaly!);
  }, [posts, dismissedAnomalies]);

  // 關閉異常提醒
  const dismissAnomaly = (postId: string) => {
    setDismissedAnomalies((prev) => new Set([...prev, postId]));
  };

  // 空狀態
  if (!isAccountLoading && !selectedAccountId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">中期追蹤</h1>
          <p className="text-muted-foreground">
            觀測發文 3 小時到 7 天的中期表現
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            請先在左側選單選擇一個 Threads 帳號
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">中期追蹤</h1>
          <p className="text-muted-foreground">
            觀測發文 3 小時到 7 天的中期表現
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={isLoading}
        >
          <RefreshCw
            className={cn("mr-2 size-4", isLoading && "animate-spin")}
          />
          刷新
        </Button>
      </div>

      {/* 異常提醒 */}
      <AnomalyAlert anomalies={activeAnomalies} onDismiss={dismissAnomaly} />

      {/* 曝光狀態摘要 */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">曝光狀態</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            title="追蹤中"
            value={summary.total}
            icon={<Activity className="size-5 text-muted-foreground" />}
            isLoading={isLoading}
          />
          <SummaryCard
            title="成長中"
            value={summary.growing}
            icon={<TrendingUp className="size-5 text-green-600" />}
            variant={summary.growing > 0 ? "success" : "default"}
            isLoading={isLoading}
          />
          <SummaryCard
            title="趨緩"
            value={summary.slowing}
            icon={<TrendingDown className="size-5 text-amber-600" />}
            variant={summary.slowing > 0 ? "warning" : "default"}
            isLoading={isLoading}
          />
          <SummaryCard
            title="已穩定"
            value={summary.stabilized}
            icon={<Check className="size-5 text-stone-500" />}
            variant={summary.stabilized > 0 ? "muted" : "default"}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* 互動狀態摘要 */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">互動狀態</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            title="活躍"
            value={summary.engagementActive}
            icon={<Flame className="size-5 text-orange-600" />}
            variant={summary.engagementActive > 0 ? "orange" : "default"}
            isLoading={isLoading}
          />
          <SummaryCard
            title="健康"
            value={summary.engagementHealthy}
            icon={<Heart className="size-5 text-rose-500" />}
            variant={summary.engagementHealthy > 0 ? "rose" : "default"}
            isLoading={isLoading}
          />
          <SummaryCard
            title="疲軟"
            value={summary.engagementWeakening}
            icon={<HeartCrack className="size-5 text-stone-500" />}
            variant={summary.engagementWeakening > 0 ? "muted" : "default"}
            isLoading={isLoading}
          />
        </div>
      </div>

      {/* 生命週期圖 */}
      <LifecycleChart post={selectedPost} isLoading={isLoading} />

      {/* 貼文列表 */}
      <PostsTable
        posts={posts}
        isLoading={isLoading}
        selectedPostId={selectedPost?.id || null}
        onSelectPost={(post) => {
          selectedPostIdRef.current = post.id;
          setSelectedPost(post);
        }}
      />
    </div>
  );
}
