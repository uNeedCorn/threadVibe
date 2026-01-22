"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Eye,
  Heart,
  MessageSquare,
  Repeat2,
  Quote,
  RefreshCw,
  Flame,
  Star,
  Zap,
  Clock,
  TrendingUp,
  TrendingDown,
  Filter,
  ArrowUpDown,
  Rocket,
  Sparkles,
  Lightbulb,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  ScatterChart,
  Scatter,
  Cell,
  ReferenceLine,
  XAxis,
  YAxis,
  ZAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useSelectedAccount } from "@/hooks/use-selected-account";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  CHART_COLORS_EXTENDED,
  SEMANTIC_COLORS,
  STONE,
  ACCENT,
  VIRALITY_COLORS,
  getChartColor,
  getHeatmapIntensityColor,
} from "@/lib/design-tokens";

// ============ Types ============

type TimeStatus = "golden" | "early" | "tracking";
type ViralityLevel = "viral" | "excellent" | "good" | "normal";
type HeatType = "early" | "slow" | "steady";
type DiffusionStatus = "accelerating" | "stable" | "decelerating";
type SortOption = "latest" | "virality" | "engagement" | "views";
type FilterOption = "all" | "golden" | "early" | "tracking" | "viral";

// 限流風險類型
type ReachRiskLevel = "safe" | "warning" | "danger";
type QuotaLevel = "healthy" | "caution" | "exhausted";

interface TrendPoint {
  timestamp: number;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  viralityScore: number;
}

// 點火曲線資料點（API 計算）
interface IgnitionDataPoint {
  timestamp: number;
  timeLabel: string;
  engagementPct: number;
  viewsPct: number;
}

// 點火曲線指標（API 計算）
interface IgnitionMetrics {
  dataPoints: IgnitionDataPoint[];
  engagementLeadScore: number;
  peakEngagementTime: string;
  peakViewsTime: string;
}

// 熱力圖單格（API 計算）
interface HeatmapCell {
  bucketIndex: number;
  viralityDelta: number;
  intensity: number;
}

// 熱力圖指標（API 計算）
interface HeatmapMetrics {
  cells: HeatmapCell[];
  heatType: HeatType;
  earlyDelta: number;
  lateDelta: number;
}

// 擴散動態指標（API 計算）
interface DiffusionMetrics {
  rHat: number;
  status: DiffusionStatus;
}

// API 回傳的貼文格式
interface ApiRadarPost {
  id: string;
  text: string;
  mediaType: string;
  mediaUrl: string | null;
  publishedAt: string;
  ageMinutes: number;
  timeStatus: TimeStatus;
  // 追蹤延遲資訊
  trackingDelayMinutes: number;
  hasEarlyData: boolean;
  // 指標
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  viralityScore: number;
  viralityLevel: ViralityLevel;
  engagementRate: number;
  repostRate: number;
  trend: TrendPoint[];
  // 獨有指標（API 計算）
  ignition: IgnitionMetrics | null;
  heatmap: HeatmapMetrics | null;
  diffusion: DiffusionMetrics | null;
  // 限流風險指標
  reachMultiple: number;
  reachRiskLevel: ReachRiskLevel;
}

// 前端使用的貼文格式
interface TrackingPost {
  id: string;
  text: string;
  mediaType: string;
  thumbnailUrl: string | null;
  publishedAt: Date;
  // 追蹤延遲資訊
  trackingDelayMinutes: number;
  hasEarlyData: boolean;
  // 指標
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  viralityScore: number;
  viralityLevel: ViralityLevel;
  engagementRate: number;
  repostRate: number;
  ageMinutes: number;
  timeStatus: TimeStatus;
  trend: TrendPoint[];
  // 獨有指標（API 計算）
  ignition: IgnitionMetrics | null;
  heatmap: HeatmapMetrics | null;
  diffusion: DiffusionMetrics | null;
  // 限流風險指標
  reachMultiple: number;
  reachRiskLevel: ReachRiskLevel;
}

interface TrackingSummary {
  totalPosts: number;
  goldenPosts: number;
  earlyPosts: number;
  trackingPosts: number;
  viralPotential: number;
}

interface PageAlert {
  id: string;
  type: "viral" | "excellent" | "fast";
  postId: string;
  message: string;
}

// 限流風險指標（帳號層級）
interface ThrottleRisk {
  followersCount: number;
  threeDayTotalViews: number;
  cumulativeMultiple: number;
  quotaLevel: QuotaLevel;
  quotaPercentage: number;
}

// API 回傳格式
interface RadarApiResponse {
  posts: ApiRadarPost[];
  summary: TrackingSummary;
  alerts: Array<{
    id: string;
    type: "viral" | "excellent";
    postId: string;
    message: string;
  }>;
  throttleRisk: ThrottleRisk;
  generatedAt: string;
}

function formatNumber(v: number): string {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toLocaleString();
}

function formatRelativeTime(minutes: number): string {
  if (minutes < 1) return "剛剛";
  if (minutes < 60) return `${Math.floor(minutes)} 分鐘前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} 小時前`;
  const days = Math.floor(hours / 24);
  return `${days} 天前`;
}

// ============ Components ============

// 簡化標籤配置（v2 新增）
const VIRALITY_CONFIG = {
  viral: {
    label: "爆紅中",
    percentile: "前 1%",
    description: "正在病毒式傳播！",
    className: "bg-destructive text-white",
    icon: Flame,
  },
  excellent: {
    label: "表現優異",
    percentile: "前 10%",
    description: "超越 90% 的貼文",
    className: "bg-warning text-white",
    icon: Star,
  },
  good: {
    label: "表現良好",
    percentile: "前 50%",
    description: "優於平均水準",
    className: "bg-primary text-white",
    icon: TrendingUp,
  },
  normal: {
    label: "正常發揮",
    percentile: "平均",
    description: "穩定累積中",
    className: "bg-muted text-muted-foreground",
    icon: null,
  },
};

function ViralityBadge({
  score,
  level,
  showPercentile = false,
}: {
  score: number;
  level: ViralityLevel;
  showPercentile?: boolean;
}) {
  const config = VIRALITY_CONFIG[level];
  const { label, percentile, className, icon: Icon } = config;

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="size-4" style={{ color: VIRALITY_COLORS[level] }} />}
        <span className="font-mono font-medium">{score.toFixed(1)}</span>
        <Badge className={cn("gap-1", className)}>
          {label}
        </Badge>
      </div>
      {showPercentile && (
        <span className="text-[10px] text-muted-foreground ml-6">
          {percentile}
        </span>
      )}
    </div>
  );
}

