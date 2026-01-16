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
  Lightbulb,
  BarChart3,
  Rocket,
  AlertCircle,
  Info,
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
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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
import { ACCENT, STONE, CHART_COLORS_EXTENDED } from "@/lib/design-tokens";

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
  engagementActive: number;
  engagementHealthy: number;
  engagementWeakening: number;
}

// 行動建議類型
type ActionSuggestionType = "urgent" | "warning" | "success" | "info";

interface ActionSuggestion {
  type: ActionSuggestionType;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  postId: string;
  postText: string;
  actions: string[];
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatNumber(v: number): string {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toLocaleString();
}

// 生成行動建議
function getMidtermSuggestions(posts: MidtermPost[]): ActionSuggestion[] {
  const suggestions: ActionSuggestion[] = [];

  for (const post of posts) {
    // 成長中 + 互動活躍 → 把握熱度
    if (post.status === "growing" && post.engagement?.engagementStatus === "active") {
      suggestions.push({
        type: "urgent",
        icon: Rocket,
        title: "把握熱度",
        description: `「${post.text.slice(0, 20)}...」正在快速成長`,
        postId: post.id,
        postText: post.text,
        actions: ["回覆留言增加互動深度", "準備相關的後續內容"],
      });
    }

    // 成長中 + 互動減弱 → 需要互動
    if (post.status === "growing" && post.engagement?.engagementStatus === "weakening") {
      suggestions.push({
        type: "warning",
        icon: AlertCircle,
        title: "需要互動",
        description: `「${post.text.slice(0, 20)}...」曝光成長但互動減弱`,
        postId: post.id,
        postText: post.text,
        actions: ["主動回覆留言", "引導討論話題"],
      });
    }

    // 異常成長（舊文復活）
    if (post.anomaly?.type === "revival") {
      suggestions.push({
        type: "urgent",
        icon: Flame,
        title: "舊文復活",
        description: `「${post.text.slice(0, 20)}...」獲得異常曝光增長`,
        postId: post.id,
        postText: post.text,
        actions: ["分享到限時動態", "回覆新留言", "考慮製作相關主題新內容"],
      });
    }

    // 趨緩中 + 高互動率 → 表現優異
    if (post.status === "slowing" && post.engagement?.engagementStatus === "active") {
      suggestions.push({
        type: "success",
        icon: Sparkles,
        title: "表現優異",
        description: `「${post.text.slice(0, 20)}...」雖然曝光趨緩但互動仍活躍`,
        postId: post.id,
        postText: post.text,
        actions: ["參考此貼文風格", "記錄成功模式"],
      });
    }

    // 已穩定 → 長尾觀察
    if (post.status === "stabilized") {
      suggestions.push({
        type: "info",
        icon: TrendingUp,
        title: "長尾觀察",
        description: `「${post.text.slice(0, 20)}...」已進入穩定期`,
        postId: post.id,
        postText: post.text,
        actions: ["移至長尾分析追蹤"],
      });
    }
  }

  // 依優先級排序：urgent > warning > success > info
  const priorityOrder: Record<ActionSuggestionType, number> = {
    urgent: 0,
    warning: 1,
    success: 2,
    info: 3,
  };

  return suggestions.sort((a, b) => priorityOrder[a.type] - priorityOrder[b.type]);
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
                  <stop offset="5%" stopColor={ACCENT.DEFAULT} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={ACCENT.DEFAULT} stopOpacity={0} />
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
                stroke={ACCENT.DEFAULT}
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

  const recentMetrics = metrics.slice(-12);
  const maxViews = Math.max(...recentMetrics.map((m) => m.views));
  const minViews = Math.min(...recentMetrics.map((m) => m.views));
  const range = maxViews - minViews || 1;

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

// 行動建議 Badge（內嵌於表格）
function InlineActionBadge({ suggestion }: { suggestion: ActionSuggestion | null }) {
  if (!suggestion) return null;

  const colorMap: Record<ActionSuggestionType, string> = {
    urgent: "bg-red-500/10 text-red-600 border-red-200",
    warning: "bg-amber-500/10 text-amber-600 border-amber-200",
    success: "bg-green-500/10 text-green-600 border-green-200",
    info: "bg-blue-500/10 text-blue-600 border-blue-200",
  };

  const Icon = suggestion.icon;

  return (
    <Badge variant="outline" className={cn("gap-1 text-xs", colorMap[suggestion.type])}>
      <Icon className="size-3" />
      {suggestion.title}
    </Badge>
  );
}

function PostsTable({
  posts,
  isLoading,
  selectedPostId,
  onSelectPost,
  suggestions,
}: {
  posts: MidtermPost[];
  isLoading: boolean;
  selectedPostId: string | null;
  onSelectPost: (post: MidtermPost) => void;
  suggestions: ActionSuggestion[];
}) {
  // 建立 postId -> suggestion 的映射
  const suggestionMap = useMemo(() => {
    const map = new Map<string, ActionSuggestion>();
    for (const s of suggestions) {
      if (!map.has(s.postId)) {
        map.set(s.postId, s);
      }
    }
    return map;
  }, [suggestions]);

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
                <TableHead className="w-20">建議</TableHead>
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
              <TableHead className="w-20">建議</TableHead>
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
                <TableCell>
                  <InlineActionBadge suggestion={suggestionMap.get(post.id) || null} />
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

// 行動建議卡片
function ActionSuggestionCard({ suggestion }: { suggestion: ActionSuggestion }) {
  const colorMap: Record<ActionSuggestionType, string> = {
    urgent: "border-red-200 bg-red-500/5",
    warning: "border-amber-200 bg-amber-500/5",
    success: "border-green-200 bg-green-500/5",
    info: "border-blue-200 bg-blue-500/5",
  };

  const titleColorMap: Record<ActionSuggestionType, string> = {
    urgent: "text-red-600",
    warning: "text-amber-600",
    success: "text-green-600",
    info: "text-blue-600",
  };

  const Icon = suggestion.icon;

  return (
    <Card className={cn("transition-colors", colorMap[suggestion.type])}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className={cn("mt-0.5", titleColorMap[suggestion.type])}>
            <Icon className="size-5" />
          </div>
          <div className="flex-1 space-y-2">
            <div>
              <p className={cn("font-semibold", titleColorMap[suggestion.type])}>
                {suggestion.title}
              </p>
              <p className="text-sm text-muted-foreground">
                {suggestion.description}
              </p>
            </div>
            {suggestion.actions.length > 0 && (
              <ul className="space-y-1">
                {suggestion.actions.map((action, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">•</span>
                    {action}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Tab Components
// ============================================================================

// Tab 1: 總覽
function OverviewTab({
  posts,
  isLoading,
  selectedPost,
  setSelectedPost,
  selectedPostIdRef,
  summary,
  activeAnomalies,
  dismissAnomaly,
  suggestions,
}: {
  posts: MidtermPost[];
  isLoading: boolean;
  selectedPost: MidtermPost | null;
  setSelectedPost: (post: MidtermPost | null) => void;
  selectedPostIdRef: React.MutableRefObject<string | null>;
  summary: SummaryStats;
  activeAnomalies: MidtermAnomaly[];
  dismissAnomaly: (postId: string) => void;
  suggestions: ActionSuggestion[];
}) {
  return (
    <div className="space-y-6">
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
        suggestions={suggestions}
      />
    </div>
  );
}

// 生命週期階段定義
type LifecyclePhase = "burst" | "growth" | "stable" | "longtail";

const LIFECYCLE_PHASE_CONFIG: Record<LifecyclePhase, {
  label: string;
  range: string;
  color: string;
  bgColor: string;
}> = {
  burst: { label: "爆發期", range: "0-6h", color: "text-red-600", bgColor: "bg-red-500" },
  growth: { label: "成長期", range: "6h-2d", color: "text-orange-600", bgColor: "bg-orange-500" },
  stable: { label: "穩定期", range: "2d-5d", color: "text-blue-600", bgColor: "bg-blue-500" },
  longtail: { label: "長尾期", range: "5d+", color: "text-stone-600", bgColor: "bg-stone-500" },
};

function getLifecyclePhase(ageHours: number): LifecyclePhase {
  if (ageHours <= 6) return "burst";
  if (ageHours <= 48) return "growth";
  if (ageHours <= 120) return "stable";
  return "longtail";
}

// Tab 2: 生命週期分析
function LifecycleTab({ posts, isLoading }: { posts: MidtermPost[]; isLoading: boolean }) {
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  // 計算階段分布
  const phaseDistribution = useMemo(() => {
    const dist: Record<LifecyclePhase, MidtermPost[]> = {
      burst: [],
      growth: [],
      stable: [],
      longtail: [],
    };
    for (const post of posts) {
      const phase = getLifecyclePhase(post.ageHours);
      dist[phase].push(post);
    }
    return dist;
  }, [posts]);

  // 計算平均曲線（基於所有貼文的小時級數據）
  const averageCurve = useMemo(() => {
    if (posts.length === 0) return [];

    // 找出最長的小時數（以發布時間為基準）
    const maxHours = Math.max(...posts.map((p) => p.hourlyMetrics.length));
    if (maxHours === 0) return [];

    const avgData: { hour: number; avgViews: number; postCount: number }[] = [];

    for (let h = 0; h < Math.min(maxHours, 168); h++) {
      let totalViews = 0;
      let count = 0;

      for (const post of posts) {
        if (post.hourlyMetrics[h]) {
          totalViews += post.hourlyMetrics[h].views;
          count++;
        }
      }

      if (count > 0) {
        avgData.push({
          hour: h,
          avgViews: Math.round(totalViews / count),
          postCount: count,
        });
      }
    }

    return avgData;
  }, [posts]);

  // 選中的貼文曲線
  const selectedPost = useMemo(() => {
    if (!selectedPostId) return null;
    return posts.find((p) => p.id === selectedPostId) || null;
  }, [posts, selectedPostId]);

  // 關鍵指標計算
  const keyMetrics = useMemo(() => {
    if (posts.length === 0) return null;

    // 平均達峰時間
    const peakHours: number[] = [];
    for (const post of posts) {
      if (post.hourlyMetrics.length < 3) continue;
      let maxDelta = 0;
      let peakIndex = 0;
      for (let i = 1; i < post.hourlyMetrics.length; i++) {
        const delta = post.hourlyMetrics[i].views - post.hourlyMetrics[i - 1].views;
        if (delta > maxDelta) {
          maxDelta = delta;
          peakIndex = i;
        }
      }
      if (peakIndex > 0) peakHours.push(peakIndex);
    }
    const avgPeakHour = peakHours.length > 0
      ? Math.round(peakHours.reduce((a, b) => a + b, 0) / peakHours.length)
      : null;

    // 平均穩定時間（找到增量 < 平均增量 20% 的時間點）
    const stabilizeHours: number[] = [];
    for (const post of posts) {
      if (post.hourlyMetrics.length < 6) continue;
      const avgDelta = post.avgHourlyDelta;
      for (let i = 6; i < post.hourlyMetrics.length; i++) {
        const delta = post.hourlyMetrics[i].views - post.hourlyMetrics[i - 1].views;
        if (delta < avgDelta * 0.2) {
          stabilizeHours.push(i);
          break;
        }
      }
    }
    const avgStabilizeHour = stabilizeHours.length > 0
      ? Math.round(stabilizeHours.reduce((a, b) => a + b, 0) / stabilizeHours.length)
      : null;

    // 長尾佔比（5天後的曝光佔總曝光的比例）
    let totalViews = 0;
    let longtailViews = 0;
    for (const post of posts) {
      totalViews += post.currentViews;
      // 計算 120 小時後的增量
      if (post.hourlyMetrics.length > 120) {
        const viewsAt120h = post.hourlyMetrics[119]?.views || 0;
        longtailViews += (post.currentViews - viewsAt120h);
      }
    }
    const longtailRatio = totalViews > 0 ? (longtailViews / totalViews) * 100 : 0;

    return { avgPeakHour, avgStabilizeHour, longtailRatio };
  }, [posts]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-64 w-full" />
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
            <p>沒有足夠的資料進行分析</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 準備比較圖表數據
  const comparisonChartData = averageCurve.map((avg) => {
    const selectedViews = selectedPost?.hourlyMetrics[avg.hour]?.views || null;
    return {
      label: avg.hour < 24 ? `${avg.hour}h` : `${Math.floor(avg.hour / 24)}d`,
      hour: avg.hour,
      avgViews: avg.avgViews,
      selectedViews,
    };
  });

  return (
    <div className="space-y-6">
      {/* 曝光階段分布 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5" />
            曝光階段分布
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            {(Object.entries(LIFECYCLE_PHASE_CONFIG) as [LifecyclePhase, typeof LIFECYCLE_PHASE_CONFIG[LifecyclePhase]][]).map(([phase, config]) => {
              const phasePosts = phaseDistribution[phase];
              const percentage = posts.length > 0 ? (phasePosts.length / posts.length) * 100 : 0;

              return (
                <div key={phase} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-sm font-medium", config.color)}>
                      {config.label}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {config.range}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all", config.bgColor)}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{phasePosts.length} 則</span>
                    <span className="text-muted-foreground">{percentage.toFixed(0)}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 關鍵時間點指標 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-orange-500/10">
                <Flame className="size-5 text-orange-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">平均達峰時間</p>
                <p className="text-xl font-bold">
                  {keyMetrics?.avgPeakHour ? `${keyMetrics.avgPeakHour} 小時` : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-blue-500/10">
                <Check className="size-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">平均穩定時間</p>
                <p className="text-xl font-bold">
                  {keyMetrics?.avgStabilizeHour
                    ? keyMetrics.avgStabilizeHour < 24
                      ? `${keyMetrics.avgStabilizeHour} 小時`
                      : `${(keyMetrics.avgStabilizeHour / 24).toFixed(1)} 天`
                    : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-stone-500/10">
                <Activity className="size-5 text-stone-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">長尾佔比</p>
                <p className="text-xl font-bold">
                  {keyMetrics?.longtailRatio ? `${keyMetrics.longtailRatio.toFixed(1)}%` : "-"}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 平均 vs 個別曲線比較 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-5" />
            平均 vs 個別曲線比較
          </CardTitle>
          <div className="flex flex-wrap gap-2 mt-2">
            <Button
              variant={selectedPostId === null ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedPostId(null)}
            >
              僅顯示平均
            </Button>
            {posts.slice(0, 5).map((post) => (
              <Button
                key={post.id}
                variant={selectedPostId === post.id ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedPostId(post.id)}
                className="max-w-40 truncate"
              >
                {post.text?.slice(0, 15) || "(無文字)"}...
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={comparisonChartData}>
                <defs>
                  <linearGradient id="colorAvg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={STONE[400]} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={STONE[400]} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorSelected" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ACCENT.DEFAULT} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={ACCENT.DEFAULT} stopOpacity={0} />
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
                        <p className="text-sm text-stone-600">
                          平均曝光：<span className="font-mono font-medium">{formatNumber(data.avgViews)}</span>
                        </p>
                        {data.selectedViews !== null && (
                          <p className="text-sm text-primary">
                            選中貼文：<span className="font-mono font-medium">{formatNumber(data.selectedViews)}</span>
                          </p>
                        )}
                      </div>
                    );
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="avgViews"
                  stroke={STONE[400]}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fillOpacity={1}
                  fill="url(#colorAvg)"
                  name="平均曲線"
                />
                {selectedPost && (
                  <Area
                    type="monotone"
                    dataKey="selectedViews"
                    stroke={ACCENT.DEFAULT}
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorSelected)"
                    name="選中貼文"
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 flex justify-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-6 border-t-2 border-dashed border-stone-400" />
              <span className="text-muted-foreground">平均曲線</span>
            </div>
            {selectedPost && (
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-6 bg-primary" />
                <span className="text-muted-foreground">選中貼文</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// 貼文比較用的顏色（使用 design tokens）
const COMPARISON_COLORS = CHART_COLORS_EXTENDED.slice(0, 5).map((color) => ({
  stroke: color,
  fill: color,
}));

// Tab 3: 貼文比較
function ComparisonTab({ posts, isLoading }: { posts: MidtermPost[]; isLoading: boolean }) {
  const [selectedPostIds, setSelectedPostIds] = useState<Set<string>>(new Set());

  // Toggle 選擇貼文
  const togglePostSelection = (postId: string) => {
    setSelectedPostIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(postId)) {
        newSet.delete(postId);
      } else if (newSet.size < 5) {
        newSet.add(postId);
      }
      return newSet;
    });
  };

  // 選中的貼文
  const selectedPosts = useMemo(() => {
    return posts.filter((p) => selectedPostIds.has(p.id));
  }, [posts, selectedPostIds]);

  // 成效排名
  const rankings = useMemo(() => {
    if (posts.length === 0) return null;

    // 近 24h 成長 Top 5
    const growth24h = [...posts]
      .filter((p) => p.recent24hDelta !== null)
      .sort((a, b) => (b.recent24hDelta || 0) - (a.recent24hDelta || 0))
      .slice(0, 5);

    // 互動率 Top 5
    const engagementTop = [...posts]
      .filter((p) => p.engagement !== null)
      .sort((a, b) => (b.engagement?.engagementRate || 0) - (a.engagement?.engagementRate || 0))
      .slice(0, 5);

    // 異常成長（舊文復活）
    const anomalies = posts.filter((p) => p.anomaly?.type === "revival");

    return { growth24h, engagementTop, anomalies };
  }, [posts]);

  // 內容類型統計
  const mediaTypeStats = useMemo(() => {
    if (posts.length === 0) return [];

    const stats: Record<string, { count: number; totalViews: number; label: string }> = {};

    for (const post of posts) {
      const type = post.mediaType || "TEXT";
      let label = "純文字";
      if (type === "VIDEO") label = "影片";
      else if (type === "IMAGE") label = "圖文";
      else if (type === "CAROUSEL_ALBUM") label = "輪播";

      if (!stats[type]) {
        stats[type] = { count: 0, totalViews: 0, label };
      }
      stats[type].count++;
      stats[type].totalViews += post.currentViews;
    }

    return Object.entries(stats)
      .map(([type, data]) => ({
        type,
        label: data.label,
        count: data.count,
        avgViews: Math.round(data.totalViews / data.count),
      }))
      .sort((a, b) => b.avgViews - a.avgViews);
  }, [posts]);

  // 準備多貼文比較的圖表數據
  const comparisonChartData = useMemo(() => {
    if (selectedPosts.length === 0) return [];

    // 找出所有選中貼文中最長的小時數
    const maxHours = Math.max(...selectedPosts.map((p) => p.hourlyMetrics.length));
    if (maxHours === 0) return [];

    const data: Array<Record<string, number | string | null>> = [];

    for (let h = 0; h < Math.min(maxHours, 168); h++) {
      const point: Record<string, number | string | null> = {
        label: h < 24 ? `${h}h` : `${Math.floor(h / 24)}d`,
        hour: h,
      };

      selectedPosts.forEach((post, idx) => {
        point[`post${idx}`] = post.hourlyMetrics[h]?.views || null;
      });

      data.push(point);
    }

    return data;
  }, [selectedPosts]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-64 w-full" />
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
            <p>沒有足夠的資料進行比較</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 找出最大平均曝光用於計算 bar 寬度
  const maxAvgViews = Math.max(...mediaTypeStats.map((s) => s.avgViews), 1);

  return (
    <div className="space-y-6">
      {/* 多貼文曲線對比 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-5" />
            多貼文曲線對比
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            選擇 2-5 則貼文進行比較（已選 {selectedPostIds.size}/5）
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {posts.slice(0, 10).map((post, idx) => {
              const isSelected = selectedPostIds.has(post.id);
              const colorIdx = selectedPosts.findIndex((p) => p.id === post.id);

              return (
                <Button
                  key={post.id}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => togglePostSelection(post.id)}
                  className="max-w-40 truncate"
                  style={isSelected && colorIdx >= 0 ? {
                    backgroundColor: COMPARISON_COLORS[colorIdx].fill,
                    borderColor: COMPARISON_COLORS[colorIdx].stroke,
                  } : undefined}
                >
                  {post.text?.slice(0, 15) || "(無文字)"}...
                </Button>
              );
            })}
          </div>
        </CardHeader>
        <CardContent>
          {selectedPosts.length < 2 ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Activity className="mx-auto mb-2 size-12 opacity-20" />
                <p>請選擇至少 2 則貼文進行比較</p>
              </div>
            </div>
          ) : (
            <>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={comparisonChartData}>
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
                        return (
                          <div className="rounded-lg border bg-background p-3 shadow-lg">
                            <p className="mb-2 font-medium">發布後 {label}</p>
                            {payload.map((entry, idx) => {
                              if (entry.value === null) return null;
                              const post = selectedPosts[idx];
                              return (
                                <p key={idx} className="text-sm" style={{ color: COMPARISON_COLORS[idx].stroke }}>
                                  {post?.text?.slice(0, 15) || "(無文字)"}...: {" "}
                                  <span className="font-mono font-medium">{formatNumber(entry.value as number)}</span>
                                </p>
                              );
                            })}
                          </div>
                        );
                      }}
                    />
                    {selectedPosts.map((_, idx) => (
                      <Area
                        key={idx}
                        type="monotone"
                        dataKey={`post${idx}`}
                        stroke={COMPARISON_COLORS[idx].stroke}
                        strokeWidth={2}
                        fillOpacity={0.1}
                        fill={COMPARISON_COLORS[idx].fill}
                      />
                    ))}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-4 flex flex-wrap justify-center gap-4 text-sm">
                {selectedPosts.map((post, idx) => (
                  <div key={post.id} className="flex items-center gap-2">
                    <div
                      className="h-0.5 w-6 rounded"
                      style={{ backgroundColor: COMPARISON_COLORS[idx].fill }}
                    />
                    <span className="text-muted-foreground max-w-32 truncate">
                      {post.text?.slice(0, 15) || "(無文字)"}...
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 成效排名表 */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* 近 24h 成長 Top 5 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <TrendingUp className="size-4 text-green-600" />
              近 24h 成長 Top 5
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {rankings?.growth24h.length === 0 ? (
              <p className="text-sm text-muted-foreground">無資料</p>
            ) : (
              <div className="space-y-2">
                {rankings?.growth24h.map((post, idx) => (
                  <div key={post.id} className="flex items-center gap-2">
                    <span className="w-5 text-sm font-bold text-muted-foreground">{idx + 1}.</span>
                    <span className="flex-1 text-sm truncate">{post.text?.slice(0, 20) || "(無文字)"}</span>
                    <span className="text-sm font-mono text-green-600">+{formatNumber(post.recent24hDelta || 0)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 互動率 Top 5 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Heart className="size-4 text-rose-500" />
              互動率 Top 5
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {rankings?.engagementTop.length === 0 ? (
              <p className="text-sm text-muted-foreground">無資料</p>
            ) : (
              <div className="space-y-2">
                {rankings?.engagementTop.map((post, idx) => (
                  <div key={post.id} className="flex items-center gap-2">
                    <span className="w-5 text-sm font-bold text-muted-foreground">{idx + 1}.</span>
                    <span className="flex-1 text-sm truncate">{post.text?.slice(0, 20) || "(無文字)"}</span>
                    <span className="text-sm font-mono text-rose-500">{post.engagement?.engagementRate.toFixed(2)}%</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 異常成長 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-violet-600" />
              舊文復活
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {rankings?.anomalies.length === 0 ? (
              <p className="text-sm text-muted-foreground">目前沒有異常成長的貼文</p>
            ) : (
              <div className="space-y-2">
                {rankings?.anomalies.map((post) => (
                  <div key={post.id} className="flex items-center gap-2">
                    <Sparkles className="size-4 text-violet-600 shrink-0" />
                    <span className="flex-1 text-sm truncate">{post.text?.slice(0, 20) || "(無文字)"}</span>
                    <span className="text-sm font-mono text-violet-600">{post.anomaly?.ratio.toFixed(1)}x</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 內容類型比較 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="size-5" />
            內容類型平均表現
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mediaTypeStats.map((stat, idx) => (
              <div key={stat.type} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{stat.label}</span>
                  <span className="text-sm text-muted-foreground">{stat.count} 則</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-6 flex-1 rounded bg-muted overflow-hidden">
                    <div
                      className="h-full rounded transition-all"
                      style={{
                        width: `${(stat.avgViews / maxAvgViews) * 100}%`,
                        backgroundColor: COMPARISON_COLORS[idx % COMPARISON_COLORS.length].fill,
                      }}
                    />
                  </div>
                  <span className="text-sm font-mono w-16 text-right">{formatNumber(stat.avgViews)}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-muted-foreground text-center">
            * 平均曝光（發布 7 天內）
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// Tab 4: 洞察與建議
function InsightsTab({
  posts,
  isLoading,
  suggestions,
}: {
  posts: MidtermPost[];
  isLoading: boolean;
  suggestions: ActionSuggestion[];
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // 計算洞察數據
  const insights = useMemo(() => {
    if (posts.length === 0) return null;

    // 計算平均達峰時間（基於 hourlyMetrics 找出最大增量的時間點）
    const peakHours: number[] = [];
    for (const post of posts) {
      if (post.hourlyMetrics.length < 3) continue;
      let maxDelta = 0;
      let peakIndex = 0;
      for (let i = 1; i < post.hourlyMetrics.length; i++) {
        const delta = post.hourlyMetrics[i].views - post.hourlyMetrics[i - 1].views;
        if (delta > maxDelta) {
          maxDelta = delta;
          peakIndex = i;
        }
      }
      if (peakIndex > 0) {
        peakHours.push(peakIndex);
      }
    }
    const avgPeakHour = peakHours.length > 0
      ? Math.round(peakHours.reduce((a, b) => a + b, 0) / peakHours.length)
      : null;

    // 計算內容類型表現
    const mediaTypeStats: Record<string, { count: number; totalViews: number }> = {};
    for (const post of posts) {
      const type = post.mediaType || "TEXT";
      if (!mediaTypeStats[type]) {
        mediaTypeStats[type] = { count: 0, totalViews: 0 };
      }
      mediaTypeStats[type].count++;
      mediaTypeStats[type].totalViews += post.currentViews;
    }

    const mediaTypeAvg = Object.entries(mediaTypeStats)
      .map(([type, stats]) => ({
        type,
        avgViews: Math.round(stats.totalViews / stats.count),
      }))
      .sort((a, b) => b.avgViews - a.avgViews);

    // 找出異常復活的貼文數
    const revivalCount = posts.filter((p) => p.anomaly?.type === "revival").length;

    return {
      avgPeakHour,
      mediaTypeAvg,
      revivalCount,
      topMediaType: mediaTypeAvg[0],
    };
  }, [posts]);

  return (
    <div className="space-y-6">
      {/* AI 洞察摘要 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="size-5" />
            本週洞察
          </CardTitle>
        </CardHeader>
        <CardContent>
          {posts.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Activity className="mx-auto mb-2 size-12 opacity-20" />
                <p>沒有足夠的資料產生洞察</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {insights?.avgPeakHour && (
                <div className="flex items-start gap-3">
                  <span className="text-primary font-bold">1.</span>
                  <span>
                    你的貼文平均在發布後 <span className="font-semibold">{insights.avgPeakHour} 小時</span>達到曝光增速峰值
                  </span>
                </div>
              )}
              {insights?.topMediaType && (
                <div className="flex items-start gap-3">
                  <span className="text-primary font-bold">2.</span>
                  <span>
                    <span className="font-semibold">{insights.topMediaType.type === "VIDEO" ? "影片" : insights.topMediaType.type === "IMAGE" ? "圖文" : "純文字"}</span>
                    內容平均曝光 {formatNumber(insights.topMediaType.avgViews)}，表現最佳
                  </span>
                </div>
              )}
              {insights?.revivalCount !== undefined && insights.revivalCount > 0 && (
                <div className="flex items-start gap-3">
                  <span className="text-primary font-bold">3.</span>
                  <span>
                    有 <span className="font-semibold">{insights.revivalCount} 則</span>舊文被重新推薦，獲得額外曝光
                  </span>
                </div>
              )}
              {(!insights?.avgPeakHour && !insights?.topMediaType && (insights?.revivalCount === 0 || insights?.revivalCount === undefined)) && (
                <div className="text-muted-foreground">
                  資料累積中，稍後將顯示更多洞察
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 行動建議 */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">行動建議</h3>
        {suggestions.length === 0 ? (
          <Card>
            <CardContent className="flex h-32 items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Info className="mx-auto mb-2 size-12 opacity-20" />
                <p>目前沒有需要處理的建議</p>
                <p className="text-sm">貼文表現穩定</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {suggestions.slice(0, 6).map((suggestion, i) => (
              <ActionSuggestionCard key={`${suggestion.postId}-${i}`} suggestion={suggestion} />
            ))}
          </div>
        )}
      </div>
    </div>
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
  const [activeTab, setActiveTab] = useState("overview");

  const selectedPostIdRef = useRef<string | null>(null);

  // 載入資料
  const loadData = useCallback(async () => {
    if (!selectedAccountId) return;

    setIsLoading(true);

    try {
      const now = new Date();
      const hours3Ago = new Date(now.getTime() - 3 * 60 * 60 * 1000);
      const days7Ago = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

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

      const { data: metricsData, error: metricsError } = await supabase
        .from("workspace_threads_post_metrics_hourly")
        .select("workspace_threads_post_id, bucket_ts, views, likes, replies, reposts, quotes")
        .in("workspace_threads_post_id", postIds)
        .order("bucket_ts", { ascending: true });

      if (metricsError) {
        console.error("Failed to fetch hourly metrics:", metricsError);
      }

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

      const processedPosts: MidtermPost[] = postsData.map((post) => {
        const hourlyMetrics = metricsMap.get(post.id) || [];
        const ageHours = getHoursSincePublish(post.published_at);

        const metrics = calculateMidtermMetrics(
          hourlyMetrics,
          post.current_views
        );

        const anomaly = detectMidtermAnomaly(post.id, hourlyMetrics, ageHours);

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

  // 生成行動建議
  const suggestions = useMemo(() => {
    return getMidtermSuggestions(posts);
  }, [posts]);

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

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-2">
            <Activity className="size-4" />
            總覽
          </TabsTrigger>
          <TabsTrigger value="lifecycle" className="gap-2">
            <TrendingUp className="size-4" />
            生命週期
          </TabsTrigger>
          <TabsTrigger value="comparison" className="gap-2">
            <BarChart3 className="size-4" />
            貼文比較
          </TabsTrigger>
          <TabsTrigger value="insights" className="gap-2">
            <Lightbulb className="size-4" />
            洞察建議
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab
            posts={posts}
            isLoading={isLoading}
            selectedPost={selectedPost}
            setSelectedPost={setSelectedPost}
            selectedPostIdRef={selectedPostIdRef}
            summary={summary}
            activeAnomalies={activeAnomalies}
            dismissAnomaly={dismissAnomaly}
            suggestions={suggestions}
          />
        </TabsContent>

        <TabsContent value="lifecycle">
          <LifecycleTab posts={posts} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="comparison">
          <ComparisonTab posts={posts} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="insights">
          <InsightsTab
            posts={posts}
            isLoading={isLoading}
            suggestions={suggestions}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
