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
  Filter,
  ArrowUpDown,
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

// ============ Types ============

type TimeStatus = "golden" | "early" | "tracking";
type ViralityLevel = "viral" | "excellent" | "good" | "normal";
type HeatType = "early" | "slow" | "steady";
type DiffusionStatus = "accelerating" | "stable" | "decelerating";
type SortOption = "latest" | "virality" | "engagement" | "views";
type FilterOption = "all" | "golden" | "early" | "tracking" | "viral";

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
}

// 前端使用的貼文格式
interface TrackingPost {
  id: string;
  text: string;
  mediaType: string;
  thumbnailUrl: string | null;
  publishedAt: Date;
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

function ViralityBadge({
  score,
  level,
}: {
  score: number;
  level: ViralityLevel;
}) {
  const config = {
    viral: {
      label: "爆紅中",
      className: "bg-red-600 text-white",
      icon: Flame,
    },
    excellent: {
      label: "表現優異",
      className: "bg-amber-500 text-white",
      icon: Star,
    },
    good: {
      label: "表現良好",
      className: "bg-teal-500 text-white",
      icon: TrendingUp,
    },
    normal: {
      label: "",
      className: "bg-gray-100 text-gray-600",
      icon: null,
    },
  };

  const { label, className, icon: Icon } = config[level];

  return (
    <div className="flex items-center gap-2">
      <span className="font-mono font-medium">{score.toFixed(1)}</span>
      {level !== "normal" && (
        <Badge className={cn("gap-1", className)}>
          {Icon && <Icon className="size-3" />}
          {label}
        </Badge>
      )}
    </div>
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
            stroke="#14B8A6"
            strokeWidth={1.5}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// 擴散動態狀態圖示
function DiffusionStatusIcon({ diffusion }: { diffusion: DiffusionMetrics | null }) {
  if (!diffusion) {
    return (
      <span
        className="text-muted-foreground text-xs cursor-help"
        title="需要至少 45 分鐘的數據才能計算擴散動態"
      >
        <Clock className="inline size-3 mr-0.5" />
        累積中
      </span>
    );
  }

  const config = {
    accelerating: {
      icon: "🔥",
      label: "加速擴散",
      tooltip: "擴散加速中（病毒式傳播）",
      className: "text-red-600",
    },
    stable: {
      icon: "✨",
      label: "穩定傳播",
      tooltip: "擴散穩定",
      className: "text-amber-500",
    },
    decelerating: {
      icon: "💤",
      label: "熱度趨緩",
      tooltip: "熱度趨緩（衰退/消退中）",
      className: "text-gray-400",
    },
  };

  const { icon, label, tooltip, className } = config[diffusion.status];

  return (
    <span
      className={cn("cursor-default flex items-center gap-0.5 text-xs", className)}
      title={`${tooltip} (擴散指數 ${diffusion.rHat})`}
    >
      <span>{icon}</span>
      <span>{label}</span>
    </span>
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

// 貼文顏色調色盤（12 色，夠用於大多數情況）
const POST_COLORS = [
  "#14B8A6", // Teal 500
  "#F59E0B", // Amber 500
  "#8B5CF6", // Violet 500
  "#EC4899", // Pink 500
  "#3B82F6", // Blue 500
  "#10B981", // Emerald 500
  "#F97316", // Orange 500
  "#6366F1", // Indigo 500
  "#EF4444", // Red 500
  "#06B6D4", // Cyan 500
  "#84CC16", // Lime 500
  "#A855F7", // Purple 500
];

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

  // 所有貼文都顯示（有資料的顯示圖表，沒資料的顯示等待提示）
  const allPostsWithMeta = posts.map((post, index) => ({
    ...post,
    color: POST_COLORS[index % POST_COLORS.length],
    postText: post.text.length > 15 ? post.text.slice(0, 15) + "..." : post.text || "(無文字)",
    hasEnoughData: post.ignition && post.ignition.dataPoints.length >= 2,
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
              <div className="h-0.5 w-4 bg-amber-500" />
              <span>互動訊號</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="h-0.5 w-4 bg-teal-500" />
              <span>曝光增量</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* 小多圖 Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedData.map((post) => {
            // 資料不足時顯示等待提示
            if (!post.hasEnoughData) {
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
                      className="text-xs border-gray-300 bg-gray-50 text-gray-500"
                    >
                      <Clock className="mr-1 size-3" />
                      等待中
                    </Badge>
                  </div>
                  {/* 等待提示 */}
                  <div className="flex h-24 items-center justify-center text-center">
                    <div className="text-muted-foreground">
                      <Clock className="mx-auto mb-1 size-6 opacity-30" />
                      <p className="text-xs">資料累積中</p>
                      <p className="text-[10px]">下次同步後更新</p>
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
                        ? "border-amber-300 bg-amber-50 text-amber-700"
                        : ignition.engagementLeadScore > 0
                          ? "border-teal-300 bg-teal-50 text-teal-700"
                          : "border-gray-300 bg-gray-50 text-gray-600"
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
                        stroke="#E5E7EB"
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
                              <p className="text-amber-600">
                                互動：{data.engagementPct.toFixed(1)}%
                              </p>
                              <p className="text-teal-600">
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
                        stroke="#F59E0B"
                        strokeWidth={2}
                        dot={false}
                      />
                      {/* 曝光增量（青色） */}
                      <Line
                        type="monotone"
                        dataKey="viewsPct"
                        stroke="#14B8A6"
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

// 根據強度取得顏色
function getHeatmapColor(intensity: number): string {
  if (intensity <= 0) return "#F3F4F6"; // gray-100
  if (intensity < 0.2) return "#FEF3C7"; // amber-100
  if (intensity < 0.4) return "#FDE68A"; // amber-200
  if (intensity < 0.6) return "#FCD34D"; // amber-300
  if (intensity < 0.8) return "#FBBF24"; // amber-400
  return "#F59E0B"; // amber-500
}

// 熱力圖類型標籤設定
const HEAT_TYPE_CONFIG = {
  early: { label: "早熱", color: "text-amber-600" },
  slow: { label: "慢熱", color: "text-blue-600" },
  steady: { label: "穩定", color: "text-gray-500" },
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

  // 所有貼文都顯示（有資料的顯示熱力格，沒資料的顯示等待提示）
  const allPostsWithMeta = posts
    .map((post) => ({
      ...post,
      postText: post.text.length > 12 ? post.text.slice(0, 12) + "..." : post.text || "(無文字)",
      hasEnoughData: post.heatmap && post.heatmap.cells.length === 12,
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
            // 資料不足時顯示等待提示列
            if (!post.hasEnoughData) {
              return (
                <div key={post.id} className="flex items-center">
                  {/* 貼文名稱 */}
                  <div className="w-28 shrink-0 truncate pr-2 text-sm text-muted-foreground" title={post.postText}>
                    {post.postText}
                  </div>

                  {/* 等待中的灰色格子 */}
                  <div className="flex flex-1 gap-0.5">
                    {TIME_BUCKET_LABELS.map((_, i) => (
                      <div key={i} className="flex-1">
                        <div className="h-6 w-full rounded-sm bg-gray-100" />
                      </div>
                    ))}
                  </div>

                  {/* 等待中標籤 */}
                  <div className="w-20 shrink-0 text-center text-xs text-muted-foreground">
                    <Clock className="inline size-3 mr-0.5" />
                    等待中
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
                      post.viralityLevel === "viral" && "font-semibold text-red-600",
                      post.viralityLevel === "excellent" && "font-medium text-amber-600"
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
                        className="h-6 w-full rounded-sm transition-all hover:ring-2 hover:ring-amber-400"
                        style={{ backgroundColor: getHeatmapColor(cell.intensity) }}
                      />
                      {/* Tooltip */}
                      <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-xs text-white group-hover:block">
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

// 根據象限位置決定顏色（曝光 vs 傳播力）
function getQuadrantColor(
  x: number,
  y: number,
  avgX: number,
  avgY: number
): string {
  if (x >= avgX && y >= avgY) return "#10B981"; // 右上：高曝光 + 高傳播力 = 明星貼文 - Emerald
  if (x < avgX && y >= avgY) return "#8B5CF6"; // 左上：低曝光 + 高傳播力 = 潛力股 - Violet
  if (x >= avgX && y < avgY) return "#F59E0B"; // 右下：高曝光 + 低傳播力 = 觸及廣但沒共鳴 - Amber
  return "#6B7280"; // 左下：低曝光 + 低傳播力 = 待觀察 - Gray
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
            <div className="size-2 rounded-full bg-emerald-500" />
            <span>明星貼文</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-violet-500" />
            <span>潛力股</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-amber-500" />
            <span>觸及廣</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-gray-500" />
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
                stroke="#CBD5E1"
                strokeWidth={1.5}
              />
              <ReferenceLine
                y={midY}
                stroke="#CBD5E1"
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
              <Scatter data={data} fill="#14B8A6">
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
  if (x >= midX && y >= RHAT_THRESHOLD) return "#3B82F6"; // 右上：大規模擴散中 - Blue
  if (x < midX && y >= RHAT_THRESHOLD) return "#10B981"; // 左上：剛開始擴散 - Emerald
  if (x >= midX && y < RHAT_THRESHOLD) return "#8B5CF6"; // 右下：已達峰值 - Violet
  return "#6B7280"; // 左下：未能引起關注 - Gray
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
            <div className="size-2 rounded-full bg-blue-500" />
            <span>大規模擴散</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-emerald-500" />
            <span>剛開始擴散</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-violet-500" />
            <span>已達峰值</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="size-2 rounded-full bg-gray-500" />
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
              <ReferenceLine x={midX} stroke="#CBD5E1" strokeWidth={1.5} />
              {/* 擴散動態 = 1.0 臨界線 */}
              <ReferenceLine
                y={RHAT_THRESHOLD}
                stroke="#EF4444"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: "臨界值 1.0",
                  position: "right",
                  fontSize: 10,
                  fill: "#DC2626",
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
              <Scatter data={data} fill="#14B8A6">
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
      className: "bg-red-100 text-red-700 border-red-200",
    },
    early: {
      label: "早期",
      icon: "⏰",
      className: "bg-amber-100 text-amber-700 border-amber-200",
    },
    tracking: {
      label: "追蹤中",
      icon: "📊",
      className: "bg-gray-100 text-gray-600 border-gray-200",
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
    warning: "bg-red-50 border-red-200",
    success: "bg-teal-50 border-teal-200",
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

function AlertBanner({ alerts, onDismiss }: { alerts: PageAlert[]; onDismiss: (id: string) => void }) {
  if (alerts.length === 0) return null;

  const alertConfig = {
    viral: {
      icon: Flame,
      className: "bg-red-50 border-red-200 text-red-800",
    },
    excellent: {
      icon: Star,
      className: "bg-amber-50 border-amber-200 text-amber-800",
    },
    fast: {
      icon: Zap,
      className: "bg-teal-50 border-teal-200 text-teal-800",
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
                <TableHead className="w-36">互動</TableHead>
                <TableHead className="w-32">傳播力</TableHead>
                <TableHead className="w-20 text-center" title="擴散動態：需累積約 45 分鐘數據">擴散</TableHead>
                <TableHead className="w-28">趨勢</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-6 w-36" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-8 w-24" /></TableCell>
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
              <TableHead className="w-36">互動</TableHead>
              <TableHead className="w-32">傳播力</TableHead>
              <TableHead className="w-20 text-center" title="擴散動態：需累積約 45 分鐘數據">擴散</TableHead>
              <TableHead className="w-28">趨勢</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {posts.map((post) => (
              <TableRow
                key={post.id}
                className={cn(
                  post.viralityLevel === "viral" && "bg-red-50/50",
                  post.viralityLevel === "excellent" && "bg-amber-50/50"
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
                  <TimeStatusBadge status={post.timeStatus} />
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatRelativeTime(post.ageMinutes)}
                </TableCell>
                <TableCell className="text-right">
                  {post.views === 0 && (post.likes + post.replies + post.reposts + post.quotes) > 0 ? (
                    <span className="text-xs text-amber-600" title="Threads API 延遲，曝光數尚未更新">
                      <Clock className="inline size-3 mr-0.5" />
                      計算中
                    </span>
                  ) : (
                    <span className="font-mono">{formatNumber(post.views)}</span>
                  )}
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
                  />
                </TableCell>
                <TableCell className="text-center">
                  <DiffusionStatusIcon diffusion={post.diffusion} />
                </TableCell>
                <TableCell>
                  <MiniTrendChart data={post.trend} />
                </TableCell>
              </TableRow>
            ))}
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
  const [alerts, setAlerts] = useState<PageAlert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [sortBy, setSortBy] = useState<SortOption>("latest");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [hasNoAccounts, setHasNoAccounts] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(() => {
    // 從 localStorage 讀取，預設不開啟
    if (typeof window !== "undefined") {
      return localStorage.getItem("radar-auto-refresh") === "true";
    }
    return false;
  });

  // 儲存自動同步狀態到 localStorage
  useEffect(() => {
    localStorage.setItem("radar-auto-refresh", autoRefresh.toString());
  }, [autoRefresh]);

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

  // 計算上次刷新時間
  const secondsSinceRefresh = Math.floor(
    (new Date().getTime() - lastRefresh.getTime()) / 1000
  );

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
              icon={<Flame className="size-5 text-red-500" />}
              variant={summary.goldenPosts > 0 ? "warning" : "default"}
              isLoading={isLoading}
            />
            <SummaryCard
              title="早期觀察"
              value={summary.earlyPosts}
              icon={<Clock className="size-5 text-amber-500" />}
              isLoading={isLoading}
            />
            <SummaryCard
              title="爆紅潛力"
              value={summary.viralPotential}
              icon={<Star className="size-5 text-amber-500" />}
              variant={summary.viralPotential > 0 ? "success" : "default"}
              isLoading={isLoading}
            />
          </div>

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