// 觸及倍數 Badge 配置
const REACH_RISK_CONFIG = {
  safe: {
    label: "安全",
    description: "觸及量正常，不會觸發限流",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  warning: {
    label: "注意",
    description: "接近限流閾值，建議控制發文頻率",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  danger: {
    label: "高風險",
    description: "超過 100 倍，可能已觸發限流機制",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
};

function ReachMultipleBadge({
  multiple,
  riskLevel,
}: {
  multiple: number;
  riskLevel: ReachRiskLevel;
}) {
  const config = REACH_RISK_CONFIG[riskLevel];

  return (
    <Badge
      className={cn("gap-1 font-mono", config.className)}
      title={config.description}
    >
      {multiple.toFixed(0)}x
      <span className="font-sans text-[10px]">{config.label}</span>
    </Badge>
  );
}

// 配額等級配置
const QUOTA_CONFIG = {
  healthy: {
    label: "充裕",
    description: "配額充裕，可正常發文",
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-500",
  },
  caution: {
    label: "謹慎",
    description: "配額偏高，建議減少發文頻率",
    color: "text-yellow-600 dark:text-yellow-400",
    bgColor: "bg-yellow-500",
  },
  exhausted: {
    label: "耗盡",
    description: "配額耗盡，建議冷卻 2-3 天",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-500",
  },
};

// 配額儀表組件
function ThrottleQuotaCard({
  throttleRisk,
  isLoading,
}: {
  throttleRisk: ThrottleRisk;
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4" />
            曝光配額監控
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    );
  }

  const config = QUOTA_CONFIG[throttleRisk.quotaLevel];
  const percentage = Math.min(throttleRisk.quotaPercentage, 100);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="size-4" />
          曝光配額監控
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* 進度條 */}
        <div className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">3 天累計配額</span>
            <span className={cn("font-medium", config.color)}>
              {throttleRisk.quotaPercentage}%
            </span>
          </div>
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all", config.bgColor)}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        {/* 數據 */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">累計觸及</span>
            <p className="font-mono font-medium">
              {formatNumber(throttleRisk.threeDayTotalViews)}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">觸及倍數</span>
            <p className="font-mono font-medium">
              {throttleRisk.cumulativeMultiple.toFixed(1)}x
            </p>
          </div>
        </div>

        {/* 狀態 */}
        <div className={cn("text-sm font-medium", config.color)}>
          狀態：{config.label}
          <span className="font-normal text-muted-foreground ml-2">
            (粉絲 {formatNumber(throttleRisk.followersCount)} | 閾值 250x)
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniTrendChart({ data }: { data: TrendPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="flex h-8 w-24 items-center justify-center text-xs text-muted-foreground">
        資料不足
      </div>
    );
  }

  return (
    <div className="h-8 w-24">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="views"
            stroke={ACCENT.DEFAULT}
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// 擴散動態配置（v2 增強）
const DIFFUSION_CONFIG = {
  accelerating: {
    icon: Rocket,
    label: "正在擴散",
    description: "觸及人數持續增加中",
    hint: "可考慮加碼推廣",
    className: "text-destructive",
    bgClassName: "bg-destructive/10",
  },
  stable: {
    icon: Sparkles,
    label: "穩定傳播",
    description: "保持穩定的曝光速度",
    hint: "持續觀察",
    className: "text-warning",
    bgClassName: "bg-warning/10",
  },
  decelerating: {
    icon: TrendingDown,
    label: "熱度趨緩",
    description: "已過高峰，自然衰退",
    hint: "正常現象",
    className: "text-muted-foreground",
    bgClassName: "bg-muted",
  },
};

// 擴散動態狀態圖示（v2 增強版）
function DiffusionStatusIcon({
  diffusion,
  showDescription = false,
}: {
  diffusion: DiffusionMetrics | null;
  showDescription?: boolean;
}) {
  if (!diffusion) {
    return (
      <div className="flex flex-col gap-0.5">
        <span
          className="text-muted-foreground text-xs cursor-help flex items-center gap-1"
          title="需要至少 45 分鐘的數據才能計算擴散動態"
        >
          <Clock className="size-3" />
          <span>數據累積中</span>
        </span>
        {showDescription && (
          <span className="text-[10px] text-muted-foreground/70">
            約需 45 分鐘
          </span>
        )}
      </div>
    );
  }

  const config = DIFFUSION_CONFIG[diffusion.status];
  const { icon: Icon, label, description, className } = config;

  return (
    <div className="flex flex-col gap-0.5">
      <span
        className={cn("cursor-default flex items-center gap-1 text-xs font-medium", className)}
        title={`${description} (擴散指數 ${diffusion.rHat.toFixed(2)})`}
      >
        <Icon className="size-3" />
        <span>{label}</span>
      </span>
      {showDescription && (
        <span className="text-[10px] text-muted-foreground">
          {description}
        </span>
      )}
    </div>
  );
}

// 每則貼文的 delta 趨勢資料
interface PostDeltaTrend {
  postId: string;
  postText: string;
  color: string;
  data: Array<{
    timestamp: number;
    label: string;
    views: number;
    delta: number;
  }>;
}

// 圖表用的資料點（每個時間點包含所有貼文的 delta）
interface ChartDataPoint {
  timestamp: number;
  label: string;
  [postId: string]: number | string; // 動態 key 為 postId，值為 delta
}

// 貼文顏色調色盤 - 從 design-tokens 導入
const POST_COLORS = CHART_COLORS_EXTENDED;

// 格式化時間標籤（15 分鐘精度）
function formatTimeLabel15m(timestamp: number): string {
  const date = new Date(timestamp);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  return `${month}/${day} ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
}

// 計算每則貼文的 15 分鐘 view delta
function calculatePostDeltas(posts: TrackingPost[]): {
  postTrends: PostDeltaTrend[];
  chartData: ChartDataPoint[];
  allTimestamps: number[];
} {
  // 收集所有時間戳記
  const timestampSet = new Set<number>();

  // 計算每則貼文的 delta
  const postTrends: PostDeltaTrend[] = posts
    .filter((post) => post.trend.length >= 2)
    .map((post, index) => {
      const sortedTrend = [...post.trend].sort((a, b) => a.timestamp - b.timestamp);
      const deltaData: PostDeltaTrend["data"] = [];

      for (let i = 1; i < sortedTrend.length; i++) {
        const prev = sortedTrend[i - 1];
        const curr = sortedTrend[i];
        const delta = Math.max(0, curr.views - prev.views);

        timestampSet.add(curr.timestamp);
        deltaData.push({
          timestamp: curr.timestamp,
          label: formatTimeLabel15m(curr.timestamp),
          views: curr.views,
          delta,
        });
      }

      return {
        postId: post.id,
        postText: post.text.length > 15 ? post.text.slice(0, 15) + "..." : post.text || "(無文字)",
        color: POST_COLORS[index % POST_COLORS.length],
        data: deltaData,
      };
    });

  // 排序所有時間戳記
  const allTimestamps = Array.from(timestampSet).sort((a, b) => a - b);

  // 建立圖表資料（每個時間點包含所有貼文的 delta）
  const chartData: ChartDataPoint[] = allTimestamps.map((timestamp) => {
    const point: ChartDataPoint = {
      timestamp,
      label: formatTimeLabel15m(timestamp),
    };

    for (const postTrend of postTrends) {
      const match = postTrend.data.find((d) => d.timestamp === timestamp);
      point[postTrend.postId] = match ? match.delta : 0;
    }

    return point;
  });

  return { postTrends, chartData, allTimestamps };
}

// 72 小時曝光趨勢圖（每則貼文獨立線條）
function ViewDeltaTrendChart({
  posts,
  isLoading,
}: {
  posts: TrackingPost[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5" />
            72 小時曝光趨勢（15 分鐘增量）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
    );
  }

  const { postTrends, chartData } = calculatePostDeltas(posts);

  if (postTrends.length === 0 || chartData.length < 2) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="size-5" />
            72 小時曝光趨勢（15 分鐘增量）
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-64 items-center justify-center">
          <div className="text-center text-muted-foreground">
            <TrendingUp className="mx-auto mb-2 size-12 opacity-20" />
            <p>趨勢資料不足</p>
            <p className="text-sm">需要至少 2 個時間點的資料才能顯示趨勢</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 計算每則貼文的總增量
  const postTotalDeltas = postTrends.map((pt) => ({
    ...pt,
    totalDelta: pt.data.reduce((sum, d) => sum + d.delta, 0),
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="size-5" />
          72 小時曝光趨勢（15 分鐘增量）
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* 圖表 */}
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
                angle={-30}
                textAnchor="end"
                height={50}
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
                  // 過濾掉 delta 為 0 的項目
                  const validPayload = payload.filter(
                    (p) => typeof p.value === "number" && p.value > 0
                  );
                  if (validPayload.length === 0) return null;

                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-lg">
                      <p className="mb-2 font-medium">{label}</p>
                      <div className="space-y-1.5 text-sm">
                        {validPayload.map((entry) => {
                          const postInfo = postTrends.find(
                            (pt) => pt.postId === entry.dataKey
                          );
                          return (
                            <div
                              key={entry.dataKey}
                              className="flex items-center gap-2"
                            >
                              <div
                                className="size-2.5 rounded-full"
                                style={{ backgroundColor: entry.color as string }}
                              />
                              <span className="max-w-32 truncate text-muted-foreground">
                                {postInfo?.postText}
                              </span>
                              <span className="ml-auto font-mono font-medium">
                                +{formatNumber(entry.value as number)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }}
              />
              {postTrends.map((postTrend) => (
                <Line
                  key={postTrend.postId}
                  type="monotone"
                  dataKey={postTrend.postId}
                  stroke={postTrend.color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* 圖例 */}
        <div className="mt-4 flex flex-wrap gap-3">
          {postTotalDeltas.map((pt) => (
            <div
              key={pt.postId}
              className="flex items-center gap-2 rounded-md border px-2 py-1 text-sm"
            >
              <div
                className="size-3 rounded-full"
                style={{ backgroundColor: pt.color }}
              />
              <span className="max-w-24 truncate" title={pt.postText}>
                {pt.postText}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                +{formatNumber(pt.totalDelta)}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ 點火曲線圖表（使用 API 資料） ============

// 點火曲線圖表（小多圖）
function IgnitionCurveChart({
  posts,
  isLoading,
}: {
  posts: TrackingPost[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="size-5" />
            早期點火曲線（前 3 小時）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // 完全沒有貼文時的空狀態
  if (posts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="size-5" />
            早期點火曲線（前 3 小時）
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-40 items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Flame className="mx-auto mb-2 size-10 opacity-20" />
            <p>尚無追蹤中的貼文</p>
            <p className="text-sm">72 小時內發布的貼文會自動出現在這裡</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 所有貼文都顯示（有資料的顯示圖表，沒資料的顯示等待/延遲提示）
  const allPostsWithMeta = posts.map((post, index) => ({
    ...post,
    color: POST_COLORS[index % POST_COLORS.length],
    postText: post.text.length > 15 ? post.text.slice(0, 15) + "..." : post.text || "(無文字)",
    hasEnoughData: post.ignition && post.ignition.dataPoints.length >= 2,
    // 區分「延遲追蹤」和「資料累積中」
    noDataReason: !post.hasEarlyData ? "delayed" : "pending" as "delayed" | "pending",
  }));

  // 按互動領先指數排序（有資料的優先，沒資料的排後面）
  const sortedData = [...allPostsWithMeta].sort((a, b) => {
    // 有資料的排前面
    if (a.hasEnoughData && !b.hasEnoughData) return -1;
    if (!a.hasEnoughData && b.hasEnoughData) return 1;
    // 都有資料時按 engagementLeadScore 排序
    if (a.hasEnoughData && b.hasEnoughData) {
      return (b.ignition?.engagementLeadScore || 0) - (a.ignition?.engagementLeadScore || 0);
    }
    // 都沒資料時按發布時間排序（新的在前）
    return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Flame className="size-5" />
            早期點火曲線（前 3 小時）
          </CardTitle>
          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 bg-warning" />
              <span>互動訊號</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 bg-primary" />
              <span>曝光增量</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 小多圖 Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedData.map((post) => {
            // 資料不足時顯示等待/延遲提示
            if (!post.hasEnoughData) {
              const isDelayed = post.noDataReason === "delayed";
              return (
                <div key={post.id} className="rounded-lg border p-3">
                  {/* 標題列 */}
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: post.color }}
                      />
                      <span className="max-w-32 truncate text-sm font-medium">
                        {post.postText}
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-xs",
                        "border-border bg-muted text-muted-foreground"
                      )}
                    >
                      <Clock className="mr-1 size-3" />
                      {isDelayed ? "延遲追蹤" : "等待中"}
                    </Badge>
                  </div>
                  {/* 提示訊息 */}
                  <div className="flex h-24 items-center justify-center text-center">
                    <div className="text-muted-foreground">
                      <Clock className="mx-auto mb-1 size-6 opacity-30" />
                      {isDelayed ? (
                        <>
                          <p className="text-xs">此貼文在加入追蹤前</p>
                          <p className="text-xs">已超過 3 小時</p>
                          <p className="mt-1 text-[10px] text-muted-foreground/70">無法回溯早期點火數據</p>
                        </>
                      ) : (
                        <>
                          <p className="text-xs">資料累積中</p>
                          <p className="text-[10px]">下次同步後更新</p>
                        </>
                      )}
                    </div>
                  </div>
                  {/* 底部佔位 */}
                  <div className="mt-2 text-center text-xs text-muted-foreground">
                    發布於 {formatRelativeTime(post.ageMinutes)}
                  </div>
                </div>
              );
            }

            // 有資料時顯示圖表
            const ignition = post.ignition!;
            return (
              <div key={post.id} className="rounded-lg border p-3">
                {/* 標題列 */}
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: post.color }}
                    />
                    <span className="max-w-32 truncate text-sm font-medium">
                      {post.postText}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-xs",
                      ignition.engagementLeadScore > 5
                        ? "border-warning/30 bg-warning/10 text-warning"
                        : ignition.engagementLeadScore > 0
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-border bg-muted text-muted-foreground"
                    )}
                  >
                    {ignition.engagementLeadScore > 0 ? "+" : ""}
                    {ignition.engagementLeadScore}
                  </Badge>
                </div>

                {/* 迷你圖表 */}
                <div className="h-24">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ignition.dataPoints}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke={STONE[200]}
                      />
                      <XAxis
                        dataKey="timeLabel"
                        tick={{ fontSize: 10 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis hide domain={[0, 100]} />
                      <Tooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || payload.length === 0) return null;
                          const data = payload[0].payload as IgnitionDataPoint;
                          return (
                            <div className="rounded border bg-background p-2 text-xs shadow">
                              <p className="font-medium">{data.timeLabel}</p>
                              <p className="text-warning">
                                互動：{data.engagementPct.toFixed(1)}%
                              </p>
                              <p className="text-primary">
                                曝光：{data.viewsPct.toFixed(1)}%
                              </p>
                            </div>
                          );
                        }}
                      />
                      {/* 互動訊號（橙色） */}
                      <Line
                        type="monotone"
                        dataKey="engagementPct"
                        stroke={SEMANTIC_COLORS.warning}
                        strokeWidth={2}
                        dot={false}
                      />
                      {/* 曝光增量（青色） */}
                      <Line
                        type="monotone"
                        dataKey="viewsPct"
                        stroke={ACCENT.DEFAULT}
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>

                {/* 底部統計 */}
                <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>互動高峰：{ignition.peakEngagementTime}</span>
                  <span>曝光高峰：{ignition.peakViewsTime}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* 說明文字 */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          橙色曲線在上方 = 互動領先曝光（正在點火） · 領先指數越高代表早期互動越強
        </p>
      </CardContent>
    </Card>
  );
}

// ============ 早期訊號熱力圖（使用 API 資料） ============

// 時間區間標籤（12 個 15 分鐘區間 = 3 小時）
const TIME_BUCKET_LABELS = [
  "0-15m",
  "15-30m",
  "30-45m",
  "45-60m",
  "60-75m",
  "75-90m",
  "90-105m",
  "105-120m",
  "120-135m",
  "135-150m",
  "150-165m",
  "165-180m",
];

// 根據強度取得顏色 - 使用 design-tokens
const getHeatmapColor = getHeatmapIntensityColor;

// 熱力圖類型標籤設定
const HEAT_TYPE_CONFIG = {
  early: { label: "早熱", color: "text-warning" },
  slow: { label: "慢熱", color: "text-info" },
  steady: { label: "穩定", color: "text-muted-foreground" },
} as const;

// 早期訊號熱力圖元件
function EarlySignalHeatmap({
  posts,
  isLoading,
}: {
  posts: TrackingPost[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="size-5" />
            早期訊號熱力圖（前 3 小時）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  // 完全沒有貼文時的空狀態
  if (posts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="size-5" />
            早期訊號熱力圖（前 3 小時）
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-40 items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Zap className="mx-auto mb-2 size-10 opacity-20" />
            <p>尚無追蹤中的貼文</p>
            <p className="text-sm">72 小時內發布的貼文會自動出現在這裡</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // 所有貼文都顯示（有資料的顯示熱力格，沒資料的顯示等待/延遲提示）
  const allPostsWithMeta = posts
    .map((post) => ({
      ...post,
      postText: post.text.length > 12 ? post.text.slice(0, 12) + "..." : post.text || "(無文字)",
      hasEnoughData: post.heatmap && post.heatmap.cells.length === 12,
      // 區分「延遲追蹤」和「資料累積中」
      noDataReason: !post.hasEarlyData ? "delayed" : "pending" as "delayed" | "pending",
    }))
    .sort((a, b) => {
      // 有資料的排前面
      if (a.hasEnoughData && !b.hasEnoughData) return -1;
      if (!a.hasEnoughData && b.hasEnoughData) return 1;
      // 都有資料時按 viralityScore 排序
      return b.viralityScore - a.viralityScore;
    });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Zap className="size-5" />
            早期訊號熱力圖（前 3 小時）
          </CardTitle>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">訊號強度：</span>
            <div className="flex gap-0.5">
              {[0, 0.2, 0.4, 0.6, 0.8, 1].map((intensity) => (
                <div
                  key={intensity}
                  className="size-4 rounded-sm"
                  style={{ backgroundColor: getHeatmapColor(intensity) }}
                />
              ))}
            </div>
            <span className="text-muted-foreground">弱 → 強</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 表頭 */}
        <div className="mb-2 flex">
          <div className="w-28 shrink-0" /> {/* 貼文名稱欄位 */}
          <div className="flex flex-1 gap-0.5">
            {TIME_BUCKET_LABELS.map((label, i) => (
              <div
                key={label}
                className="flex-1 text-center text-[10px] text-muted-foreground"
              >
                {i % 2 === 0 ? label.replace("m", "") : ""}
              </div>
            ))}
          </div>
          <div className="w-20 shrink-0 text-center text-xs text-muted-foreground">
            類型
          </div>
        </div>

        {/* 熱力圖主體 */}
        <div className="space-y-1">
          {allPostsWithMeta.map((post) => {
            // 資料不足時顯示等待/延遲提示列
            if (!post.hasEnoughData) {
              const isDelayed = post.noDataReason === "delayed";
              return (
                <div key={post.id} className="flex items-center">
                  {/* 貼文名稱 */}
                  <div className="w-28 shrink-0 truncate pr-2 text-sm text-muted-foreground" title={post.postText}>
                    {post.postText}
                  </div>

                  {/* 等待/延遲中的灰色格子 */}
                  <div className="flex flex-1 gap-0.5">
                    {TIME_BUCKET_LABELS.map((_, i) => (
                      <div key={i} className="flex-1">
                        <div className="h-6 w-full rounded-sm bg-muted" />
                      </div>
                    ))}
                  </div>

                  {/* 狀態標籤 */}
                  <div
                    className="w-20 shrink-0 text-center text-xs text-muted-foreground"
                    title={isDelayed ? "此貼文在加入追蹤前已超過 3 小時，無法追蹤早期訊號" : "資料累積中，下次同步後更新"}
                  >
                    <Clock className="inline size-3 mr-0.5" />
                    {isDelayed ? "延遲追蹤" : "等待中"}
                  </div>
                </div>
              );
            }

            // 有資料時顯示熱力圖
            const heatmap = post.heatmap!;
            const { label: heatTypeLabel, color: heatTypeColor } = HEAT_TYPE_CONFIG[heatmap.heatType];

            return (
              <div key={post.id} className="flex items-center">
                {/* 貼文名稱 */}
                <div className="w-28 shrink-0 truncate pr-2 text-sm" title={post.postText}>
                  <span
                    className={cn(
                      post.viralityLevel === "viral" && "font-semibold text-destructive",
                      post.viralityLevel === "excellent" && "font-medium text-warning"
                    )}
                  >
                    {post.postText}
                  </span>
                </div>

                {/* 熱力格子 */}
                <div className="flex flex-1 gap-0.5">
                  {heatmap.cells.map((cell) => (
                    <div
                      key={cell.bucketIndex}
                      className="group relative flex-1"
                    >
                      <div
                        className="h-6 w-full rounded-sm transition-all hover:ring-2 hover:ring-warning"
                        style={{ backgroundColor: getHeatmapColor(cell.intensity) }}
                      />
                      {/* Tooltip */}
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-foreground px-2 py-1 text-xs text-background group-hover:block">
                        {TIME_BUCKET_LABELS[cell.bucketIndex]}: {cell.viralityDelta.toFixed(1)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* 類型標籤 */}
                <div className={cn("w-20 shrink-0 text-center text-xs font-medium", heatTypeColor)}>
                  {heatTypeLabel}
                </div>
              </div>
            );
          })}
        </div>

        {/* 說明文字 */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          顏色越深 = 該時段互動訊號越強 · 早熱型貼文更有爆紅潛力
        </p>
      </CardContent>
    </Card>
  );
}

// 四象限圖表資料點（曝光 vs 傳播力）
interface QuadrantDataPoint {
  postId: string;
  postText: string;
  x: number; // 曝光數 (views)
  y: number; // 傳播力 (virality score)
  z: number; // 互動數 (total engagement) - 用於氣泡大小
  viralityLevel: ViralityLevel;
  engagementRate: number;
}

// 計算四象限資料（曝光 vs 傳播力）
function calculateQuadrantData(posts: TrackingPost[]): {
  data: QuadrantDataPoint[];
  midX: number;
  midY: number;
  maxX: number;
  maxY: number;
  minZ: number;
  maxZ: number;
} {
  const data: QuadrantDataPoint[] = posts
    .filter((post) => post.views > 0)
    .map((post) => ({
      postId: post.id,
      postText:
        post.text.length > 20 ? post.text.slice(0, 20) + "..." : post.text || "(無文字)",
      x: post.views,
      y: Math.round(post.viralityScore * 100) / 100,
      z: post.likes + post.replies + post.reposts + post.quotes, // 總互動數
      viralityLevel: post.viralityLevel,
      engagementRate: post.engagementRate,
    }));

  // 計算軸範圍
  const maxX = data.length > 0 ? Math.max(...data.map((d) => d.x)) : 1;
  const maxY = data.length > 0 ? Math.max(...data.map((d) => d.y)) : 10;
  const minZ = data.length > 0 ? Math.min(...data.map((d) => d.z)) : 0;
  const maxZ = data.length > 0 ? Math.max(...data.map((d) => d.z)) : 1;

  // 中央分界線（範圍中點）
  const midX = maxX / 2;
  const midY = maxY / 2;

  return { data, midX, midY, maxX, maxY, minZ, maxZ };
}

// 根據象限位置決定顏色（曝光 vs 傳播力）- 使用 design-tokens
function getQuadrantColor(
  x: number,
  y: number,
  avgX: number,
  avgY: number
): string {
  if (x >= avgX && y >= avgY) return SEMANTIC_COLORS.success; // 右上：明星貼文 - Emerald
  if (x < avgX && y >= avgY) return CHART_COLORS_EXTENDED[2]; // 左上：潛力股 - Violet
  if (x >= avgX && y < avgY) return SEMANTIC_COLORS.warning; // 右下：觸及廣 - Amber
  return STONE[500]; // 左下：待觀察 - Gray
}

// 四象限散佈圖
function QuadrantChart({
  posts,
  isLoading,
}: {
  posts: TrackingPost[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="size-5" />
            貼文表現四象限
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-80 w-full" />
        </CardContent>
      </Card>
    );
  }

  const { data, midX, midY, maxX, maxY, minZ, maxZ } = calculateQuadrantData(posts);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="size-5" />
            曝光 vs 傳播力
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-64 items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Eye className="mx-auto mb-2 size-12 opacity-20" />
            <p>尚無貼文資料</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Star className="size-4" />
          曝光 vs 傳播力
        </CardTitle>
        <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
          <div className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-success" />
            <span>明星貼文</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="size-2 rounded-full" style={{ backgroundColor: CHART_COLORS_EXTENDED[2] }} />
            <span>潛力股</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-warning" />
            <span>觸及廣</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-muted-foreground" />
            <span>待觀察</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2 px-3">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 5, right: 5, bottom: 25, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                type="number"
                dataKey="x"
                name="曝光"
                tick={{ fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatNumber(v)}
                label={{ value: "曝光", position: "bottom", offset: 5, fontSize: 10 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="傳播力"
                tick={{ fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                width={28}
                label={{ value: "傳播力", angle: -90, position: "insideLeft", fontSize: 10 }}
              />
              <ZAxis
                type="number"
                dataKey="z"
                domain={[minZ, maxZ]}
                range={[40, 400]}
                name="互動數"
              />
              {/* 中央分界線 */}
              <ReferenceLine
                x={midX}
                stroke={STONE[300]}
                strokeWidth={1.5}
              />
              <ReferenceLine
                y={midY}
                stroke={STONE[300]}
                strokeWidth={1.5}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const d = payload[0].payload as QuadrantDataPoint;
                  // 判斷所在象限
                  const quadrant =
                    d.x >= midX && d.y >= midY
                      ? "明星貼文"
                      : d.x < midX && d.y >= midY
                        ? "潛力股"
                        : d.x >= midX && d.y < midY
                          ? "觸及廣"
                          : "待觀察";
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-lg">
                      <p className="mb-2 font-medium">{d.postText}</p>
                      <div className="space-y-1 text-sm">
                        <p className="flex justify-between gap-4">
                          <span className="text-muted-foreground">曝光數</span>
                          <span className="font-mono">{formatNumber(d.x)}</span>
                        </p>
                        <p className="flex justify-between gap-4">
                          <span className="text-muted-foreground">傳播力</span>
                          <span className="font-mono">{d.y.toFixed(2)}</span>
                        </p>
                        <p className="flex justify-between gap-4">
                          <span className="text-muted-foreground">互動數</span>
                          <span className="font-mono">{formatNumber(d.z)}</span>
                        </p>
                        <p className="flex justify-between gap-4">
                          <span className="text-muted-foreground">互動率</span>
                          <span className="font-mono">{d.engagementRate.toFixed(2)}%</span>
                        </p>
                        <hr className="my-1" />
                        <p className="flex justify-between gap-4">
                          <span className="text-muted-foreground">象限</span>
                          <span className="font-medium">{quadrant}</span>
                        </p>
                      </div>
                    </div>
                  );
                }}
              />
              <Scatter data={data} fill={ACCENT.DEFAULT}>
                {data.map((entry) => (
                  <Cell
                    key={entry.postId}
                    fill={getQuadrantColor(entry.x, entry.y, midX, midY)}
                    fillOpacity={0.8}
                    stroke={getQuadrantColor(entry.x, entry.y, midX, midY)}
                    strokeWidth={2}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-center text-[10px] text-muted-foreground">
          右上=明星 · 左上=潛力股 · 點大小=互動數
        </p>
      </CardContent>
    </Card>
  );
}

// ============ 曝光 vs 擴散動態 四象限圖 ============

// 擴散動態臨界點 (擴散指數 = 1.0)
const RHAT_THRESHOLD = 1.0;

interface ViewsRHatDataPoint {
  postId: string;
  postText: string;
  x: number; // 曝光數 (views)
  y: number; // 擴散動態 值
  z: number; // 傳播力 (virality score) - 用於氣泡大小
  viralityScore: number;
}

function calculateViewsRHatData(posts: TrackingPost[]): {
  data: ViewsRHatDataPoint[];
  midX: number;
  maxX: number;
  maxY: number;
  minZ: number;
  maxZ: number;
} {
  // 只取有 擴散動態 資料的貼文
  const data: ViewsRHatDataPoint[] = posts
    .filter((post) => post.diffusion !== null)
    .map((post) => ({
      postId: post.id,
      postText:
        post.text.length > 20 ? post.text.slice(0, 20) + "..." : post.text || "(無文字)",
      x: post.views,
      y: post.diffusion!.rHat,
      z: post.viralityScore, // 傳播力用於氣泡大小
      viralityScore: post.viralityScore,
    }));

  const maxX = data.length > 0 ? Math.max(...data.map((d) => d.x)) : 1;
  const maxY = data.length > 0 ? Math.max(...data.map((d) => d.y), 2) : 2;
  const minZ = data.length > 0 ? Math.min(...data.map((d) => d.z)) : 0;
  const maxZ = data.length > 0 ? Math.max(...data.map((d) => d.z)) : 1;
  const midX = maxX / 2;

  return { data, midX, maxX, maxY, minZ, maxZ };
}

function getViewsRHatColor(x: number, y: number, midX: number): string {
  if (x >= midX && y >= RHAT_THRESHOLD) return SEMANTIC_COLORS.info; // 右上：大規模擴散中 - Blue
  if (x < midX && y >= RHAT_THRESHOLD) return SEMANTIC_COLORS.success; // 左上：剛開始擴散 - Emerald
  if (x >= midX && y < RHAT_THRESHOLD) return CHART_COLORS_EXTENDED[2]; // 右下：已達峰值 - Violet
  return STONE[500]; // 左下：未能引起關注 - Gray
}

function ViewsRHatQuadrantChart({
  posts,
  isLoading,
}: {
  posts: TrackingPost[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="size-4" />
            曝光 vs 擴散動態
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  const { data, midX, maxX, maxY, minZ, maxZ } = calculateViewsRHatData(posts);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="size-4" />
            曝光 vs 擴散動態
          </CardTitle>
        </CardHeader>
        <CardContent className="flex h-64 items-center justify-center">
          <div className="text-center text-muted-foreground">
            <Clock className="mx-auto mb-2 size-10 opacity-20" />
            <p className="text-sm">擴散動態數據累積中</p>
            <p className="text-xs mt-1">新貼文需約 45 分鐘才能計算擴散指數</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Eye className="size-4" />
          曝光 vs 擴散動態
        </CardTitle>
        <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
          <div className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-info" />
            <span>大規模擴散</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-success" />
            <span>剛開始擴散</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="size-2 rounded-full" style={{ backgroundColor: CHART_COLORS_EXTENDED[2] }} />
            <span>已達峰值</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-muted-foreground" />
            <span>未引起關注</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2 px-3">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 5, right: 5, bottom: 25, left: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                type="number"
                dataKey="x"
                name="曝光"
                tick={{ fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatNumber(v)}
                label={{ value: "曝光", position: "bottom", offset: 5, fontSize: 10 }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="擴散動態"
                tick={{ fontSize: 9 }}
                tickLine={false}
                axisLine={false}
                domain={[0, Math.max(maxY, 2)]}
                width={28}
                label={{ value: "擴散動態", angle: -90, position: "insideLeft", fontSize: 10 }}
              />
              <ZAxis
                type="number"
                dataKey="z"
                domain={[minZ, maxZ]}
                range={[40, 400]}
                name="傳播力"
              />
              {/* 曝光中央分界 */}
              <ReferenceLine x={midX} stroke={STONE[300]} strokeWidth={1.5} />
              {/* 擴散動態 = 1.0 臨界線 */}
              <ReferenceLine
                y={RHAT_THRESHOLD}
                stroke={SEMANTIC_COLORS.destructive}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: "臨界值 1.0",
                  position: "right",
                  fontSize: 10,
                  fill: SEMANTIC_COLORS.destructive,
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const d = payload[0].payload as ViewsRHatDataPoint;
                  const quadrant =
                    d.x >= midX && d.y >= RHAT_THRESHOLD
                      ? "🌊 大規模擴散中"
                      : d.x < midX && d.y >= RHAT_THRESHOLD
                        ? "🌱 剛開始擴散"
                        : d.x >= midX && d.y < RHAT_THRESHOLD
                          ? "🏔️ 已達峰值"
                          : "❄️ 未能引起關注";
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-lg">
                      <p className="mb-2 font-medium">{d.postText}</p>
                      <div className="space-y-1 text-sm">
                        <p className="flex justify-between gap-4">
                          <span className="text-muted-foreground">曝光數</span>
                          <span className="font-mono">{formatNumber(d.x)}</span>
                        </p>
                        <p className="flex justify-between gap-4">
                          <span className="text-muted-foreground">擴散動態</span>
                          <span className="font-mono">{d.y.toFixed(2)}</span>
                        </p>
                        <p className="flex justify-between gap-4">
                          <span className="text-muted-foreground">傳播力</span>
                          <span className="font-mono">{d.viralityScore.toFixed(2)}</span>
                        </p>
                        <hr className="my-1" />
                        <p className="flex justify-between gap-4">
                          <span className="text-muted-foreground">狀態</span>
                          <span className="font-medium">{quadrant}</span>
                        </p>
                      </div>
                    </div>
                  );
                }}
              />
              <Scatter data={data} fill={ACCENT.DEFAULT}>
                {data.map((entry) => (
                  <Cell
                    key={entry.postId}
                    fill={getViewsRHatColor(entry.x, entry.y, midX)}
                    fillOpacity={0.8}
                    stroke={getViewsRHatColor(entry.x, entry.y, midX)}
                    strokeWidth={2}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-center text-[10px] text-muted-foreground">
          左上=值得推廣 · 右下=已達峰值 · 點大小=傳播力
        </p>
      </CardContent>
    </Card>
  );
}

// 時間階段 Badge
function TimeStatusBadge({ status }: { status: TimeStatus }) {
  const config = {
    golden: {
      label: "黃金期",
      icon: "🔥",
      className: "bg-destructive/10 text-destructive border-destructive/20",
    },
    early: {
      label: "早期",
      icon: "⏰",
      className: "bg-warning/10 text-warning border-warning/20",
    },
    tracking: {
      label: "追蹤中",
      icon: "📊",
      className: "bg-muted text-muted-foreground border-border",
    },
  };

  const { label, icon, className } = config[status];

  return (
    <Badge variant="outline" className={cn("gap-1 text-xs", className)}>
      <span>{icon}</span>
      {label}
    </Badge>
  );
}

// 緊湊互動數顯示
function CompactEngagement({
  likes,
  replies,
  reposts,
  quotes,
}: {
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
}) {
  const total = likes + replies + reposts + quotes;

  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="font-mono font-medium">{formatNumber(total)}</span>
      <div className="flex items-center gap-1.5 text-muted-foreground">
        <span className="flex items-center gap-0.5" title="愛心">
          <Heart className="size-3" />
          {likes}
        </span>
        <span className="flex items-center gap-0.5" title="回覆">
          <MessageSquare className="size-3" />
          {replies}
        </span>
        <span className="flex items-center gap-0.5" title="轉發">
          <Repeat2 className="size-3" />
          {reposts + quotes}
        </span>
      </div>
    </div>
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
  variant?: "default" | "warning" | "success";
  isLoading: boolean;
}) {
  const variantStyles = {
    default: "bg-card",
    warning: "bg-destructive/5 border-destructive/20",
    success: "bg-primary/5 border-primary/20",
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

// ============ 行動建議系統（v2 新增）============

type ActionSuggestionType = "urgent" | "recommended" | "tip" | "info" | null;

interface ActionSuggestion {
  type: ActionSuggestionType;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actions: string[];
}

// 根據貼文狀態計算行動建議
function getActionSuggestion(post: TrackingPost): ActionSuggestion | null {
  const { viralityLevel, timeStatus, diffusion } = post;
  const diffusionStatus = diffusion?.status;

  // P0: viral + golden 或 viral + accelerating
  if (viralityLevel === "viral") {
    if (timeStatus === "golden" || diffusionStatus === "accelerating") {
      return {
        type: "urgent",
        icon: Flame,
        title: "立即行動",
        description: "這則貼文正在爆紅中！",
        actions: [
          "立即回覆留言，增加互動深度",
          "考慮付費推廣，放大觸及效果",
          "準備相關的後續內容",
        ],
      };
    }
  }

  // P1: excellent + golden 或 excellent + accelerating
  if (viralityLevel === "excellent") {
    if (timeStatus === "golden") {
      return {
        type: "recommended",
        icon: Star,
        title: "把握黃金期",
        description: "表現優異！趁黃金期多互動，有機會進一步爆發",
        actions: [
          "回覆留言增加互動率",
          "觀察接下來 30 分鐘的變化",
        ],
      };
    }
    if (diffusionStatus === "accelerating") {
      return {
        type: "recommended",
        icon: Rocket,
        title: "建議推廣",
        description: "貼文正在加速擴散，是推廣的好時機",
        actions: [
          "考慮付費推廣放大效果",
          "回覆留言增加互動率",
        ],
      };
    }
  }

  // P2: good + golden
  if (viralityLevel === "good" && timeStatus === "golden") {
    return {
      type: "tip",
      icon: Lightbulb,
      title: "持續觀察",
      description: "表現良好，關注接下來的數據變化",
      actions: [],
    };
  }

  // P3: decelerating（任何等級）
  if (diffusionStatus === "decelerating" && viralityLevel !== "normal") {
    return {
      type: "info",
      icon: BarChart3,
      title: "正常衰退",
      description: "熱度趨緩是自然現象，貼文已完成主要傳播週期",
      actions: [],
    };
  }

  return null;
}

// 行動建議卡片元件
function ActionSuggestionCard({ suggestion }: { suggestion: ActionSuggestion }) {
  const typeConfig = {
    urgent: {
      className: "bg-destructive/10 border-destructive/30 text-destructive",
      titleClassName: "text-destructive font-semibold",
    },
    recommended: {
      className: "bg-warning/10 border-warning/30 text-warning-foreground",
      titleClassName: "text-warning font-semibold",
    },
    tip: {
      className: "bg-primary/10 border-primary/30 text-primary-foreground",
      titleClassName: "text-primary font-medium",
    },
    info: {
      className: "bg-muted border-border text-muted-foreground",
      titleClassName: "text-muted-foreground font-medium",
    },
  };

  const config = typeConfig[suggestion.type || "info"];

  const Icon = suggestion.icon;

  return (
    <div className={cn("rounded-lg border p-3 mt-2", config.className)}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className="size-4" />
        <span className={cn("text-sm", config.titleClassName)}>
          {suggestion.title}
        </span>
      </div>
      <p className="text-xs text-muted-foreground mb-2">
        {suggestion.description}
      </p>
      {suggestion.actions.length > 0 && (
        <ul className="text-xs space-y-1">
          {suggestion.actions.map((action, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span className="text-muted-foreground">•</span>
              <span>{action}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// 內嵌式行動建議（用於表格）
function InlineActionBadge({ suggestion }: { suggestion: ActionSuggestion | null }) {
  if (!suggestion) return <span className="text-xs text-muted-foreground">—</span>;

  const typeConfig = {
    urgent: "bg-destructive/20 text-destructive border-destructive/30",
    recommended: "bg-warning/20 text-warning border-warning/30",
    tip: "bg-primary/20 text-primary border-primary/30",
    info: "bg-muted text-muted-foreground border-border",
  };

  const Icon = suggestion.icon;

  return (
    <Badge
      variant="outline"
      className={cn("text-[10px] gap-1", typeConfig[suggestion.type || "info"])}
      title={suggestion.description}
    >
      <Icon className="size-3" />
      <span>{suggestion.title}</span>
    </Badge>
  );
}

function AlertBanner({ alerts, onDismiss }: { alerts: PageAlert[]; onDismiss: (id: string) => void }) {
  if (alerts.length === 0) return null;

  const alertConfig = {
    viral: {
      icon: Flame,
      className: "bg-destructive/10 border-destructive/20 text-destructive",
    },
    excellent: {
      icon: Star,
      className: "bg-warning/10 border-warning/20 text-warning",
    },
    fast: {
      icon: Zap,
      className: "bg-primary/10 border-primary/20 text-primary",
    },
  };

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const { icon: Icon, className } = alertConfig[alert.type];
        return (
          <div
            key={alert.id}
            className={cn(
              "flex items-center justify-between rounded-lg border p-3",
              className
            )}
          >
            <div className="flex items-center gap-2">
              <Icon className="size-5" />
              <span className="font-medium">{alert.message}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDismiss(alert.id)}
            >
              關閉
            </Button>
          </div>
        );
      })}
    </div>
  );
}

function PostsTable({
  posts,
  isLoading,
}: {
  posts: TrackingPost[];
  isLoading: boolean;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">貼文內容</TableHead>
                <TableHead className="w-20">階段</TableHead>
                <TableHead className="w-24">發布時間</TableHead>
                <TableHead className="w-20 text-right">曝光</TableHead>
                <TableHead className="w-24">觸及倍數</TableHead>
                <TableHead className="w-36">互動</TableHead>
                <TableHead className="w-40">傳播力</TableHead>
                <TableHead className="w-28">擴散動態</TableHead>
                <TableHead className="w-24">建議</TableHead>
                <TableHead className="w-24">趨勢</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-6 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-20" /></TableCell>
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
            <Eye className="mx-auto mb-2 size-12 opacity-20" />
            <p>72 小時內沒有發布的貼文</p>
            <p className="text-sm">發布新貼文後，這裡會顯示追蹤資料</p>
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
              <TableHead className="w-44">貼文內容</TableHead>
              <TableHead className="w-20">階段</TableHead>
              <TableHead className="w-24">發布時間</TableHead>
              <TableHead className="w-20 text-right">曝光</TableHead>
              <TableHead className="w-24">觸及倍數</TableHead>
              <TableHead className="w-36">互動</TableHead>
              <TableHead className="w-40">傳播力</TableHead>
              <TableHead className="w-28">擴散動態</TableHead>
              <TableHead className="w-24">建議</TableHead>
              <TableHead className="w-24">趨勢</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.map((post) => {
              const suggestion = getActionSuggestion(post);
              return (
              <TableRow
                key={post.id}
                className={cn(
                  post.viralityLevel === "viral" && "bg-destructive/5",
                  post.viralityLevel === "excellent" && "bg-warning/5"
                )}
              >
                <TableCell>
                  <div className="flex items-start gap-3">
                    {post.thumbnailUrl && (
                      <img
                        src={post.thumbnailUrl}
                        alt=""
                        className="size-10 rounded object-cover"
                      />
                    )}
                    <p className="line-clamp-2 text-sm">
                      {post.text.length > 30
                        ? post.text.slice(0, 30) + "..."
                        : post.text || "(無文字)"}
                    </p>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <TimeStatusBadge status={post.timeStatus} />
                    {!post.hasEarlyData && (
                      <Badge
                        variant="outline"
                        className="gap-1 text-[10px] bg-muted text-muted-foreground border-border"
                        title={`此貼文在加入追蹤前已超過 3 小時（延遲 ${Math.round(post.trackingDelayMinutes / 60)} 小時），無法追蹤早期點火數據`}
                      >
                        <Clock className="size-2.5" />
                        延遲追蹤
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatRelativeTime(post.ageMinutes)}
                </TableCell>
                <TableCell className="text-right">
                  {post.views === 0 && (post.likes + post.replies + post.reposts + post.quotes) > 0 ? (
                    <span className="text-xs text-warning" title="Threads API 延遲，曝光數尚未更新">
                      <Clock className="inline size-3 mr-0.5" />
                      計算中
                    </span>
                  ) : (
                    <span className="font-mono">{formatNumber(post.views)}</span>
                  )}
                </TableCell>
                <TableCell>
                  <ReachMultipleBadge
                    multiple={post.reachMultiple}
                    riskLevel={post.reachRiskLevel}
                  />
                </TableCell>
                <TableCell>
                  <CompactEngagement
                    likes={post.likes}
                    replies={post.replies}
                    reposts={post.reposts}
                    quotes={post.quotes}
                  />
                </TableCell>
                <TableCell>
                  <ViralityBadge
                    score={post.viralityScore}
                    level={post.viralityLevel}
                    showPercentile
                  />
                </TableCell>
                <TableCell>
                  <DiffusionStatusIcon diffusion={post.diffusion} showDescription />
                </TableCell>
                <TableCell>
                  <InlineActionBadge suggestion={suggestion} />
                </TableCell>
                <TableCell>
                  <MiniTrendChart data={post.trend} />
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============ Main Component ============

export default function RadarPage() {
  const { selectedAccountId, isLoading: isAccountLoading } = useSelectedAccount();

  const [posts, setPosts] = useState<TrackingPost[]>([]);
  const [summary, setSummary] = useState<TrackingSummary>({
    totalPosts: 0,
    goldenPosts: 0,
    earlyPosts: 0,
    trackingPosts: 0,
    viralPotential: 0,
  });
  const [throttleRisk, setThrottleRisk] = useState<ThrottleRisk>({
    followersCount: 0,
    threeDayTotalViews: 0,
    cumulativeMultiple: 0,
    quotaLevel: "healthy",
    quotaPercentage: 0,
  });
  const [alerts, setAlerts] = useState<PageAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [sortBy, setSortBy] = useState<SortOption>("latest");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [hasNoAccounts, setHasNoAccounts] = useState(false);
  // 初始值固定為 false，避免 hydration mismatch
  const [autoRefresh, setAutoRefresh] = useState(false);
  // Live timer: 追蹤上次刷新後的秒數
  const [secondsSinceRefresh, setSecondsSinceRefresh] = useState(0);

  // 從 localStorage 讀取自動同步狀態（客戶端）
  useEffect(() => {
    const saved = localStorage.getItem("radar-auto-refresh");
    if (saved === "true") {
      setAutoRefresh(true);
    }
  }, []);

  // 儲存自動同步狀態到 localStorage
  useEffect(() => {
    localStorage.setItem("radar-auto-refresh", autoRefresh.toString());
  }, [autoRefresh]);

  // Live timer: 每秒更新「上次更新」顯示
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsSinceRefresh(
        Math.floor((Date.now() - lastRefresh.getTime()) / 1000)
      );
    }, 1000);
    return () => clearInterval(timer);
  }, [lastRefresh]);

  // 載入資料（透過 Edge Function API）
  const loadData = useCallback(async () => {
    if (!selectedAccountId) return;

    setIsLoading(true);
    const supabase = createClient();

    try {
      // 使用 Supabase 客戶端呼叫 Edge Function（預設 POST）
      const { data, error } = await supabase.functions.invoke<RadarApiResponse>(
        "insights-radar",
        {
          body: { account_id: selectedAccountId },
        }
      );

      if (error) {
        console.error("[Radar] Function error:", error);
        throw error;
      }

      if (!data) {
        throw new Error("No data returned from API");
      }

      // 轉換 API 資料為前端格式
      const processedPosts: TrackingPost[] = data.posts.map((post) => ({
        id: post.id,
        text: post.text,
        mediaType: post.mediaType,
        thumbnailUrl: post.mediaUrl,
        publishedAt: new Date(post.publishedAt),
        // 追蹤延遲資訊
        trackingDelayMinutes: post.trackingDelayMinutes,
        hasEarlyData: post.hasEarlyData,
        // 指標
        views: post.views,
        likes: post.likes,
        replies: post.replies,
        reposts: post.reposts,
        quotes: post.quotes,
        viralityScore: post.viralityScore,
        viralityLevel: post.viralityLevel,
        engagementRate: post.engagementRate,
        repostRate: post.repostRate,
        ageMinutes: post.ageMinutes,
        timeStatus: post.timeStatus,
        trend: post.trend,
        // 獨有指標（API 已計算）
        ignition: post.ignition,
        heatmap: post.heatmap,
        diffusion: post.diffusion,
        // 限流風險指標
        reachMultiple: post.reachMultiple,
        reachRiskLevel: post.reachRiskLevel,
      }));

      // API 回傳的 alerts 轉換為前端格式（加上 emoji）
      const processedAlerts: PageAlert[] = data.alerts.map((alert) => ({
        id: alert.id,
        type: alert.type,
        postId: alert.postId,
        message: alert.type === "viral"
          ? `🔥 ${alert.message}`
          : `⭐ ${alert.message}`,
      }));

      setPosts(processedPosts);
      setSummary(data.summary);
      setThrottleRisk(data.throttleRisk);
      setAlerts(processedAlerts);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("[Radar] Error loading data:", error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccountId]);

  // 初始載入和帳號切換
  useEffect(() => {
    if (isAccountLoading) return;

    if (!selectedAccountId) {
      setHasNoAccounts(true);
      setIsLoading(false);
      return;
    }

    setHasNoAccounts(false);
    loadData();
  }, [selectedAccountId, isAccountLoading, loadData]);

  // 自動刷新（60 秒）
  useEffect(() => {
    if (!selectedAccountId || !autoRefresh) return;

    const interval = setInterval(() => {
      loadData();
    }, 15 * 60 * 1000); // 15 分鐘

    return () => clearInterval(interval);
  }, [selectedAccountId, loadData, autoRefresh]);

  // 篩選和排序
  const filteredAndSortedPosts = posts
    .filter((post) => {
      if (filterBy === "all") return true;
      if (filterBy === "golden") return post.timeStatus === "golden";
      if (filterBy === "early") return post.timeStatus === "early";
      if (filterBy === "tracking") return post.timeStatus === "tracking";
      if (filterBy === "viral") return post.viralityScore >= 5;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "latest")
        return b.publishedAt.getTime() - a.publishedAt.getTime();
      if (sortBy === "virality") return b.viralityScore - a.viralityScore;
      if (sortBy === "engagement") return b.engagementRate - a.engagementRate;
      if (sortBy === "views") return b.views - a.views;
      return 0;
    });

  // 關閉提示
  const dismissAlert = (id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* 標題區域 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">發文追蹤雷達</h1>
          <p className="text-muted-foreground">
            監測 72 小時內貼文的擴散趨勢，提早發現爆紅訊號
          </p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-muted-foreground">
            上次更新：{secondsSinceRefresh} 秒前
          </span>
          <div className="flex items-center gap-2">
            <Switch
              id="auto-refresh"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label htmlFor="auto-refresh" className="text-sm cursor-pointer">
              自動刷新
            </Label>
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
      </div>

      {/* 無帳號提示 */}
      {hasNoAccounts && !isLoading && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            尚未連結任何 Threads 帳號，請先至設定頁面連結帳號。
          </p>
        </div>
      )}

      {/* 主要內容 */}
      {!hasNoAccounts && (
        <>
          {/* 提示區域 */}
          <AlertBanner alerts={alerts} onDismiss={dismissAlert} />

          {/* 摘要卡片 */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              title="追蹤中貼文"
              value={summary.totalPosts}
              icon={<Eye className="size-5 text-muted-foreground" />}
              isLoading={isLoading}
            />
            <SummaryCard
              title="黃金期貼文"
              value={summary.goldenPosts}
              icon={<Flame className="size-5 text-destructive" />}
              variant={summary.goldenPosts > 0 ? "warning" : "default"}
              isLoading={isLoading}
            />
            <SummaryCard
              title="早期觀察"
              value={summary.earlyPosts}
              icon={<Clock className="size-5 text-warning" />}
              isLoading={isLoading}
            />
            <SummaryCard
              title="爆紅潛力"
              value={summary.viralPotential}
              icon={<Star className="size-5 text-warning" />}
              variant={summary.viralPotential > 0 ? "success" : "default"}
              isLoading={isLoading}
            />
          </div>

          {/* 曝光配額監控 */}
          <ThrottleQuotaCard throttleRisk={throttleRisk} isLoading={isLoading} />

          {/* 72 小時曝光趨勢圖 */}
          <ViewDeltaTrendChart posts={posts} isLoading={isLoading} />

          {/* 早期點火曲線 */}
          <IgnitionCurveChart posts={posts} isLoading={isLoading} />

          {/* 早期訊號熱力圖 */}
          <EarlySignalHeatmap posts={posts} isLoading={isLoading} />

          {/* 四象限圖表區 */}
          <div className="grid gap-4 lg:grid-cols-2">
            <QuadrantChart posts={posts} isLoading={isLoading} />
            <ViewsRHatQuadrantChart posts={posts} isLoading={isLoading} />
          </div>

          {/* 篩選和排序 */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-muted-foreground" />
              <Select
                value={filterBy}
                onValueChange={(v) => setFilterBy(v as FilterOption)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="篩選" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="golden">黃金期</SelectItem>
                  <SelectItem value="early">早期</SelectItem>
                  <SelectItem value="tracking">追蹤中</SelectItem>
                  <SelectItem value="viral">爆紅潛力</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <ArrowUpDown className="size-4 text-muted-foreground" />
              <Select
                value={sortBy}
                onValueChange={(v) => setSortBy(v as SortOption)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="排序" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">最新發布</SelectItem>
                  <SelectItem value="virality">傳播力最高</SelectItem>
                  <SelectItem value="engagement">互動率最高</SelectItem>
                  <SelectItem value="views">曝光最多</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="ml-auto text-sm text-muted-foreground">
              顯示 {filteredAndSortedPosts.length} / {posts.length} 篇貼文
            </div>
          </div>

          {/* 貼文列表 */}
          <PostsTable posts={filteredAndSortedPosts} isLoading={isLoading} />
        </>
      )}
    </div>
  );
}
