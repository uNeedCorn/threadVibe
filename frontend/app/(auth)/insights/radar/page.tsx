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
  ZAxis,
  Cell,
  ReferenceLine,
  XAxis,
  YAxis,
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
type SortOption = "latest" | "virality" | "engagement" | "views";
type FilterOption = "all" | "golden" | "early" | "tracking" | "viral";

interface TrendPoint {
  timestamp: number;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  viralityScore: number;
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

function TimeStatusBadge({ status }: { status: TimeStatus }) {
  const config = {
    golden: {
      label: "黃金期",
      className: "bg-red-100 text-red-700 border-red-200 animate-pulse",
      icon: Flame,
    },
    early: {
      label: "早期",
      className: "bg-amber-100 text-amber-700 border-amber-200",
      icon: Clock,
    },
    tracking: {
      label: "追蹤中",
      className: "bg-teal-100 text-teal-700 border-teal-200",
      icon: Eye,
    },
  };

  const { label, className, icon: Icon } = config[status];

  return (
    <Badge variant="outline" className={cn("gap-1", className)}>
      <Icon className="size-3" />
      {label}
    </Badge>
  );
}

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

// 四象限圖表資料點
interface QuadrantDataPoint {
  postId: string;
  postText: string;
  x: number; // 轉貼率 (repost rate)
  y: number; // 讚+留言率 (like + reply rate)
  z: number; // 曝光數 (views) - 用於氣泡大小
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  viralityLevel: ViralityLevel;
}

// 計算四象限資料
function calculateQuadrantData(posts: TrackingPost[]): {
  data: QuadrantDataPoint[];
  midX: number;
  midY: number;
  avgX: number;
  avgY: number;
  maxX: number;
  maxY: number;
} {
  const data: QuadrantDataPoint[] = posts
    .filter((post) => post.views > 0)
    .map((post) => {
      const repostRate = (post.reposts / post.views) * 100;
      const likeReplyRate = ((post.likes + post.replies) / post.views) * 100;

      return {
        postId: post.id,
        postText:
          post.text.length > 20 ? post.text.slice(0, 20) + "..." : post.text || "(無文字)",
        x: Math.round(repostRate * 100) / 100,
        y: Math.round(likeReplyRate * 100) / 100,
        z: post.views,
        views: post.views,
        likes: post.likes,
        replies: post.replies,
        reposts: post.reposts,
        viralityLevel: post.viralityLevel,
      };
    });

  // 計算軸範圍，分界線固定在中央
  const maxX = data.length > 0 ? Math.max(...data.map((d) => d.x)) : 1;
  const maxY = data.length > 0 ? Math.max(...data.map((d) => d.y)) : 1;
  const midX = maxX / 2;
  const midY = maxY / 2;

  // 計算平均值（用虛線標示）
  const avgX = data.length > 0 ? data.reduce((sum, d) => sum + d.x, 0) / data.length : 0;
  const avgY = data.length > 0 ? data.reduce((sum, d) => sum + d.y, 0) / data.length : 0;

  return { data, midX, midY, avgX, avgY, maxX, maxY };
}

// 根據象限位置決定顏色
function getQuadrantColor(
  x: number,
  y: number,
  avgX: number,
  avgY: number
): string {
  if (x >= avgX && y >= avgY) return "#10B981"; // 右上：高互動高擴散 - Emerald
  if (x < avgX && y >= avgY) return "#3B82F6"; // 左上：高互動低擴散 - Blue
  if (x >= avgX && y < avgY) return "#F59E0B"; // 右下：低互動高擴散 - Amber
  return "#6B7280"; // 左下：低互動低擴散 - Gray
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

  const { data, midX, midY, avgX, avgY, maxX, maxY } = calculateQuadrantData(posts);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="size-5" />
            貼文表現四象限
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

  // 計算 Z 軸範圍（氣泡大小）
  const maxViews = Math.max(...data.map((d) => d.z));
  const minViews = Math.min(...data.map((d) => d.z));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Eye className="size-5" />
            貼文表現四象限
          </CardTitle>
          <div className="flex gap-4 text-xs">
            <div className="flex items-center gap-1.5">
              <div className="size-3 rounded-full bg-emerald-500" />
              <span>高互動高擴散</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-3 rounded-full bg-blue-500" />
              <span>高互動低擴散</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-3 rounded-full bg-amber-500" />
              <span>低互動高擴散</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="size-3 rounded-full bg-gray-500" />
              <span>待優化</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                type="number"
                dataKey="x"
                name="轉貼率"
                unit="%"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                label={{
                  value: "轉貼率 (%)",
                  position: "bottom",
                  offset: 0,
                  fontSize: 12,
                }}
              />
              <YAxis
                type="number"
                dataKey="y"
                name="讚+留言率"
                unit="%"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                label={{
                  value: "讚+留言率 (%)",
                  angle: -90,
                  position: "left",
                  offset: 10,
                  fontSize: 12,
                }}
              />
              <ZAxis
                type="number"
                dataKey="z"
                range={[100, 1000]}
                domain={[minViews, maxViews]}
                name="曝光數"
              />
              {/* 中央分界線（實線） */}
              <ReferenceLine x={midX} stroke="#CBD5E1" strokeWidth={1} />
              <ReferenceLine y={midY} stroke="#CBD5E1" strokeWidth={1} />
              {/* 平均值線（虛線） */}
              <ReferenceLine
                x={avgX}
                stroke="#F59E0B"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `平均 ${avgX.toFixed(2)}%`,
                  position: "top",
                  fontSize: 10,
                  fill: "#D97706",
                }}
              />
              <ReferenceLine
                y={avgY}
                stroke="#F59E0B"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: `平均 ${avgY.toFixed(2)}%`,
                  position: "right",
                  fontSize: 10,
                  fill: "#D97706",
                }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const d = payload[0].payload as QuadrantDataPoint;
                  return (
                    <div className="rounded-lg border bg-background p-3 shadow-lg">
                      <p className="mb-2 font-medium">{d.postText}</p>
                      <div className="space-y-1 text-sm">
                        <p className="flex justify-between gap-4">
                          <span className="text-muted-foreground">曝光數</span>
                          <span className="font-mono">{formatNumber(d.views)}</span>
                        </p>
                        <p className="flex justify-between gap-4">
                          <span className="text-muted-foreground">讚</span>
                          <span className="font-mono">{formatNumber(d.likes)}</span>
                        </p>
                        <p className="flex justify-between gap-4">
                          <span className="text-muted-foreground">留言</span>
                          <span className="font-mono">{formatNumber(d.replies)}</span>
                        </p>
                        <p className="flex justify-between gap-4">
                          <span className="text-muted-foreground">轉貼</span>
                          <span className="font-mono">{formatNumber(d.reposts)}</span>
                        </p>
                        <hr className="my-1" />
                        <p className="flex justify-between gap-4">
                          <span className="text-muted-foreground">轉貼率</span>
                          <span className="font-mono">{d.x.toFixed(2)}%</span>
                        </p>
                        <p className="flex justify-between gap-4">
                          <span className="text-muted-foreground">讚+留言率</span>
                          <span className="font-mono">{d.y.toFixed(2)}%</span>
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
                    fillOpacity={0.7}
                    stroke={getQuadrantColor(entry.x, entry.y, midX, midY)}
                    strokeWidth={1}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        {/* 說明文字 */}
        <p className="mt-2 text-center text-xs text-muted-foreground">
          氣泡大小代表曝光數 · 灰色實線為中央分界 · 橙色虛線為平均值
        </p>
      </CardContent>
    </Card>
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
                <TableHead className="w-20">狀態</TableHead>
                <TableHead>貼文內容</TableHead>
                <TableHead className="w-24">發布時間</TableHead>
                <TableHead className="w-20 text-right">曝光</TableHead>
                <TableHead className="w-32">傳播力</TableHead>
                <TableHead className="w-20 text-right">互動率</TableHead>
                <TableHead className="w-20 text-right">轉發率</TableHead>
                <TableHead className="w-28">趨勢</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-6 w-12" /></TableCell>
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
              <TableHead className="w-20">狀態</TableHead>
              <TableHead>貼文內容</TableHead>
              <TableHead className="w-24">發布時間</TableHead>
              <TableHead className="w-20 text-right">曝光</TableHead>
              <TableHead className="w-32">傳播力</TableHead>
              <TableHead className="w-20 text-right">互動率</TableHead>
              <TableHead className="w-20 text-right">轉發率</TableHead>
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
                  <TimeStatusBadge status={post.timeStatus} />
                </TableCell>
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
                      {post.text.length > 50
                        ? post.text.slice(0, 50) + "..."
                        : post.text || "(無文字)"}
                    </p>
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {formatRelativeTime(post.ageMinutes)}
                </TableCell>
                <TableCell className="text-right font-mono">
                  {formatNumber(post.views)}
                </TableCell>
                <TableCell>
                  <ViralityBadge
                    score={post.viralityScore}
                    level={post.viralityLevel}
                  />
                </TableCell>
                <TableCell className="text-right font-mono">
                  {post.engagementRate.toFixed(2)}%
                </TableCell>
                <TableCell className="text-right font-mono">
                  {post.repostRate.toFixed(2)}%
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
    if (!selectedAccountId) return;

    const interval = setInterval(() => {
      loadData();
    }, 60 * 1000);

    return () => clearInterval(interval);
  }, [selectedAccountId, loadData]);

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
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            上次更新：{secondsSinceRefresh} 秒前
          </span>
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

          {/* 貼文表現四象限 */}
          <QuadrantChart posts={posts} isLoading={isLoading} />

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
