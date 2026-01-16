"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  MessageSquare,
  Repeat2,
  Quote,
  Lightbulb,
  Target,
  Clock,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Activity,
  BarChart3,
  FileText,
  PanelRightOpen,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Line,
  ComposedChart,
  LabelList,
} from "recharts";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useSelectedAccount } from "@/hooks/use-selected-account";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  type Period,
  DAY_NAMES,
  WEEKDAY_NAMES,
  HOUR_LABELS_24,
  TEAL_SHADES,
  formatNumber,
  truncateText,
  getDateRange,
  getEndOfDay,
  calcGrowth,
  getHeatmapColor,
} from "@/lib/insights-utils";
import {
  INTERACTION_COLORS as DESIGN_INTERACTION_COLORS,
  CHART_COLORS,
  ACCENT,
  SEMANTIC_COLORS,
  STONE,
} from "@/lib/design-tokens";
import { GrowthBadge, KPICard, HeatmapLegend } from "@/components/insights/shared-components";
import { PostDetailPanel } from "@/components/posts/post-detail-panel";

type ViewMode = "report" | "insights";

// ============================================================================
// Types
// ============================================================================

interface EngagementData {
  totalLikes: number;
  totalReplies: number;
  totalReposts: number;
  totalQuotes: number;
  totalViews: number;
  postsCount: number;
}

interface TagStats {
  tagName: string;
  postCount: number;
  totalViews: number;
  totalReplies: number;
  totalInteractions: number;
  avgEngagementRate: number;
  replyRate: number;
}

interface HourlyInteraction {
  dayOfWeek: number;
  hour: number;
  interactions: number;
}

interface TopPost {
  id: string;
  text: string;
  publishedAt: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  engagementRate: number;
  replyRate: number;
  textLength: number;
  hasMedia: boolean;
  tags: string[];
}

interface ActionSuggestion {
  title: string;
  reason: string;
  action: string;
  example?: string;
  priority: "high" | "medium" | "low";
}

interface TrendDataPoint {
  timestamp: number;
  label: string;
  totalInteractions: number;
  engagementRate: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
}

interface CompositionData {
  type: string;
  label: string;
  value: number;
  fill: string;
  percentage: number;
}

// ============================================================================
// Constants - 使用 design-tokens
// ============================================================================

const INTERACTION_COLORS = DESIGN_INTERACTION_COLORS;

const trendChartConfig: ChartConfig = {
  totalInteractions: { label: "互動數", color: CHART_COLORS.chart1 },
  engagementRate: { label: "互動率", color: CHART_COLORS.chart2 },
};

const compositionChartConfig: ChartConfig = {
  likes: { label: "讚", color: INTERACTION_COLORS.likes },
  replies: { label: "回覆", color: INTERACTION_COLORS.replies },
  reposts: { label: "轉發", color: INTERACTION_COLORS.reposts },
  quotes: { label: "引用", color: INTERACTION_COLORS.quotes },
};

// ============================================================================
// Utility Functions
// ============================================================================

function calculateQualityScore(data: EngagementData): number {
  const total = data.totalLikes + data.totalReplies + data.totalReposts + data.totalQuotes;
  if (total === 0) return 0;

  const replyRatio = data.totalReplies / total;
  const quoteRatio = data.totalQuotes / total;
  const repostRatio = data.totalReposts / total;
  const likeRatio = data.totalLikes / total;

  const replyScore = Math.min(replyRatio / 0.25, 1) * 40;
  const quoteScore = Math.min(quoteRatio / 0.15, 1) * 30;
  const repostScore = Math.min(repostRatio / 0.20, 1) * 20;
  const likeScore = Math.min(likeRatio / 0.40, 1) * 10;

  return Math.round(replyScore + quoteScore + repostScore + likeScore);
}

function getQualityRating(score: number): { label: string; color: string } {
  if (score >= 80) return { label: "優秀", color: "text-success" };
  if (score >= 60) return { label: "良好", color: "text-primary" };
  if (score >= 40) return { label: "一般", color: "text-warning" };
  return { label: "需改善", color: "text-destructive" };
}

function getEffectRating(replyRate: number, engagementRate: number): { stars: number; label: string } {
  const score = replyRate * 2 + engagementRate;
  if (score >= 5) return { stars: 3, label: "最佳" };
  if (score >= 2) return { stars: 2, label: "良好" };
  if (score >= 1) return { stars: 1, label: "一般" };
  return { stars: 0, label: "需改善" };
}

// ============================================================================
// Report Tab Components (基本圖表)
// ============================================================================

function EngagementTrendChart({
  data,
  isLoading,
  period,
  offset,
  totalInteractions,
  interactionsGrowth,
}: {
  data: TrendDataPoint[];
  isLoading: boolean;
  period: Period;
  offset: number;
  totalInteractions: number;
  interactionsGrowth?: number;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
        <CardContent><Skeleton className="h-[300px] w-full" /></CardContent>
      </Card>
    );
  }

  const hasData = data.length > 0 && data.some((d) => d.totalInteractions > 0);
  const maxInteractions = Math.max(...data.map((d) => d.totalInteractions), 1);
  const maxEngagement = Math.max(...data.map((d) => d.engagementRate), 1);
  const range = getDateRange(period, offset);
  const startLabel = `${range.start.getMonth() + 1}/${range.start.getDate()}`;
  const endLabel = `${range.end.getMonth() + 1}/${range.end.getDate()}`;
  const periodLabel = period === "week" ? "上週" : "上月";

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Activity className="size-5" />
              互動趨勢
            </CardTitle>
            <CardDescription>
              {startLabel} - {endLabel} 互動數與互動率變化
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold">
              {formatNumber(totalInteractions)}
            </div>
            {interactionsGrowth !== undefined && (
              <div className="flex items-center justify-end gap-2">
                <span className="text-sm text-muted-foreground">
                  vs {periodLabel}
                </span>
                <GrowthBadge value={interactionsGrowth} />
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <p>該期間尚無互動趨勢資料</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-end gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-4 rounded bg-primary" />
                <span className="text-muted-foreground">互動數</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-4 rounded bg-warning" />
                <span className="text-muted-foreground">互動率</span>
              </div>
            </div>
            <ChartContainer config={trendChartConfig} className="h-[280px] w-full">
              <ComposedChart data={data} margin={{ left: 0, right: 0, top: 10, bottom: 20 }}>
                <defs>
                  <linearGradient id="interactionsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ACCENT.DEFAULT} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={ACCENT.DEFAULT} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  fontSize={10}
                />
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  width={45}
                  tickFormatter={(value) => formatNumber(value)}
                  fontSize={10}
                  domain={[0, maxInteractions * 1.1]}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  width={40}
                  tickFormatter={(value) => `${value.toFixed(1)}%`}
                  fontSize={10}
                  domain={[0, maxEngagement * 1.2]}
                />
                <ChartTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const point = payload[0].payload as TrendDataPoint;
                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-lg">
                        <div className="mb-2 font-medium">{point.label}</div>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">互動數</span>
                            <span className="font-medium">{formatNumber(point.totalInteractions)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">互動率</span>
                            <span className="font-medium">{point.engagementRate.toFixed(2)}%</span>
                          </div>
                          <div className="my-2 border-t" />
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="flex items-center gap-1">
                              <Heart className="size-3 text-primary" />
                              <span>{formatNumber(point.likes)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <MessageSquare className="size-3 text-primary" />
                              <span>{formatNumber(point.replies)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Repeat2 className="size-3 text-primary/80" />
                              <span>{formatNumber(point.reposts)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Quote className="size-3 text-primary/60" />
                              <span>{formatNumber(point.quotes)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="totalInteractions"
                  stroke={ACCENT.DEFAULT}
                  fill="url(#interactionsGradient)"
                  strokeWidth={2}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="engagementRate"
                  stroke={SEMANTIC_COLORS.warning}
                  strokeWidth={2}
                  dot={false}
                />
              </ComposedChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CompositionPieChart({
  data,
  isLoading,
}: {
  data: CompositionData[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
        <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
      </Card>
    );
  }

  const hasData = data.length > 0 && data.some((d) => d.value > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="size-5" />
          互動組成
        </CardTitle>
        <CardDescription>各類互動佔比分佈</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            尚無互動資料
          </div>
        ) : (
          <div className="flex items-center gap-6">
            <ChartContainer config={compositionChartConfig} className="h-[200px] flex-1">
              <PieChart>
                <ChartTooltip
                  content={<ChartTooltipContent formatter={(value) => `${formatNumber(value as number)} 次`} />}
                />
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                />
              </PieChart>
            </ChartContainer>
            <div className="flex flex-col gap-2 text-sm">
              {data.map((item) => (
                <div key={item.type} className="flex items-center gap-2">
                  <div className="size-3 shrink-0 rounded-full" style={{ backgroundColor: item.fill }} />
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="ml-auto font-medium">{item.percentage.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TagEngagementChart({
  data,
  isLoading,
}: {
  data: TagStats[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
        <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
      </Card>
    );
  }

  const hasData = data.length > 0;
  const sortedData = [...data].sort((a, b) => b.avgEngagementRate - a.avgEngagementRate);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="size-5" />
          標籤互動效率
        </CardTitle>
        <CardDescription>各標籤的平均互動率對比</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            尚無已標籤的貼文
          </div>
        ) : (
          <ChartContainer
            config={{ engagementRate: { label: "互動率", color: ACCENT.DEFAULT } }}
            className="h-[200px] w-full"
          >
            <BarChart data={sortedData.slice(0, 6)} layout="vertical" margin={{ left: 0, right: 40 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                fontSize={10}
                tickFormatter={(v) => `${v.toFixed(1)}%`}
              />
              <YAxis
                type="category"
                dataKey="tagName"
                tickLine={false}
                axisLine={false}
                width={80}
                fontSize={10}
              />
              <ChartTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const item = payload[0].payload as TagStats;
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-lg text-xs">
                      <div className="font-medium mb-1">{item.tagName}</div>
                      <div className="space-y-0.5">
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">貼文數</span>
                          <span>{item.postCount} 篇</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">平均互動率</span>
                          <span>{item.avgEngagementRate.toFixed(2)}%</span>
                        </div>
                        <div className="flex justify-between gap-4">
                          <span className="text-muted-foreground">總互動</span>
                          <span>{formatNumber(item.totalInteractions)}</span>
                        </div>
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="avgEngagementRate" radius={[0, 4, 4, 0]}>
                {sortedData.slice(0, 6).map((item, index) => (
                  <Cell key={item.tagName} fill={TEAL_SHADES[index % TEAL_SHADES.length]} />
                ))}
                <LabelList
                  dataKey="avgEngagementRate"
                  position="right"
                  formatter={(v: number) => `${v.toFixed(1)}%`}
                  fontSize={10}
                  className="fill-foreground"
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function TopPostsList({
  posts,
  isLoading,
  onPostClick,
}: {
  posts: TopPost[];
  isLoading: boolean;
  onPostClick?: (postId: string) => void;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  const sortedPosts = [...posts].sort((a, b) => b.engagementRate - a.engagementRate).slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-5" />
          高互動率貼文 Top 5
        </CardTitle>
        <CardDescription>依互動率排序的最佳表現貼文</CardDescription>
      </CardHeader>
      <CardContent>
        {sortedPosts.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            沒有貼文數據
          </div>
        ) : (
          <div className="space-y-2">
            {sortedPosts.map((post, index) => (
              <div
                key={post.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <div
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    index === 0
                      ? "bg-warning text-warning-foreground"
                      : index === 1
                        ? "bg-muted-foreground/60 text-white"
                        : index === 2
                          ? "bg-warning/70 text-warning-foreground"
                          : "bg-muted text-muted-foreground"
                  )}
                >
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    {truncateText(post.text, 20)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-medium text-primary">
                    {post.engagementRate.toFixed(2)}%
                  </div>
                </div>
                {onPostClick && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => onPostClick(post.id)}
                  >
                    <PanelRightOpen className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FlopPostsList({
  posts,
  isLoading,
  onPostClick,
}: {
  posts: TopPost[];
  isLoading: boolean;
  onPostClick?: (postId: string) => void;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  // 按互動率升序排序（最低的在前）
  const sortedPosts = [...posts].sort((a, b) => a.engagementRate - b.engagementRate).slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="size-5 text-destructive" />
          低互動率貼文 Flop 5
        </CardTitle>
        <CardDescription>依互動率排序的最低表現貼文</CardDescription>
      </CardHeader>
      <CardContent>
        {sortedPosts.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            沒有貼文數據
          </div>
        ) : (
          <div className="space-y-2">
            {sortedPosts.map((post, index) => (
              <div
                key={post.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    {truncateText(post.text, 20)}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-sm font-medium text-destructive">
                    {post.engagementRate.toFixed(2)}%
                  </div>
                </div>
                {onPostClick && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 shrink-0"
                    onClick={() => onPostClick(post.id)}
                  >
                    <PanelRightOpen className="size-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Insights Tab Components (洞察分析)
// ============================================================================

function QualityScoreBlock({
  data,
  isLoading,
}: {
  data: EngagementData | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
        <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="size-5 text-primary" />
            互動品質
          </CardTitle>
          <CardDescription>我的互動有價值嗎？</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[180px] items-center justify-center text-muted-foreground">
            尚無互動資料
          </div>
        </CardContent>
      </Card>
    );
  }

  const total = data.totalLikes + data.totalReplies + data.totalReposts + data.totalQuotes;
  const qualityScore = calculateQualityScore(data);
  const rating = getQualityRating(qualityScore);
  const deepEngagementRatio = total > 0 ? ((data.totalReplies + data.totalQuotes) / total) * 100 : 0;

  const composition = [
    { label: "讚", value: data.totalLikes, ratio: total > 0 ? (data.totalLikes / total) * 100 : 0, icon: Heart },
    { label: "回覆", value: data.totalReplies, ratio: total > 0 ? (data.totalReplies / total) * 100 : 0, icon: MessageSquare },
    { label: "轉發", value: data.totalReposts, ratio: total > 0 ? (data.totalReposts / total) * 100 : 0, icon: Repeat2 },
    { label: "引用", value: data.totalQuotes, ratio: total > 0 ? (data.totalQuotes / total) * 100 : 0, icon: Quote },
  ];

  const suggestions: string[] = [];
  const replyRatio = total > 0 ? (data.totalReplies / total) * 100 : 0;
  const quoteRatio = total > 0 ? (data.totalQuotes / total) * 100 : 0;
  const repostRatio = total > 0 ? (data.totalReposts / total) * 100 : 0;

  if (replyRatio < 10) suggestions.push("多發問題式內容，引發討論");
  if (quoteRatio < 3) suggestions.push("嘗試發爭議性或啟發性觀點");
  if (repostRatio < 5) suggestions.push("創作更多可分享的實用內容");
  if (suggestions.length === 0 && qualityScore < 60) {
    suggestions.push("嘗試多樣化內容類型，增加深度互動");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="size-5 text-primary" />
          互動品質
        </CardTitle>
        <CardDescription>我的互動有價值嗎？</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-6">
          <div className="flex flex-col items-center gap-2">
            <div className="relative flex size-28 items-center justify-center">
              <svg className="absolute size-28 -rotate-90">
                <circle cx="56" cy="56" r="48" fill="none" stroke={STONE[200]} strokeWidth="8" />
                <circle
                  cx="56" cy="56" r="48" fill="none" stroke={ACCENT.DEFAULT} strokeWidth="8"
                  strokeDasharray={`${(qualityScore / 100) * 301.6} 301.6`}
                  strokeLinecap="round"
                />
              </svg>
              <div className="text-center">
                <div className="text-3xl font-bold">{qualityScore}</div>
                <div className="text-xs text-muted-foreground">品質分數</div>
              </div>
            </div>
            <Badge variant="outline" className={cn("text-xs", rating.color)}>{rating.label}</Badge>
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-muted-foreground">深度互動比例</span>
                <span className="font-medium">{deepEngagementRatio.toFixed(1)}%</span>
              </div>
              <Progress value={deepEngagementRatio} className="h-2" />
              <p className="mt-1 text-xs text-muted-foreground">(回覆 + 引用) / 總互動</p>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">互動組成</p>
              {composition.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-xs">
                  <item.icon className="size-3 text-muted-foreground" />
                  <span className="w-8 text-muted-foreground">{item.label}</span>
                  <div className="flex-1">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${Math.max(item.ratio, 2)}%` }} />
                  </div>
                  <span className="w-10 text-right">{item.ratio.toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {suggestions.length > 0 && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="text-sm">
              <p className="font-medium text-foreground">
                {composition[0].ratio > 70 ? "你的粉絲傾向「按讚走人」" : "深度互動有提升空間"}
              </p>
              <p className="mt-1 text-muted-foreground">
                建議：{suggestions.join("、")}
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ContentEffectBlock({
  tagStats,
  totalPosts,
  isLoading,
}: {
  tagStats: TagStats[];
  totalPosts: number;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-48" /></CardHeader>
        <CardContent><Skeleton className="h-[200px] w-full" /></CardContent>
      </Card>
    );
  }

  const sortedTags = [...tagStats].sort((a, b) => b.replyRate - a.replyRate);
  const bestTag = sortedTags[0];
  const suggestion = bestTag && bestTag.postCount / totalPosts < 0.3 ? bestTag : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-primary" />
          什麼內容最能引發討論？
        </CardTitle>
        <CardDescription>標籤效果排名（按回覆率排序）</CardDescription>
      </CardHeader>
      <CardContent>
        {sortedTags.length === 0 ? (
          <div className="flex h-[180px] items-center justify-center text-muted-foreground">
            尚無已標籤的貼文
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="pb-2 text-left font-medium">標籤</th>
                    <th className="pb-2 text-right font-medium">貼文數</th>
                    <th className="pb-2 text-right font-medium">互動率</th>
                    <th className="pb-2 text-right font-medium">回覆率</th>
                    <th className="pb-2 text-right font-medium">效果</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedTags.slice(0, 5).map((tag) => {
                    const effect = getEffectRating(tag.replyRate, tag.avgEngagementRate);
                    return (
                      <tr key={tag.tagName} className="border-b last:border-0">
                        <td className="py-2"><span className="font-medium">{tag.tagName}</span></td>
                        <td className="py-2 text-right">{tag.postCount} 篇</td>
                        <td className="py-2 text-right">{tag.avgEngagementRate.toFixed(1)}%</td>
                        <td className="py-2 text-right font-medium text-primary">{tag.replyRate.toFixed(2)}%</td>
                        <td className="py-2 text-right">
                          <span className={cn(
                            "inline-flex items-center gap-1",
                            effect.stars === 3 && "text-primary",
                            effect.stars === 2 && "text-warning",
                            effect.stars <= 1 && "text-muted-foreground"
                          )}>
                            {"★".repeat(effect.stars)}{"☆".repeat(3 - effect.stars)}
                            <span className="ml-1 text-xs">{effect.label}</span>
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {suggestion && (
              <div className="mt-4 flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 p-3">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="text-sm">
                  <p className="text-foreground">
                    「{suggestion.tagName}」類內容回覆率最高，但只發了 {suggestion.postCount} 篇
                    （佔 {((suggestion.postCount / totalPosts) * 100).toFixed(0)}%）
                  </p>
                  <p className="mt-1 font-medium text-primary">
                    建議：將「{suggestion.tagName}」類內容比例提高到 30%
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

function BestTimeBlock({
  hourlyData,
  userPostingHours,
  isLoading,
}: {
  hourlyData: HourlyInteraction[];
  userPostingHours: number[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-[220px] w-full" /></CardContent>
      </Card>
    );
  }

  // 建立熱力圖數據結構（與 reach 頁面一致）
  const heatmapMap = new Map<string, number>();
  for (let day = 0; day < 7; day++) {
    for (let hour = 0; hour < 24; hour++) {
      heatmapMap.set(`${day}-${hour}`, 0);
    }
  }

  // 填充數據
  hourlyData.forEach(({ dayOfWeek, hour, interactions }) => {
    const key = `${dayOfWeek}-${hour}`;
    heatmapMap.set(key, (heatmapMap.get(key) || 0) + interactions);
  });

  // 計算最大值
  const maxInteractions = Math.max(...Array.from(heatmapMap.values()), 1);

  // 找出最佳時段
  const allSlots: { day: number; hour: number; interactions: number }[] = [];
  heatmapMap.forEach((interactions, key) => {
    const [day, hour] = key.split("-").map(Number);
    if (interactions > 0) {
      allSlots.push({ day, hour, interactions });
    }
  });
  const topSlots = [...allSlots].sort((a, b) => b.interactions - a.interactions).slice(0, 3);
  const avgInteractions = allSlots.length > 0
    ? allSlots.reduce((sum, s) => sum + s.interactions, 0) / allSlots.length
    : 0;
  const bestHours = topSlots.map((s) => s.hour);
  const isTimeMatching = userPostingHours.some((h) => bestHours.includes(h));

  const hasData = allSlots.length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="size-5 text-primary" />
          什麼時候發文最好？
        </CardTitle>
        <CardDescription>顏色越深表示該時段互動越多</CardDescription>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
            沒有足夠的互動數據
          </div>
        ) : (
          <div className="space-y-3">
            {/* 熱力圖（與 reach 頁面一致） */}
            <div className="overflow-visible">
              <div className="min-w-[320px]">
                {/* 時段標題（只顯示部分小時以避免太擁擠） */}
                <div className="mb-1.5 flex">
                  <div className="w-10" /> {/* 空白對齊 */}
                  {HOUR_LABELS_24.map((hour) => (
                    <div
                      key={hour}
                      className="flex-1 text-center text-xs text-muted-foreground"
                    >
                      {hour % 6 === 0 ? hour : ""}
                    </div>
                  ))}
                </div>

                {/* 熱力圖格子（週一到週日順序） */}
                {[1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => (
                  <div key={dayOfWeek} className="mb-1 flex items-center">
                    <div className="w-10 text-xs text-muted-foreground">
                      {WEEKDAY_NAMES[dayOfWeek]}
                    </div>
                    {HOUR_LABELS_24.map((hour) => {
                      const interactions = heatmapMap.get(`${dayOfWeek}-${hour}`) || 0;

                      return (
                        <div
                          key={hour}
                          className="group relative flex-1 p-px"
                        >
                          <div
                            className={cn(
                              "aspect-square rounded-sm transition-transform hover:scale-125 hover:z-10",
                              getHeatmapColor(interactions, maxInteractions)
                            )}
                          />
                          {/* Tooltip */}
                          <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 rounded border bg-background px-3 py-2 shadow-lg group-hover:block">
                            <div className="whitespace-nowrap text-sm font-medium">
                              {WEEKDAY_NAMES[dayOfWeek]} {hour}:00
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {formatNumber(interactions)} 互動
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* 圖例（與 reach 頁面一致） */}
            <div className="flex items-center justify-end gap-2">
              <span className="text-xs text-muted-foreground">低</span>
              <div className="flex gap-1">
                <div className="size-4 rounded-sm bg-muted" />
                <div className="size-4 rounded-sm bg-primary/20" />
                <div className="size-4 rounded-sm bg-primary/40" />
                <div className="size-4 rounded-sm bg-primary/70" />
                <div className="size-4 rounded-sm bg-primary" />
              </div>
              <span className="text-xs text-muted-foreground">高</span>
            </div>

            {/* 最佳時段列表 */}
            {topSlots.length > 0 && (
              <div className="rounded-lg border p-3">
                <p className="mb-2 text-sm font-medium">最佳發文時段</p>
                <div className="space-y-1">
                  {topSlots.map((slot, index) => {
                    const improvement = avgInteractions > 0
                      ? ((slot.interactions - avgInteractions) / avgInteractions) * 100
                      : 0;
                    return (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span>{index + 1}. {WEEKDAY_NAMES[slot.day]} {slot.hour}:00-{slot.hour + 1}:00</span>
                        <span className="font-medium text-primary">+{improvement.toFixed(0)}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 建議提示 */}
            {!isTimeMatching && topSlots.length > 0 && (
              <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3">
                <Lightbulb className="mt-0.5 size-4 shrink-0 text-warning" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">你通常在非活躍時段發文</p>
                  <p className="mt-1 text-muted-foreground">
                    建議：將發文時間調整到 {WEEKDAY_NAMES[topSlots[0].day]} {topSlots[0].hour}:00 左右
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TopPostAnalysisBlock({
  post,
  avgEngagementRate,
  avgReplyRate,
  bestTimeSlots,
  tagStats,
  isLoading,
}: {
  post: TopPost | null;
  avgEngagementRate: number;
  avgReplyRate: number;
  bestTimeSlots: { day: number; hour: number }[];
  tagStats: TagStats[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
        <CardContent><Skeleton className="h-[220px] w-full" /></CardContent>
      </Card>
    );
  }

  if (!post) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-warning" />
            最佳貼文解剖
          </CardTitle>
          <CardDescription>為什麼這篇表現特別好？</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            尚無貼文資料
          </div>
        </CardContent>
      </Card>
    );
  }

  const engagementMultiplier = avgEngagementRate > 0 ? post.engagementRate / avgEngagementRate : 0;
  const replyMultiplier = avgReplyRate > 0 ? post.replyRate / avgReplyRate : 0;

  const factors: { label: string; reason: string; isSuccess: boolean }[] = [];

  const isQuestionPost = post.text.includes("？") || post.text.includes("?");
  if (isQuestionPost) {
    const questionTagStats = tagStats.find((t) => t.tagName.includes("提問") || t.tagName.includes("問題"));
    factors.push({
      label: "問題式開頭",
      reason: questionTagStats ? `你的問題式貼文回覆率是 ${(questionTagStats.replyRate / avgReplyRate).toFixed(1)} 倍` : "問題容易引發回覆",
      isSuccess: true,
    });
  }

  const postDate = new Date(post.publishedAt);
  const postDay = postDate.getDay();
  const postHour = postDate.getHours();
  const isInBestTime = bestTimeSlots.some((s) => s.day === postDay && Math.abs(s.hour - postHour) <= 1);
  factors.push({
    label: `發文時間 ${postHour}:${postDate.getMinutes().toString().padStart(2, "0")}`,
    reason: isInBestTime ? "落在粉絲活躍時段" : "不在最佳時段但仍有不錯表現",
    isSuccess: isInBestTime,
  });

  const lengthLabel = post.textLength < 50 ? "短" : post.textLength < 150 ? "適中" : "長";
  const isOptimalLength = post.textLength >= 50 && post.textLength <= 150;
  factors.push({
    label: `${lengthLabel}長度 (${post.textLength}字)`,
    reason: isOptimalLength ? "不會太長讓人不想看" : post.textLength < 50 ? "簡短有力" : "內容豐富",
    isSuccess: isOptimalLength,
  });

  if (post.hasMedia) {
    factors.push({ label: "包含媒體", reason: "圖片/影片增加吸引力", isSuccess: true });
  }

  const suggestions: string[] = [];
  if (isQuestionPost) suggestions.push("問題式貼文");
  if (isInBestTime) suggestions.push(`週${DAY_NAMES[postDay]}晚上發文`);
  if (post.tags.length > 0) suggestions.push(post.tags[0]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-5 text-warning" />
          最佳貼文解剖
        </CardTitle>
        <CardDescription>為什麼這篇表現特別好？</CardDescription>
      </CardHeader>
      <CardContent>
        <Link href={`/posts/${post.id}`} className="block rounded-lg border p-3 hover:bg-muted/50 transition-colors">
          <p className="text-sm line-clamp-2">{post.text || "（無文字）"}</p>
          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
            <span>
              互動率 <span className="font-medium text-primary">{post.engagementRate.toFixed(1)}%</span>
              （平均的 {engagementMultiplier.toFixed(1)} 倍）
            </span>
            {replyMultiplier > 1 && (
              <span>
                回覆率 <span className="font-medium text-warning">{post.replyRate.toFixed(2)}%</span>
                （平均的 {replyMultiplier.toFixed(1)} 倍）
              </span>
            )}
          </div>
        </Link>

        <div className="mt-4">
          <p className="mb-2 text-sm font-medium">成功因素分析</p>
          <div className="space-y-2 rounded-lg border p-3">
            {factors.map((factor, index) => (
              <div key={index} className="flex items-start gap-2 text-sm">
                {factor.isSuccess ? (
                  <CheckCircle2 className="mt-0.5 size-4 text-success" />
                ) : (
                  <AlertCircle className="mt-0.5 size-4 text-muted-foreground" />
                )}
                <div>
                  <span className="font-medium">{factor.label}</span>
                  <span className="ml-2 text-muted-foreground">{factor.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {suggestions.length > 0 && (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/10 p-3">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
            <div className="text-sm">
              <p className="font-medium text-foreground">可複製的做法</p>
              <p className="mt-1 text-muted-foreground">{suggestions.join("，搭配")}</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActionSuggestionsBlock({
  suggestions,
  isLoading,
}: {
  suggestions: ActionSuggestion[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-5 w-32" /></CardHeader>
        <CardContent><Skeleton className="h-[280px] w-full" /></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="size-5 text-primary" />
          行動建議
        </CardTitle>
        <CardDescription>我現在應該做什麼？</CardDescription>
      </CardHeader>
      <CardContent>
        {suggestions.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            數據不足，無法生成建議
          </div>
        ) : (
          <div className="space-y-4">
            {suggestions.map((suggestion, index) => (
              <div key={index} className="rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{index + 1}. {suggestion.title}</h4>
                  <Badge
                    variant="outline"
                    className={cn(
                      suggestion.priority === "high" && "border-destructive/30 bg-destructive/10 text-destructive",
                      suggestion.priority === "medium" && "border-warning/30 bg-warning/10 text-warning",
                      suggestion.priority === "low" && "border-muted text-muted-foreground"
                    )}
                  >
                    優先級 {suggestion.priority === "high" ? "高" : suggestion.priority === "medium" ? "中" : "低"}
                  </Badge>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{suggestion.reason}</p>
                <p className="mt-1 text-sm">{suggestion.action}</p>
                {suggestion.example && (
                  <p className="mt-2 text-xs text-primary">範例：{suggestion.example}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export default function EngagementPage() {
  const { selectedAccountId, isLoading: isAccountLoading } = useSelectedAccount();
  const [period, setPeriod] = useState<Period>("week");
  const [offset, setOffset] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("report");
  const [isLoading, setIsLoading] = useState(true);
  const [hasNoAccounts, setHasNoAccounts] = useState(false);

  // Post detail panel
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // Data states
  const [engagementData, setEngagementData] = useState<EngagementData | null>(null);
  const [previousEngagementData, setPreviousEngagementData] = useState<EngagementData | null>(null);
  const [tagStats, setTagStats] = useState<TagStats[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyInteraction[]>([]);
  const [userPostingHours, setUserPostingHours] = useState<number[]>([]);
  const [topPost, setTopPost] = useState<TopPost | null>(null);
  const [allPosts, setAllPosts] = useState<TopPost[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [compositionData, setCompositionData] = useState<CompositionData[]>([]);

  const periodLabel = period === "week" ? "上週" : "上月";

  // Computed values for insights
  const avgEngagementRate = useMemo(() => {
    if (allPosts.length === 0) return 0;
    return allPosts.reduce((sum, p) => sum + p.engagementRate, 0) / allPosts.length;
  }, [allPosts]);

  const avgReplyRate = useMemo(() => {
    if (allPosts.length === 0) return 0;
    return allPosts.reduce((sum, p) => sum + p.replyRate, 0) / allPosts.length;
  }, [allPosts]);

  const bestTimeSlots = useMemo(() => {
    const slots: { day: number; hour: number; interactions: number }[] = [];
    hourlyData.forEach(({ dayOfWeek, hour, interactions }) => {
      slots.push({ day: dayOfWeek, hour, interactions });
    });
    return slots.sort((a, b) => b.interactions - a.interactions).slice(0, 3);
  }, [hourlyData]);

  const actionSuggestions = useMemo((): ActionSuggestion[] => {
    const suggestions: ActionSuggestion[] = [];

    const bestTag = [...tagStats].sort((a, b) => b.replyRate - a.replyRate)[0];
    if (bestTag && bestTag.postCount / Math.max(allPosts.length, 1) < 0.3) {
      const multiplier = avgReplyRate > 0 ? (bestTag.replyRate / avgReplyRate).toFixed(1) : "N/A";
      suggestions.push({
        title: `增加「${bestTag.tagName}」類內容`,
        reason: `回覆率是其他類型的 ${multiplier} 倍`,
        action: `目前佔 ${((bestTag.postCount / Math.max(allPosts.length, 1)) * 100).toFixed(0)}%，建議提高到 30%`,
        example: bestTag.tagName.includes("提問") ? "「你們怎麼看...」「大家會選擇...嗎？」" : undefined,
        priority: "high",
      });
    }

    if (bestTimeSlots.length > 0 && userPostingHours.length > 0) {
      const bestHours = bestTimeSlots.map((s) => s.hour);
      const isMatching = userPostingHours.some((h) => bestHours.some((bh) => Math.abs(bh - h) <= 1));
      if (!isMatching) {
        const bestSlot = bestTimeSlots[0];
        suggestions.push({
          title: "調整發文時間",
          reason: `粉絲在週${DAY_NAMES[bestSlot.day]} ${bestSlot.hour}:00 最活躍`,
          action: `建議在晚上 ${bestSlot.hour}:00 左右發文`,
          priority: "medium",
        });
      }
    }

    if (engagementData) {
      const total = engagementData.totalLikes + engagementData.totalReplies +
        engagementData.totalReposts + engagementData.totalQuotes;
      const replyRatio = total > 0 ? (engagementData.totalReplies / total) * 100 : 0;
      if (replyRatio < 15) {
        suggestions.push({
          title: "提升回覆互動",
          reason: `回覆只佔總互動的 ${replyRatio.toFixed(0)}%`,
          action: "嘗試發問題式內容、主動回覆粉絲留言",
          example: "在貼文結尾加入問題，邀請讀者分享想法",
          priority: "medium",
        });
      }
    }

    if (suggestions.length < 2 && engagementData) {
      const qualityScore = calculateQualityScore(engagementData);
      if (qualityScore < 60) {
        suggestions.push({
          title: "提升內容多樣性",
          reason: `互動品質分數 ${qualityScore} 分，仍有提升空間`,
          action: "嘗試不同類型的內容，觀察哪種最能引發討論",
          priority: "low",
        });
      }
    }

    return suggestions.slice(0, 3);
  }, [tagStats, allPosts, bestTimeSlots, userPostingHours, engagementData, avgReplyRate]);

  // Growth calculations for report tab
  const interactionsGrowth = useMemo(() => {
    if (!engagementData || !previousEngagementData) return 0;
    const current = engagementData.totalLikes + engagementData.totalReplies +
      engagementData.totalReposts + engagementData.totalQuotes;
    const previous = previousEngagementData.totalLikes + previousEngagementData.totalReplies +
      previousEngagementData.totalReposts + previousEngagementData.totalQuotes;
    return calcGrowth(current, previous);
  }, [engagementData, previousEngagementData]);

  const engagementRateGrowth = useMemo(() => {
    if (!engagementData || !previousEngagementData) return 0;
    const current = engagementData.totalViews > 0
      ? ((engagementData.totalLikes + engagementData.totalReplies +
        engagementData.totalReposts + engagementData.totalQuotes) / engagementData.totalViews) * 100
      : 0;
    const previous = previousEngagementData.totalViews > 0
      ? ((previousEngagementData.totalLikes + previousEngagementData.totalReplies +
        previousEngagementData.totalReposts + previousEngagementData.totalQuotes) / previousEngagementData.totalViews) * 100
      : 0;
    return calcGrowth(current, previous);
  }, [engagementData, previousEngagementData]);

  useEffect(() => {
    if (isAccountLoading) return;

    async function loadData() {
      setIsLoading(true);
      const supabase = createClient();

      if (!selectedAccountId) {
        const workspaceId = localStorage.getItem("currentWorkspaceId");
        if (!workspaceId) {
          setIsLoading(false);
          setHasNoAccounts(true);
          return;
        }

        const { data: accounts } = await supabase
          .from("workspace_threads_accounts")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true)
          .limit(1);

        if (!accounts || accounts.length === 0) {
          setIsLoading(false);
          setHasNoAccounts(true);
          return;
        }

        localStorage.setItem("currentThreadsAccountId", accounts[0].id);
        window.dispatchEvent(new Event("storage"));
        return;
      }

      try {
        // 使用 getDateRange 確保與曝光分析頁面日期區間一致
        const currentRange = getDateRange(period, offset);
        const previousRange = getDateRange(period, offset - 1);

        const currentStart = currentRange.start;
        const currentEnd = currentRange.end;
        const previousStart = previousRange.start;
        const previousEnd = previousRange.end;

        // Fetch current period posts
        // 使用 getEndOfDay 確保包含當天所有資料
        const { data: posts } = await supabase
          .from("workspace_threads_posts")
          .select(
            "id, text, published_at, current_views, current_likes, current_replies, current_reposts, current_quotes, engagement_rate, ai_selected_tags, media_type"
          )
          .eq("workspace_threads_account_id", selectedAccountId)
          .gte("published_at", currentStart.toISOString())
          .lte("published_at", getEndOfDay(currentEnd).toISOString());

        const postsData = posts || [];

        // Fetch previous period posts for comparison
        const { data: previousPosts } = await supabase
          .from("workspace_threads_posts")
          .select("current_views, current_likes, current_replies, current_reposts, current_quotes")
          .eq("workspace_threads_account_id", selectedAccountId)
          .gte("published_at", previousStart.toISOString())
          .lte("published_at", getEndOfDay(previousEnd).toISOString());

        const previousPostsData = previousPosts || [];

        // Fetch tags
        const { data: tags } = await supabase
          .from("workspace_threads_account_tags")
          .select("id, name, color")
          .eq("workspace_threads_account_id", selectedAccountId);

        // Calculate current engagement data
        const totalLikes = postsData.reduce((sum, p) => sum + (p.current_likes || 0), 0);
        const totalReplies = postsData.reduce((sum, p) => sum + (p.current_replies || 0), 0);
        const totalReposts = postsData.reduce((sum, p) => sum + (p.current_reposts || 0), 0);
        const totalQuotes = postsData.reduce((sum, p) => sum + (p.current_quotes || 0), 0);
        const totalViews = postsData.reduce((sum, p) => sum + (p.current_views || 0), 0);

        setEngagementData({
          totalLikes,
          totalReplies,
          totalReposts,
          totalQuotes,
          totalViews,
          postsCount: postsData.length,
        });

        // Calculate previous engagement data
        const prevTotalLikes = previousPostsData.reduce((sum, p) => sum + (p.current_likes || 0), 0);
        const prevTotalReplies = previousPostsData.reduce((sum, p) => sum + (p.current_replies || 0), 0);
        const prevTotalReposts = previousPostsData.reduce((sum, p) => sum + (p.current_reposts || 0), 0);
        const prevTotalQuotes = previousPostsData.reduce((sum, p) => sum + (p.current_quotes || 0), 0);
        const prevTotalViews = previousPostsData.reduce((sum, p) => sum + (p.current_views || 0), 0);

        setPreviousEngagementData({
          totalLikes: prevTotalLikes,
          totalReplies: prevTotalReplies,
          totalReposts: prevTotalReposts,
          totalQuotes: prevTotalQuotes,
          totalViews: prevTotalViews,
          postsCount: previousPostsData.length,
        });

        // Calculate composition data for pie chart
        const total = totalLikes + totalReplies + totalReposts + totalQuotes;
        setCompositionData([
          { type: "likes", label: "讚", value: totalLikes, fill: INTERACTION_COLORS.likes, percentage: total > 0 ? (totalLikes / total) * 100 : 0 },
          { type: "replies", label: "回覆", value: totalReplies, fill: INTERACTION_COLORS.replies, percentage: total > 0 ? (totalReplies / total) * 100 : 0 },
          { type: "reposts", label: "轉發", value: totalReposts, fill: INTERACTION_COLORS.reposts, percentage: total > 0 ? (totalReposts / total) * 100 : 0 },
          { type: "quotes", label: "引用", value: totalQuotes, fill: INTERACTION_COLORS.quotes, percentage: total > 0 ? (totalQuotes / total) * 100 : 0 },
        ]);

        // Calculate tag statistics
        const tagStatsMap: Record<string, {
          tagName: string;
          postCount: number;
          totalViews: number;
          totalReplies: number;
          totalInteractions: number;
          totalEngagement: number;
        }> = {};

        postsData.forEach((post) => {
          const selectedTags = post.ai_selected_tags as Record<string, string[]> | null;
          if (!selectedTags) return;

          for (const dimension of Object.keys(selectedTags)) {
            const tagNames = selectedTags[dimension] || [];
            for (const tagName of tagNames) {
              if (!tagStatsMap[tagName]) {
                tagStatsMap[tagName] = {
                  tagName,
                  postCount: 0,
                  totalViews: 0,
                  totalReplies: 0,
                  totalInteractions: 0,
                  totalEngagement: 0,
                };
              }
              tagStatsMap[tagName].postCount += 1;
              tagStatsMap[tagName].totalViews += post.current_views || 0;
              tagStatsMap[tagName].totalReplies += post.current_replies || 0;
              tagStatsMap[tagName].totalInteractions +=
                (post.current_likes || 0) + (post.current_replies || 0) +
                (post.current_reposts || 0) + (post.current_quotes || 0);
              tagStatsMap[tagName].totalEngagement += post.engagement_rate || 0;
            }
          }
        });

        setTagStats(
          Object.values(tagStatsMap).map((t) => ({
            ...t,
            avgEngagementRate: t.postCount > 0 ? t.totalEngagement / t.postCount : 0,
            replyRate: t.totalViews > 0 ? (t.totalReplies / t.totalViews) * 100 : 0,
          }))
        );

        // Fetch hourly metrics for time analysis
        // 使用 getEndOfDay 確保包含當天所有資料
        const postIds = postsData.map((p) => p.id);
        if (postIds.length > 0) {
          const { data: hourlyMetrics } = await supabase
            .from("workspace_threads_post_metrics_hourly")
            .select("workspace_threads_post_id, bucket_ts, likes, replies, reposts, quotes")
            .in("workspace_threads_post_id", postIds)
            .gte("bucket_ts", currentStart.toISOString())
            .lte("bucket_ts", getEndOfDay(currentEnd).toISOString())
            .order("bucket_ts", { ascending: true })
            .limit(10000);

          // Calculate hourly interaction deltas
          const hourlyMap: Record<string, number> = {};
          type HourlyMetric = {
            workspace_threads_post_id: string;
            bucket_ts: string;
            likes: number | null;
            replies: number | null;
            reposts: number | null;
            quotes: number | null;
          };
          const metricsByPost: Record<string, HourlyMetric[]> = {};

          (hourlyMetrics || []).forEach((m) => {
            if (!metricsByPost[m.workspace_threads_post_id]) {
              metricsByPost[m.workspace_threads_post_id] = [];
            }
            metricsByPost[m.workspace_threads_post_id].push(m as HourlyMetric);
          });

          for (const [, metrics] of Object.entries(metricsByPost)) {
            metrics.sort((a, b) => new Date(a.bucket_ts).getTime() - new Date(b.bucket_ts).getTime());

            for (let i = 0; i < metrics.length; i++) {
              const m = metrics[i];
              const prevM = i > 0 ? metrics[i - 1] : null;
              const bucketDate = new Date(m.bucket_ts);
              const dayOfWeek = bucketDate.getDay();
              const hour = bucketDate.getHours();
              const key = `${dayOfWeek}-${hour}`;

              const deltaLikes = prevM ? Math.max(0, (m.likes || 0) - (prevM.likes || 0)) : m.likes || 0;
              const deltaReplies = prevM ? Math.max(0, (m.replies || 0) - (prevM.replies || 0)) : m.replies || 0;
              const deltaReposts = prevM ? Math.max(0, (m.reposts || 0) - (prevM.reposts || 0)) : m.reposts || 0;
              const deltaQuotes = prevM ? Math.max(0, (m.quotes || 0) - (prevM.quotes || 0)) : m.quotes || 0;

              const delta = deltaLikes + deltaReplies + deltaReposts + deltaQuotes;
              hourlyMap[key] = (hourlyMap[key] || 0) + delta;
            }
          }

          setHourlyData(
            Object.entries(hourlyMap).map(([key, interactions]) => {
              const [day, hour] = key.split("-").map(Number);
              return { dayOfWeek: day, hour, interactions };
            })
          );

          // Build trend data for report chart
          // 計算實際天數（本週只到今天，過去的週是完整 7 天）
          const trendMap: Record<string, TrendDataPoint> = {};
          const dayCount = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;

          if (period === "week") {
            for (let d = 0; d < dayCount; d++) {
              const dayDate = new Date(currentStart.getTime() + d * 24 * 60 * 60 * 1000);
              if (dayDate > currentEnd) break;
              const key = `${d}`;
              trendMap[key] = {
                timestamp: dayDate.getTime(),
                label: `${dayDate.getMonth() + 1}/${dayDate.getDate()}`,
                totalInteractions: 0,
                engagementRate: 0,
                likes: 0,
                replies: 0,
                reposts: 0,
                quotes: 0,
              };
            }

            for (const [, metrics] of Object.entries(metricsByPost)) {
              for (let i = 0; i < metrics.length; i++) {
                const m = metrics[i];
                const prevM = i > 0 ? metrics[i - 1] : null;
                const bucketDate = new Date(m.bucket_ts);
                if (bucketDate.getTime() < currentStart.getTime()) continue;
                if (bucketDate.getTime() > getEndOfDay(currentEnd).getTime()) continue;

                const dayDiff = Math.floor((bucketDate.getTime() - currentStart.getTime()) / (24 * 60 * 60 * 1000));
                const key = `${dayDiff}`;
                if (!trendMap[key]) continue;

                const deltaLikes = prevM ? Math.max(0, (m.likes || 0) - (prevM.likes || 0)) : m.likes || 0;
                const deltaReplies = prevM ? Math.max(0, (m.replies || 0) - (prevM.replies || 0)) : m.replies || 0;
                const deltaReposts = prevM ? Math.max(0, (m.reposts || 0) - (prevM.reposts || 0)) : m.reposts || 0;
                const deltaQuotes = prevM ? Math.max(0, (m.quotes || 0) - (prevM.quotes || 0)) : m.quotes || 0;

                trendMap[key].likes += deltaLikes;
                trendMap[key].replies += deltaReplies;
                trendMap[key].reposts += deltaReposts;
                trendMap[key].quotes += deltaQuotes;
                trendMap[key].totalInteractions += deltaLikes + deltaReplies + deltaReposts + deltaQuotes;
              }
            }
          } else {
            // 月報表：計算實際天數（本月只到今天，過去的月是完整天數）
            const actualDays = Math.ceil((currentEnd.getTime() - currentStart.getTime()) / (24 * 60 * 60 * 1000)) + 1;
            for (let d = 0; d < actualDays; d++) {
              const dayDate = new Date(currentStart.getTime() + d * 24 * 60 * 60 * 1000);
              if (dayDate > currentEnd) break;
              const key = `${d}`;
              trendMap[key] = {
                timestamp: dayDate.getTime(),
                label: `${dayDate.getDate()}`,
                totalInteractions: 0,
                engagementRate: 0,
                likes: 0,
                replies: 0,
                reposts: 0,
                quotes: 0,
              };
            }

            // 填入月報表的趨勢資料
            for (const [, metrics] of Object.entries(metricsByPost)) {
              for (let i = 0; i < metrics.length; i++) {
                const m = metrics[i];
                const prevM = i > 0 ? metrics[i - 1] : null;
                const bucketDate = new Date(m.bucket_ts);
                if (bucketDate.getTime() < currentStart.getTime()) continue;
                if (bucketDate.getTime() > getEndOfDay(currentEnd).getTime()) continue;

                const dayDiff = Math.floor((bucketDate.getTime() - currentStart.getTime()) / (24 * 60 * 60 * 1000));
                const key = `${dayDiff}`;
                if (!trendMap[key]) continue;

                const deltaLikes = prevM ? Math.max(0, (m.likes || 0) - (prevM.likes || 0)) : m.likes || 0;
                const deltaReplies = prevM ? Math.max(0, (m.replies || 0) - (prevM.replies || 0)) : m.replies || 0;
                const deltaReposts = prevM ? Math.max(0, (m.reposts || 0) - (prevM.reposts || 0)) : m.reposts || 0;
                const deltaQuotes = prevM ? Math.max(0, (m.quotes || 0) - (prevM.quotes || 0)) : m.quotes || 0;

                trendMap[key].likes += deltaLikes;
                trendMap[key].replies += deltaReplies;
                trendMap[key].reposts += deltaReposts;
                trendMap[key].quotes += deltaQuotes;
                trendMap[key].totalInteractions += deltaLikes + deltaReplies + deltaReposts + deltaQuotes;
              }
            }
          }

          // Calculate engagement rate for trend
          const avgViewsPerPoint = totalViews / Math.max(Object.keys(trendMap).length, 1);
          const trendArray = Object.values(trendMap)
            .map((point) => ({
              ...point,
              engagementRate: avgViewsPerPoint > 0 ? (point.totalInteractions / avgViewsPerPoint) * 100 : 0,
            }))
            .sort((a, b) => a.timestamp - b.timestamp);
          setTrendData(trendArray);
        } else {
          setHourlyData([]);
          setTrendData([]);
        }

        // Analyze user posting hours
        const postingHours = postsData.map((p) => new Date(p.published_at).getHours());
        setUserPostingHours([...new Set(postingHours)]);

        // Process all posts data
        const allPostsData: TopPost[] = postsData.map((p) => ({
          id: p.id,
          text: p.text || "",
          publishedAt: p.published_at || "",
          views: p.current_views || 0,
          likes: p.current_likes || 0,
          replies: p.current_replies || 0,
          reposts: p.current_reposts || 0,
          quotes: p.current_quotes || 0,
          engagementRate: p.engagement_rate || 0,
          replyRate: (p.current_views || 0) > 0
            ? ((p.current_replies || 0) / (p.current_views || 1)) * 100
            : 0,
          textLength: (p.text || "").length,
          hasMedia: !!p.media_type && p.media_type !== "TEXT",
          tags: Object.values(p.ai_selected_tags || {}).flat() as string[],
        }));

        setAllPosts(allPostsData);

        // Find top post
        const sortedPosts = [...allPostsData].sort((a, b) => b.engagementRate - a.engagementRate);
        setTopPost(sortedPosts[0] || null);
      } catch (error) {
        console.error("[Engagement] Error loading data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [selectedAccountId, isAccountLoading, period, offset]);

  const totalInteractions = engagementData
    ? engagementData.totalLikes + engagementData.totalReplies + engagementData.totalReposts + engagementData.totalQuotes
    : 0;

  const avgEngagementRateKPI = engagementData && engagementData.totalViews > 0
    ? (totalInteractions / engagementData.totalViews) * 100
    : 0;

  return (
    <div className="space-y-6">
      {/* Header - 與 reach 頁面一致 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">互動分析</h1>
          <p className="text-muted-foreground">
            深入了解粉絲互動品質與最佳發文策略
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* 週/月切換 */}
          <Tabs value={period} onValueChange={(v) => { setPeriod(v as Period); setOffset(0); }}>
            <TabsList>
              <TabsTrigger value="week">週</TabsTrigger>
              <TabsTrigger value="month">月</TabsTrigger>
            </TabsList>
          </Tabs>
          {/* 左右箭頭導航 */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setOffset(offset - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="min-w-[80px] text-center text-sm font-medium">
              {getDateRange(period, offset).label}
            </div>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              onClick={() => setOffset(offset + 1)}
              disabled={offset >= 0}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* View Mode Tabs - 報告/洞察切換 */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
        <TabsList className="h-10 border bg-muted/50 p-1">
          <TabsTrigger value="report" className="h-8 px-4 data-[state=active]:bg-background data-[state=active]:shadow">
            <BarChart3 className="mr-1.5 size-4" />
            報告
          </TabsTrigger>
          <TabsTrigger value="insights" className="h-8 px-4 data-[state=active]:bg-background data-[state=active]:shadow">
            <Lightbulb className="mr-1.5 size-4" />
            洞察
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* No Accounts Warning */}
      {hasNoAccounts && !isLoading && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            尚未連結任何 Threads 帳號，請先至設定頁面連結帳號。
          </p>
        </div>
      )}

      {/* Main Content */}
      {!hasNoAccounts && (
        <>
          {/* Report Tab */}
          {viewMode === "report" && (
            <div className="space-y-6">
              {/* KPI Cards */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <KPICard
                  title="總互動數"
                  value={totalInteractions}
                  growth={interactionsGrowth}
                  icon={<Heart className="size-4" />}
                  isLoading={isLoading}
                  periodLabel={periodLabel}
                />
                <KPICard
                  title="平均互動率"
                  value={avgEngagementRateKPI}
                  growth={engagementRateGrowth}
                  icon={<Activity className="size-4" />}
                  isLoading={isLoading}
                  format="percent"
                  periodLabel={periodLabel}
                />
                <KPICard
                  title="回覆數"
                  value={engagementData?.totalReplies || 0}
                  growth={previousEngagementData ? calcGrowth(engagementData?.totalReplies || 0, previousEngagementData.totalReplies) : undefined}
                  icon={<MessageSquare className="size-4" />}
                  isLoading={isLoading}
                  periodLabel={periodLabel}
                />
                <KPICard
                  title="貼文數"
                  value={engagementData?.postsCount || 0}
                  icon={<FileText className="size-4" />}
                  isLoading={isLoading}
                  periodLabel={periodLabel}
                />
              </div>

              {/* Trend Chart */}
              <EngagementTrendChart
                data={trendData}
                isLoading={isLoading}
                period={period}
                offset={offset}
                totalInteractions={totalInteractions}
                interactionsGrowth={interactionsGrowth}
              />

              {/* Composition & Tag Charts */}
              <div className="grid gap-4 lg:grid-cols-2">
                <CompositionPieChart
                  data={compositionData}
                  isLoading={isLoading}
                />
                <TagEngagementChart
                  data={tagStats}
                  isLoading={isLoading}
                />
              </div>

              {/* 最佳發文時段熱力圖 */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="size-5" />
                    最佳發文時段
                  </CardTitle>
                  <CardDescription>
                    顏色越深表示該時段互動越多
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isLoading ? (
                    <Skeleton className="h-[180px] w-full" />
                  ) : (() => {
                    // 建立熱力圖數據
                    const heatmapMap = new Map<string, number>();
                    for (let day = 0; day < 7; day++) {
                      for (let hour = 0; hour < 24; hour++) {
                        heatmapMap.set(`${day}-${hour}`, 0);
                      }
                    }
                    hourlyData.forEach(({ dayOfWeek, hour, interactions }) => {
                      const key = `${dayOfWeek}-${hour}`;
                      heatmapMap.set(key, (heatmapMap.get(key) || 0) + interactions);
                    });
                    const maxInteractions = Math.max(...Array.from(heatmapMap.values()), 1);
                    const hasData = hourlyData.length > 0;

                    if (!hasData) {
                      return (
                        <div className="flex h-[180px] items-center justify-center text-sm text-muted-foreground">
                          沒有足夠的互動數據
                        </div>
                      );
                    }

                    return (
                      <div className="space-y-3">
                        {/* 熱力圖 */}
                        <div className="overflow-visible">
                          <div className="min-w-[320px]">
                            {/* 時段標題 */}
                            <div className="mb-1.5 flex">
                              <div className="w-10" />
                              {HOUR_LABELS_24.map((hour) => (
                                <div
                                  key={hour}
                                  className="flex-1 text-center text-xs text-muted-foreground"
                                >
                                  {hour % 6 === 0 ? hour : ""}
                                </div>
                              ))}
                            </div>

                            {/* 熱力圖格子 */}
                            {[1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => (
                              <div key={dayOfWeek} className="mb-1 flex items-center">
                                <div className="w-10 text-xs text-muted-foreground">
                                  {WEEKDAY_NAMES[dayOfWeek]}
                                </div>
                                {HOUR_LABELS_24.map((hour) => {
                                  const interactions = heatmapMap.get(`${dayOfWeek}-${hour}`) || 0;

                                  return (
                                    <div
                                      key={hour}
                                      className="group relative flex-1 p-px"
                                    >
                                      <div
                                        className={cn(
                                          "aspect-square rounded-sm transition-transform hover:scale-125 hover:z-10",
                                          getHeatmapColor(interactions, maxInteractions)
                                        )}
                                      />
                                      {/* Tooltip */}
                                      <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden -translate-x-1/2 rounded border bg-background px-3 py-2 shadow-lg group-hover:block">
                                        <div className="whitespace-nowrap text-sm font-medium">
                                          {WEEKDAY_NAMES[dayOfWeek]} {hour}:00
                                        </div>
                                        <div className="text-sm text-muted-foreground">
                                          {formatNumber(interactions)} 互動
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* 圖例 */}
                        <div className="flex items-center justify-end gap-2">
                          <span className="text-xs text-muted-foreground">低</span>
                          <div className="flex gap-1">
                            <div className="size-4 rounded-sm bg-muted" />
                            <div className="size-4 rounded-sm bg-primary/20" />
                            <div className="size-4 rounded-sm bg-primary/40" />
                            <div className="size-4 rounded-sm bg-primary/70" />
                            <div className="size-4 rounded-sm bg-primary" />
                          </div>
                          <span className="text-xs text-muted-foreground">高</span>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Top/Flop 榜 */}
              <div className="grid gap-4 md:grid-cols-2">
                <TopPostsList
                  posts={allPosts}
                  isLoading={isLoading}
                  onPostClick={(postId) => {
                    setSelectedPostId(postId);
                    setIsPanelOpen(true);
                  }}
                />
                <FlopPostsList
                  posts={allPosts}
                  isLoading={isLoading}
                  onPostClick={(postId) => {
                    setSelectedPostId(postId);
                    setIsPanelOpen(true);
                  }}
                />
              </div>
            </div>
          )}

          {/* Insights Tab */}
          {viewMode === "insights" && (
            <div className="space-y-6">
              {/* Block 1: Quality Score */}
              <QualityScoreBlock data={engagementData} isLoading={isLoading} />

              {/* Block 2 & 3: Content Effect & Best Time */}
              <div className="grid gap-6 lg:grid-cols-2">
                <ContentEffectBlock
                  tagStats={tagStats}
                  totalPosts={allPosts.length}
                  isLoading={isLoading}
                />
                <BestTimeBlock
                  hourlyData={hourlyData}
                  userPostingHours={userPostingHours}
                  isLoading={isLoading}
                />
              </div>

              {/* Block 4 & 5: Top Post Analysis & Action Suggestions */}
              <div className="grid gap-6 lg:grid-cols-2">
                <TopPostAnalysisBlock
                  post={topPost}
                  avgEngagementRate={avgEngagementRate}
                  avgReplyRate={avgReplyRate}
                  bestTimeSlots={bestTimeSlots}
                  tagStats={tagStats}
                  isLoading={isLoading}
                />
                <ActionSuggestionsBlock
                  suggestions={actionSuggestions}
                  isLoading={isLoading}
                />
              </div>
            </div>
          )}
        </>
      )}

      {/* 貼文詳情 Panel */}
      <PostDetailPanel
        open={isPanelOpen}
        onOpenChange={setIsPanelOpen}
        postId={selectedPostId}
        selectedAccountId={selectedAccountId}
      />
    </div>
  );
}
