"use client";

import { useState, useEffect } from "react";
import { TrendingUp, Eye, MessageSquare, Heart, Repeat2, Quote, TrendingDown } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell, LabelList, PieChart, Pie, LineChart, Line, ResponsiveContainer } from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useSelectedAccount } from "@/hooks/use-selected-account";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Period = "week" | "month";

interface AccountData {
  username: string;
  name: string | null;
  profilePicUrl: string | null;
  currentFollowers: number;
  followersGrowth: number;
}

interface KPIData {
  // 曝光
  totalViews: number;
  viewsGrowth: number;
  // 互動
  totalLikes: number;
  likesGrowth: number;
  totalReplies: number;
  repliesGrowth: number;
  totalReposts: number;
  repostsGrowth: number;
  totalQuotes: number;
  quotesGrowth: number;
  totalInteractions: number;
  interactionsGrowth: number;
  engagementRate: number;
  engagementGrowth: number;
  // 貼文
  postsCount: number;
  postsGrowth: number;
}

interface BenchmarkData {
  avgEngagementRate: number;   // 全時間平均互動率
  avgPostsPerWeek: number;     // 平均每週發文數
  avgPostsPerMonth: number;    // 平均每月發文數
  avgViewsPerWeek: number;     // 平均每週曝光數
  avgViewsPerMonth: number;    // 平均每月曝光數
  avgInteractionsPerWeek: number;   // 平均每週互動數
  avgInteractionsPerMonth: number;  // 平均每月互動數
  avgLikesPerWeek: number;     // 平均每週讚數
  avgLikesPerMonth: number;    // 平均每月讚數
  avgRepliesPerWeek: number;   // 平均每週回覆數
  avgRepliesPerMonth: number;  // 平均每月回覆數
  avgRepostsPerWeek: number;   // 平均每週轉發數
  avgRepostsPerMonth: number;  // 平均每月轉發數
  avgQuotesPerWeek: number;    // 平均每週引用數
  avgQuotesPerMonth: number;   // 平均每月引用數
  totalPosts: number;          // 全時間貼文數（用於判斷是否足夠）
}

interface PostCountDataPoint {
  label: string;
  count: number;
}

interface TagViewsDataPoint {
  label: string;
  views: number;
  fill: string;
}

interface HeatmapCell {
  day: number;      // 0-6 (週日-週六)
  hour: number;     // 0-23
  views: number;    // 總曝光數
  count: number;    // 貼文數
}

interface PostContribution {
  postId: string;
  text: string;           // 貼文摘要
  views: number;
  interactions: number;
  engagementRate: number;
}

interface TrendDataPoint {
  timestamp: number;      // Unix timestamp
  label: string;          // 顯示標籤（小時或日期）
  dateLabel?: string;     // 日期標籤（週模式在 0 點顯示）
  views: number;          // 曝光數
  interactions: number;   // 互動數（讚+回覆+轉發+引用）
  engagementRate: number; // 互動率
  postCount: number;      // 該時段貼文數（用於計算平均）
  postDetails: PostContribution[]; // 各貼文的貢獻明細
}

// 週的天數標籤
const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

// 時段標籤（顯示關鍵時間點）
const HOUR_LABELS_24 = [0, 6, 12, 18];

// Zenivy Teal 色階（從深到淺）
const TEAL_SHADES = [
  "#0F766E", // Teal 700 - 最深
  "#0D9488", // Teal 600
  "#14B8A6", // Teal 500 - 主色
  "#2DD4BF", // Teal 400
  "#5EEAD4", // Teal 300
  "#99F6E4", // Teal 200
  "#CCFBF1", // Teal 100
  "#F0FDFA", // Teal 50 - 最淺
];

// 圖表配置 - 使用系統主色
const postCountChartConfig: ChartConfig = {
  count: {
    label: "發文數",
    color: "#14B8A6",
  },
};

const tagViewsChartConfig: ChartConfig = {
  views: {
    label: "曝光數",
  },
};

const trendChartConfig: ChartConfig = {
  views: {
    label: "曝光數",
    color: "#14B8A6", // Teal 500
  },
  interactions: {
    label: "互動數",
    color: "#0D9488", // Teal 600
  },
  engagementRate: {
    label: "互動率",
    color: "#F59E0B", // Amber 500
  },
};

// 根據索引取得 Teal 色階顏色
function getBarColor(index: number, total: number): string {
  if (total <= 1) return TEAL_SHADES[2]; // Teal 500
  // 將索引映射到色階陣列
  const shadeIndex = Math.min(
    Math.floor((index / total) * TEAL_SHADES.length),
    TEAL_SHADES.length - 1
  );
  return TEAL_SHADES[shadeIndex];
}

// 根據曝光數取得熱力圖顏色（曝光越高越深）
function getHeatmapColor(views: number, maxViews: number): string {
  if (views === 0 || maxViews === 0) return "#F5F5F4"; // Stone 100 - 無資料
  // 計算比例，映射到色階（反轉：曝光高 = 深色）
  const ratio = views / maxViews;
  const shadeIndex = Math.min(
    Math.floor((1 - ratio) * (TEAL_SHADES.length - 1)),
    TEAL_SHADES.length - 1
  );
  return TEAL_SHADES[shadeIndex];
}

function GrowthBadge({ value, className }: { value: number; className?: string }) {
  if (value === 0) return null;

  const isPositive = value > 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        isPositive ? "text-green-600" : "text-red-600",
        className
      )}
    >
      {isPositive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {isPositive ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

function formatNumber(v: number) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return v.toLocaleString();
}

// 解析 Supabase 返回的 timestamp 格式 "2026-01-13 09:00:00+00"
// 轉換為標準 ISO 格式供 Date 解析
function parseTimestamp(ts: string): Date {
  // 將 "2026-01-13 09:00:00+00" 轉換為 "2026-01-13T09:00:00+00:00"
  const normalized = ts.replace(" ", "T").replace(/\+(\d{2})$/, "+$1:00");
  return new Date(normalized);
}

function AccountProfileCard({
  account,
  isLoading,
  periodLabel,
}: {
  account: AccountData | null;
  isLoading: boolean;
  periodLabel: string;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Skeleton className="size-16 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-24" />
              <div className="mt-4">
                <Skeleton className="h-12 w-32" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!account) return null;

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {/* 頭貼 */}
          <Avatar className="size-16">
            <AvatarImage src={account.profilePicUrl || undefined} alt={account.username} />
            <AvatarFallback className="text-lg">
              {account.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1">
            {/* 帳號名稱 */}
            <div>
              <h2 className="text-lg font-semibold">
                {account.name || account.username}
              </h2>
              <p className="text-sm text-muted-foreground">@{account.username}</p>
            </div>

            {/* 追蹤數 */}
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">追蹤者</p>
              {account.currentFollowers === 0 ? (
                <div className="mt-1">
                  <span className="text-2xl font-bold text-muted-foreground">--</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    追蹤數需達到 100 才能顯示，請加油！
                  </p>
                </div>
              ) : (
                <>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold">
                      {formatNumber(account.currentFollowers)}
                    </span>
                    <GrowthBadge value={account.followersGrowth} />
                  </div>
                  {account.followersGrowth !== 0 && (
                    <p className="text-xs text-muted-foreground">vs {periodLabel}</p>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BenchmarkBadge({
  currentValue,
  benchmarkValue,
  totalPosts,
  minPosts = 10,
}: {
  currentValue: number;
  benchmarkValue: number;
  totalPosts: number;
  minPosts?: number;
}) {
  // 貼文數不足時不顯示
  if (totalPosts < minPosts) return null;
  if (benchmarkValue === 0) return null;

  const diff = ((currentValue - benchmarkValue) / benchmarkValue) * 100;
  const isAbove = diff > 0;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 text-xs font-medium",
        isAbove ? "text-blue-600" : "text-orange-600"
      )}
    >
      {isAbove ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {isAbove ? "高於" : "低於"}基準 {Math.abs(diff).toFixed(1)}%
    </span>
  );
}

function KPICard({
  title,
  value,
  growth,
  icon,
  isLoading,
  format = "number",
  periodLabel,
  benchmark,
}: {
  title: string;
  value: number;
  growth?: number;
  icon: React.ReactNode;
  isLoading?: boolean;
  format?: "number" | "percent";
  periodLabel: string;
  benchmark?: {
    value: number;
    totalPosts: number;
  };
}) {
  const formatValue = (v: number) => {
    if (format === "percent") return `${v.toFixed(2)}%`;
    return formatNumber(v);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="size-4" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-8 w-24" />
          <Skeleton className="mt-1 h-3 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{formatValue(value)}</div>
        {growth !== undefined && (
          <div className="flex items-center gap-1">
            <GrowthBadge value={growth} />
            {growth !== 0 && (
              <span className="text-xs text-muted-foreground">vs {periodLabel}</span>
            )}
          </div>
        )}
        {benchmark && (
          <div className="mt-1">
            <BenchmarkBadge
              currentValue={value}
              benchmarkValue={benchmark.value}
              totalPosts={benchmark.totalPosts}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PostCountChart({
  data,
  isLoading,
  periodTitle,
}: {
  data: PostCountDataPoint[];
  isLoading: boolean;
  periodTitle: string;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasData = data.length > 0 && data.some((d) => d.count > 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{periodTitle}發文分類統計</CardTitle>
        <p className="text-xs text-muted-foreground">
          一篇貼文可能有多個標籤，因此各標籤數量總和可能大於發文總數
        </p>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            {periodTitle}尚無已標籤的發文
          </div>
        ) : (
          <ChartContainer config={postCountChartConfig} className="h-[200px] w-full">
            <BarChart data={data} margin={{ left: 0, right: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                allowDecimals={false}
                width={30}
              />
              <ChartTooltip
                cursor={{ fill: "#E7E5E4", opacity: 0.5 }}
                content={<ChartTooltipContent />}
              />
              <Bar
                dataKey="count"
                radius={[4, 4, 0, 0]}
              >
                {data.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={getBarColor(index, data.length)}
                  />
                ))}
                <LabelList
                  dataKey="count"
                  position="top"
                  className="fill-foreground"
                  fontSize={12}
                />
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}

function TagViewsPieChart({
  data,
  isLoading,
  periodTitle,
}: {
  data: TagViewsDataPoint[];
  isLoading: boolean;
  periodTitle: string;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[200px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasData = data.length > 0 && data.some((d) => d.views > 0);
  const totalViews = data.reduce((sum, d) => sum + d.views, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{periodTitle}曝光數佔比</CardTitle>
        <p className="text-xs text-muted-foreground">
          各標籤貼文的曝光數分佈
        </p>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-[200px] items-center justify-center text-muted-foreground">
            尚無曝光資料
          </div>
        ) : (
          <div className="flex items-center gap-6">
            <ChartContainer config={tagViewsChartConfig} className="h-[200px] flex-1">
              <PieChart>
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => `${formatNumber(value as number)} 曝光`}
                    />
                  }
                />
                <Pie
                  data={data}
                  dataKey="views"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                />
              </PieChart>
            </ChartContainer>
            {/* 圖例 */}
            <div className="flex flex-col gap-2 text-sm">
              {data.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <div
                    className="size-3 shrink-0 rounded-full"
                    style={{ backgroundColor: item.fill }}
                  />
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="ml-auto font-medium">
                    {totalViews > 0 ? ((item.views / totalViews) * 100).toFixed(0) : 0}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PostingHeatmap({
  data,
  isLoading,
  periodTitle,
}: {
  data: HeatmapCell[];
  isLoading: boolean;
  periodTitle: string;
}) {
  // 計算最大發文數（用於顏色計算）
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  // 取得特定時段的資料
  const getCell = (day: number, hour: number): HeatmapCell | undefined => {
    return data.find((d) => d.day === day && d.hour === hour);
  };

  if (isLoading) {
    return (
      <Card className="h-full gap-0 py-0">
        <CardHeader className="gap-0 px-4 py-2">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className="px-4 pb-2 pt-0">
          <Skeleton className="h-[100px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasData = data.some((d) => d.count > 0);

  return (
    <Card className="h-full gap-0 overflow-visible py-0">
      <CardHeader className="gap-0 px-4 py-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{periodTitle}發文時間表</CardTitle>
      </CardHeader>
      <CardContent className="overflow-visible px-4 pb-2 pt-0">
        {!hasData ? (
          <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">
            尚無發文資料
          </div>
        ) : (
          <div className="overflow-visible">
            <div>
              {/* 時段標籤 */}
              <div className="mb-0.5 flex">
                <div className="w-5 shrink-0" /> {/* 空白對齊 */}
                <div className="flex flex-1">
                  {Array.from({ length: 24 }, (_, i) => (
                    <div
                      key={i}
                      className="flex-1 text-center text-[8px] text-muted-foreground"
                    >
                      {HOUR_LABELS_24.includes(i) ? i : ""}
                    </div>
                  ))}
                </div>
              </div>

              {/* 熱力圖網格 */}
              {WEEKDAY_LABELS.map((dayLabel, dayIndex) => (
                <div key={dayIndex} className="flex items-center mb-px">
                  {/* 星期標籤 */}
                  <div className="w-5 shrink-0 text-[8px] text-muted-foreground text-right pr-0.5">
                    {dayLabel}
                  </div>

                  {/* 24 小時格子 */}
                  <div className="flex flex-1 gap-px">
                    {Array.from({ length: 24 }, (_, hour) => {
                      const cell = getCell(dayIndex, hour);
                      const count = cell?.count || 0;
                      const views = cell?.views || 0;
                      const bgColor = getHeatmapColor(count, maxCount);

                      return (
                        <div
                          key={hour}
                          className="group relative flex-1 h-5 rounded-[2px] cursor-default transition-transform hover:scale-110 hover:z-10"
                          style={{ backgroundColor: bgColor }}
                        >
                          {/* Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-[100] pointer-events-none">
                            <div className="bg-popover text-popover-foreground text-xs rounded-md px-2 py-1 shadow-lg whitespace-nowrap border">
                              <div className="font-medium">{hour}:00</div>
                              <div>{count} 篇貼文</div>
                              <div>{views.toLocaleString()} 曝光</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* 圖例 */}
              <div className="mt-2 flex items-center justify-end gap-1.5 text-[8px] text-muted-foreground">
                <span>少</span>
                <div className="flex gap-px">
                  {[...TEAL_SHADES].reverse().map((color, i) => (
                    <div
                      key={i}
                      className="w-2 h-2 rounded-[1px]"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <span>多</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TrendLineChart({
  data,
  isLoading,
  periodTitle,
  period,
}: {
  data: TrendDataPoint[];
  isLoading: boolean;
  periodTitle: string;
  period: Period;
}) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const hasData = data.length > 0 && data.some((d) => d.views > 0 || d.interactions > 0);

  // 計算最大值用於 Y 軸
  const maxViews = Math.max(...data.map((d) => d.views), 1);
  const maxEngagement = Math.max(...data.map((d) => d.engagementRate), 1);

  // 自訂 X 軸 tick（週模式每 6 小時顯示一次，月模式每 5 天顯示一次）
  const getXAxisTicks = () => {
    if (period === "week") {
      // 每天的 0, 6, 12, 18 點
      return data
        .filter((d) => {
          const hour = new Date(d.timestamp).getHours();
          return hour === 0 || hour === 6 || hour === 12 || hour === 18;
        })
        .map((d) => d.timestamp);
    } else {
      // 每 5 天
      return data.filter((_, i) => i % 5 === 0).map((d) => d.timestamp);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{periodTitle}成效趨勢</CardTitle>
        <p className="text-xs text-muted-foreground">
          所有貼文的累積曝光數與互動率變化
        </p>
      </CardHeader>
      <CardContent>
        {!hasData ? (
          <div className="flex h-[300px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <p>{periodTitle}尚無趨勢資料</p>
            <p className="text-xs">需要同步貼文成效才能顯示趨勢圖</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* 圖例 */}
            <div className="flex items-center justify-end gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-4 rounded" style={{ backgroundColor: "#14B8A6" }} />
                <span className="text-muted-foreground">曝光數</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-0.5 w-4 rounded" style={{ backgroundColor: "#F59E0B" }} />
                <span className="text-muted-foreground">互動率</span>
              </div>
            </div>

            <ChartContainer config={trendChartConfig} className="h-[280px] w-full">
              <LineChart data={data} margin={{ left: 0, right: 0, top: 10, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="timestamp"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  ticks={getXAxisTicks()}
                  tickLine={false}
                  axisLine={false}
                  tick={(props) => {
                    const { x, y, payload } = props;
                    const value = payload.value;
                    const date = new Date(value);
                    const hour = date.getHours();

                    if (period === "week") {
                      // 日期固定在上方（dy=10），小時固定在下方（dy=24）
                      return (
                        <g transform={`translate(${x},${y})`}>
                          {hour === 0 && (
                            <text x={0} y={0} dy={10} textAnchor="middle" fontSize={9} fill="#a1a1aa">
                              {`${date.getMonth() + 1}/${date.getDate()}`}
                            </text>
                          )}
                          <text x={0} y={0} dy={24} textAnchor="middle" fontSize={10} fill="#71717a">
                            {`${hour}時`}
                          </text>
                        </g>
                      );
                    }
                    // 月模式
                    const point = data.find((d) => d.timestamp === value);
                    return (
                      <g transform={`translate(${x},${y})`}>
                        <text x={0} y={0} dy={14} textAnchor="middle" fontSize={10} fill="#71717a">
                          {point?.label || ""}
                        </text>
                      </g>
                    );
                  }}
                  height={40}
                />
                {/* 左側 Y 軸 - 曝光/互動數 */}
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={4}
                  width={45}
                  tickFormatter={(value) => formatNumber(value)}
                  fontSize={10}
                  domain={[0, maxViews * 1.1]}
                />
                {/* 右側 Y 軸 - 互動率 */}
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
                    const date = new Date(point.timestamp);
                    const timeLabel = period === "week"
                      ? `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`
                      : point.label;

                    return (
                      <div className="rounded-lg border bg-background p-3 shadow-lg">
                        <div className="mb-2 font-medium">{timeLabel}</div>
                        <div className="space-y-1 text-sm">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">曝光數</span>
                            <span className="font-medium">{formatNumber(point.views)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-muted-foreground">互動率</span>
                            <span className="font-medium">{point.engagementRate.toFixed(2)}%</span>
                          </div>
                        </div>
                        {point.postDetails.length > 0 && (
                          <>
                            <div className="my-2 border-t" />
                            <div className="text-xs text-muted-foreground mb-1">貼文明細（按曝光排序）</div>
                            <div className="space-y-1.5 max-h-40 overflow-y-auto">
                              {point.postDetails.slice(0, 3).map((post) => (
                                <div key={post.postId} className="text-xs">
                                  <div className="truncate text-muted-foreground">{post.text}</div>
                                  <div className="flex gap-3 text-foreground">
                                    <span>曝光 {formatNumber(post.views)}</span>
                                    <span>互動率 {post.engagementRate.toFixed(2)}%</span>
                                  </div>
                                </div>
                              ))}
                              {point.postDetails.length > 3 && (
                                <div className="text-xs text-muted-foreground">
                                  ...還有 {point.postDetails.length - 3} 篇貼文
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  }}
                />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="views"
                  stroke="#14B8A6"
                  strokeWidth={2}
                  dot={false}
                  name="曝光數"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="engagementRate"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={false}
                  name="互動率"
                />
              </LineChart>
            </ChartContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function InsightsOverviewPage() {
  const { selectedAccountId, isLoading: isAccountLoading } = useSelectedAccount();
  const [period, setPeriod] = useState<Period>("week");
  const [accountData, setAccountData] = useState<AccountData | null>(null);
  const [kpiData, setKpiData] = useState<KPIData | null>(null);
  const [benchmarkData, setBenchmarkData] = useState<BenchmarkData | null>(null);
  const [postCountData, setPostCountData] = useState<PostCountDataPoint[]>([]);
  const [tagViewsData, setTagViewsData] = useState<TagViewsDataPoint[]>([]);
  const [heatmapData, setHeatmapData] = useState<HeatmapCell[]>([]);
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNoAccounts, setHasNoAccounts] = useState(false);

  const periodLabel = period === "week" ? "上週" : "上月";
  const periodTitle = period === "week" ? "本週" : "本月";

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
        const now = new Date();
        let currentStart: Date;
        let previousStart: Date;
        let previousEnd: Date;

        // 取得本週日 00:00（日曆週以週日開始）
        const getStartOfWeek = (date: Date): Date => {
          const d = new Date(date);
          const day = d.getDay(); // 0 = 週日
          d.setDate(d.getDate() - day);
          d.setHours(0, 0, 0, 0);
          return d;
        };

        if (period === "week") {
          // 日曆週：本週日 00:00 ~ 現在
          currentStart = getStartOfWeek(now);
          // 上週：上週日 00:00 ~ 本週日 00:00
          previousEnd = currentStart;
          previousStart = new Date(currentStart.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else {
          currentStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          previousEnd = currentStart;
          previousStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
        }

        // 先取得該帳號的所有貼文 ID 和文字
        const { data: accountPosts } = await supabase
          .from("workspace_threads_posts")
          .select("id, text")
          .eq("workspace_threads_account_id", selectedAccountId);

        const postIds = accountPosts?.map((p) => p.id) || [];
        // 建立貼文 ID -> 文字摘要的對照表
        const postTextMap: Record<string, string> = {};
        accountPosts?.forEach((p) => {
          const text = p.text || "";
          postTextMap[p.id] = text.length > 20 ? text.slice(0, 20) + "..." : text;
        });

        // 並行查詢
        const [accountRes, currentPostsRes, previousPostsRes, insightsRes, allPostsRes, hourlyMetricsRes, dailyMetricsRes] = await Promise.all([
          // 帳號資料
          supabase
            .from("workspace_threads_accounts")
            .select("username, name, profile_pic_url, current_followers_count")
            .eq("id", selectedAccountId)
            .single(),
          // 當期貼文
          supabase
            .from("workspace_threads_posts")
            .select("id, published_at, current_views, current_likes, current_replies, current_reposts, current_quotes, engagement_rate, ai_selected_tags")
            .eq("workspace_threads_account_id", selectedAccountId)
            .gte("published_at", currentStart.toISOString()),
          // 上期貼文
          supabase
            .from("workspace_threads_posts")
            .select("id, current_views, current_likes, current_replies, current_reposts, current_quotes, engagement_rate")
            .eq("workspace_threads_account_id", selectedAccountId)
            .gte("published_at", previousStart.toISOString())
            .lt("published_at", previousEnd.toISOString()),
          // 帳號歷史 insights（取最舊的一筆作為上期對比）
          supabase
            .from("workspace_threads_account_insights_hourly")
            .select("followers_count, profile_views, bucket_ts")
            .eq("workspace_threads_account_id", selectedAccountId)
            .gte("bucket_ts", previousStart.toISOString())
            .lt("bucket_ts", previousEnd.toISOString())
            .order("bucket_ts", { ascending: true })
            .limit(1),
          // 全時間貼文（用於計算 benchmark）
          supabase
            .from("workspace_threads_posts")
            .select("engagement_rate, published_at, current_views, current_likes, current_replies, current_reposts, current_quotes")
            .eq("workspace_threads_account_id", selectedAccountId),
          // Hourly 資料（用於週趨勢圖，顯示累積值）
          // 加 limit 避免 Supabase 預設 1000 筆限制截斷資料
          period === "week" && postIds.length > 0
            ? supabase
                .from("workspace_threads_post_metrics_hourly")
                .select("workspace_threads_post_id, bucket_ts, views, likes, replies, reposts, quotes")
                .in("workspace_threads_post_id", postIds)
                .gte("bucket_ts", currentStart.toISOString())
                .order("bucket_ts", { ascending: true })
                .limit(10000)
            : Promise.resolve({ data: [] }),
          // Daily 資料（用於月趨勢圖，顯示累積值）
          // 加 limit 避免 Supabase 預設 1000 筆限制截斷資料
          period === "month" && postIds.length > 0
            ? supabase
                .from("workspace_threads_post_metrics_daily")
                .select("workspace_threads_post_id, bucket_date, views, likes, replies, reposts, quotes")
                .in("workspace_threads_post_id", postIds)
                .gte("bucket_date", currentStart.toISOString().split("T")[0])
                .order("bucket_date", { ascending: true })
                .limit(10000)
            : Promise.resolve({ data: [] }),
        ]);

        const account = accountRes.data;
        const currentPosts = currentPostsRes.data || [];
        const previousPosts = previousPostsRes.data || [];
        const allPosts = allPostsRes.data || [];
        const previousInsight = insightsRes.data?.[0];
        const hourlyMetrics = hourlyMetricsRes.data || [];
        const dailyMetrics = dailyMetricsRes.data || [];

        // 計算成長率
        const calcGrowth = (current: number, previous: number) => {
          if (previous === 0) return current > 0 ? 100 : 0;
          return ((current - previous) / previous) * 100;
        };

        // 帳號資料
        if (account) {
          const prevFollowers = previousInsight?.followers_count || account.current_followers_count;

          setAccountData({
            username: account.username,
            name: account.name,
            profilePicUrl: account.profile_pic_url,
            currentFollowers: account.current_followers_count || 0,
            followersGrowth: calcGrowth(account.current_followers_count || 0, prevFollowers),
          });
        }

        // 計算當期數據
        const totalViews = currentPosts.reduce((sum, p) => sum + (p.current_views || 0), 0);
        const totalLikes = currentPosts.reduce((sum, p) => sum + (p.current_likes || 0), 0);
        const totalReplies = currentPosts.reduce((sum, p) => sum + (p.current_replies || 0), 0);
        const totalReposts = currentPosts.reduce((sum, p) => sum + (p.current_reposts || 0), 0);
        const totalQuotes = currentPosts.reduce((sum, p) => sum + (p.current_quotes || 0), 0);
        const avgEngagement = currentPosts.length > 0
          ? currentPosts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / currentPosts.length
          : 0;

        // 計算當期總互動
        const totalInteractions = totalLikes + totalReplies + totalReposts + totalQuotes;

        // 計算上期數據
        const prevViews = previousPosts.reduce((sum, p) => sum + (p.current_views || 0), 0);
        const prevLikes = previousPosts.reduce((sum, p) => sum + (p.current_likes || 0), 0);
        const prevReplies = previousPosts.reduce((sum, p) => sum + (p.current_replies || 0), 0);
        const prevReposts = previousPosts.reduce((sum, p) => sum + (p.current_reposts || 0), 0);
        const prevQuotes = previousPosts.reduce((sum, p) => sum + (p.current_quotes || 0), 0);
        const prevInteractions = prevLikes + prevReplies + prevReposts + prevQuotes;
        const prevEngagement = previousPosts.length > 0
          ? previousPosts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / previousPosts.length
          : 0;

        setKpiData({
          totalViews,
          viewsGrowth: calcGrowth(totalViews, prevViews),
          totalLikes,
          likesGrowth: calcGrowth(totalLikes, prevLikes),
          totalReplies,
          repliesGrowth: calcGrowth(totalReplies, prevReplies),
          totalReposts,
          repostsGrowth: calcGrowth(totalReposts, prevReposts),
          totalQuotes,
          quotesGrowth: calcGrowth(totalQuotes, prevQuotes),
          totalInteractions,
          interactionsGrowth: calcGrowth(totalInteractions, prevInteractions),
          engagementRate: avgEngagement,
          engagementGrowth: calcGrowth(avgEngagement, prevEngagement),
          postsCount: currentPosts.length,
          postsGrowth: calcGrowth(currentPosts.length, previousPosts.length),
        });

        // 計算 Benchmark
        if (allPosts.length > 0) {
          // 計算時間跨度（週數和月數）
          const dates = allPosts
            .map((p) => p.published_at ? new Date(p.published_at).getTime() : 0)
            .filter((t) => t > 0);

          if (dates.length > 0) {
            const earliest = Math.min(...dates);
            const latest = Math.max(...dates);
            const daysDiff = Math.max((latest - earliest) / (1000 * 60 * 60 * 24), 7); // 至少 7 天
            const weeksDiff = Math.max(daysDiff / 7, 1);
            const monthsDiff = Math.max(daysDiff / 30, 1);

            // 計算總數
            const allTimeEngagement = allPosts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / allPosts.length;
            const allTimeViews = allPosts.reduce((sum, p) => sum + (p.current_views || 0), 0);
            const allTimeLikes = allPosts.reduce((sum, p) => sum + (p.current_likes || 0), 0);
            const allTimeReplies = allPosts.reduce((sum, p) => sum + (p.current_replies || 0), 0);
            const allTimeReposts = allPosts.reduce((sum, p) => sum + (p.current_reposts || 0), 0);
            const allTimeQuotes = allPosts.reduce((sum, p) => sum + (p.current_quotes || 0), 0);
            const allTimeInteractions = allTimeLikes + allTimeReplies + allTimeReposts + allTimeQuotes;

            setBenchmarkData({
              avgEngagementRate: allTimeEngagement,
              avgPostsPerWeek: allPosts.length / weeksDiff,
              avgPostsPerMonth: allPosts.length / monthsDiff,
              avgViewsPerWeek: allTimeViews / weeksDiff,
              avgViewsPerMonth: allTimeViews / monthsDiff,
              avgInteractionsPerWeek: allTimeInteractions / weeksDiff,
              avgInteractionsPerMonth: allTimeInteractions / monthsDiff,
              avgLikesPerWeek: allTimeLikes / weeksDiff,
              avgLikesPerMonth: allTimeLikes / monthsDiff,
              avgRepliesPerWeek: allTimeReplies / weeksDiff,
              avgRepliesPerMonth: allTimeReplies / monthsDiff,
              avgRepostsPerWeek: allTimeReposts / weeksDiff,
              avgRepostsPerMonth: allTimeReposts / monthsDiff,
              avgQuotesPerWeek: allTimeQuotes / weeksDiff,
              avgQuotesPerMonth: allTimeQuotes / monthsDiff,
              totalPosts: allPosts.length,
            });
          } else {
            setBenchmarkData(null);
          }
        } else {
          setBenchmarkData(null);
        }

        // 計算發文統計圖表資料（按標籤分類）
        const tagCounts: Record<string, number> = {};
        const tagViews: Record<string, number> = {};
        let untaggedCount = 0;
        let untaggedViews = 0;

        currentPosts.forEach((post) => {
          const selectedTags = post.ai_selected_tags as Record<string, string[]> | null;
          const postViews = post.current_views || 0;

          if (!selectedTags || Object.keys(selectedTags).length === 0) {
            // 沒有標籤的貼文
            untaggedCount++;
            untaggedViews += postViews;
          } else {
            // 統計所有已選標籤
            let hasTag = false;
            for (const dimension of Object.keys(selectedTags)) {
              const tags = selectedTags[dimension] || [];
              for (const tag of tags) {
                tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                tagViews[tag] = (tagViews[tag] || 0) + postViews;
                hasTag = true;
              }
            }
            if (!hasTag) {
              untaggedCount++;
              untaggedViews += postViews;
            }
          }
        });

        // 轉換為圖表資料，按數量排序
        const chartData: PostCountDataPoint[] = Object.entries(tagCounts)
          .map(([label, count]) => ({ label, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 8); // 最多顯示 8 個標籤

        // 如果有未標籤的貼文，加到最後
        if (untaggedCount > 0) {
          chartData.push({ label: "未分類", count: untaggedCount });
        }

        setPostCountData(chartData);

        // 轉換為圓餅圖資料，按曝光數排序
        const pieData: TagViewsDataPoint[] = Object.entries(tagViews)
          .map(([label, views], index) => ({
            label,
            views,
            fill: TEAL_SHADES[index % TEAL_SHADES.length],
          }))
          .sort((a, b) => b.views - a.views)
          .slice(0, 6); // 最多顯示 6 個標籤

        // 重新指派顏色（排序後）
        pieData.forEach((item, index) => {
          item.fill = TEAL_SHADES[index % TEAL_SHADES.length];
        });

        // 如果有未標籤的貼文，加到最後
        if (untaggedViews > 0) {
          pieData.push({ label: "未分類", views: untaggedViews, fill: "#A8A29E" }); // Stone 400
        }

        setTagViewsData(pieData);

        // 計算發文時間熱力圖資料
        const cellMap: Record<string, HeatmapCell> = {};

        currentPosts.forEach((post) => {
          if (post.published_at) {
            const date = new Date(post.published_at);
            const day = date.getDay(); // 0-6
            const hour = date.getHours(); // 0-23
            const key = `${day}-${hour}`;

            if (!cellMap[key]) {
              cellMap[key] = { day, hour, views: 0, count: 0 };
            }
            cellMap[key].views += post.current_views || 0;
            cellMap[key].count += 1;
          }
        });

        setHeatmapData(Object.values(cellMap));

        // 計算趨勢折線圖資料
        // 時間軸根據資料庫數據的最大時間來決定範圍
        const trendMap: Record<string, TrendDataPoint> = {};

        // 找出資料庫數據的最大時間
        let maxDataTimestamp = currentStart.getTime();
        if (period === "week" && hourlyMetrics.length > 0) {
          const maxBucketTs = hourlyMetrics.reduce((max, m) => {
            const ts = parseTimestamp(m.bucket_ts).getTime();
            return ts > max ? ts : max;
          }, 0);
          maxDataTimestamp = Math.max(maxDataTimestamp, maxBucketTs);
        } else if (period === "month" && dailyMetrics.length > 0) {
          const maxBucketDate = dailyMetrics.reduce((max, m) => {
            const ts = new Date(m.bucket_date + "T00:00:00").getTime();
            return ts > max ? ts : max;
          }, 0);
          maxDataTimestamp = Math.max(maxDataTimestamp, maxBucketDate);
        }

        if (period === "week") {
          // 週模式：以小時為刻度，只產生到最新數據時間為止
          for (let d = 0; d < 7; d++) {
            const dayDate = new Date(currentStart.getTime() + d * 24 * 60 * 60 * 1000);
            const dateStr = `${dayDate.getMonth() + 1}/${dayDate.getDate()}`;

            for (let h = 0; h < 24; h++) {
              const timestamp = currentStart.getTime() + d * 24 * 60 * 60 * 1000 + h * 60 * 60 * 1000;
              // 只產生到最新數據時間為止
              if (timestamp > maxDataTimestamp) break;

              const key = `${d}-${h}`;
              trendMap[key] = {
                timestamp,
                label: h === 0 ? "0" : String(h),
                dateLabel: h === 0 ? dateStr : undefined,
                views: 0,
                interactions: 0,
                engagementRate: 0,
                postCount: 0,
                postDetails: [],
              };
            }
            // 如果當天開始已超過最新數據時間，跳出
            if (dayDate.getTime() > maxDataTimestamp) break;
          }
        } else {
          // 月模式：以日為刻度，只產生到最新數據時間為止
          for (let d = 0; d < 30; d++) {
            const dayDate = new Date(currentStart.getTime() + d * 24 * 60 * 60 * 1000);
            const timestamp = dayDate.getTime();
            // 只產生到最新數據時間為止
            if (timestamp > maxDataTimestamp) break;

            const key = String(d);
            trendMap[key] = {
              timestamp,
              label: `${dayDate.getMonth() + 1}/${dayDate.getDate()}`,
              views: 0,
              interactions: 0,
              engagementRate: 0,
              postCount: 0,
              postDetails: [],
            };
          }
        }

        // 使用快照值計算 delta（增量）填入趨勢圖
        // 策略：計算每個時間桶相比上一個時間桶的增量
        const postContribMap: Record<string, Record<string, PostContribution>> = {};

        if (period === "week" && hourlyMetrics.length > 0) {
          // 週模式：使用 hourly 快照計算 delta
          // 先按貼文 ID 分組，再按時間排序
          const metricsByPost: Record<string, Array<typeof hourlyMetrics[0]>> = {};

          hourlyMetrics.forEach((m) => {
            if (!metricsByPost[m.workspace_threads_post_id]) {
              metricsByPost[m.workspace_threads_post_id] = [];
            }
            metricsByPost[m.workspace_threads_post_id].push(m);
          });

          // 對每個貼文計算 delta
          for (const [postId, metrics] of Object.entries(metricsByPost)) {
            // 按時間排序
            metrics.sort((a, b) => new Date(a.bucket_ts).getTime() - new Date(b.bucket_ts).getTime());

            for (let i = 0; i < metrics.length; i++) {
              const m = metrics[i];
              const bucketDate = parseTimestamp(m.bucket_ts);
              if (bucketDate.getTime() < currentStart.getTime()) continue;

              const dayDiff = Math.floor((bucketDate.getTime() - currentStart.getTime()) / (24 * 60 * 60 * 1000));
              const hour = bucketDate.getHours();
              const key = `${dayDiff}-${hour}`;

              if (!trendMap[key]) continue;

              // 計算 delta（當前值 - 上一個時間桶的值）
              const prevMetric = i > 0 ? metrics[i - 1] : null;
              const deltaViews = prevMetric
                ? Math.max(0, (m.views || 0) - (prevMetric.views || 0))
                : (m.views || 0);
              const deltaLikes = prevMetric
                ? Math.max(0, (m.likes || 0) - (prevMetric.likes || 0))
                : (m.likes || 0);
              const deltaReplies = prevMetric
                ? Math.max(0, (m.replies || 0) - (prevMetric.replies || 0))
                : (m.replies || 0);
              const deltaReposts = prevMetric
                ? Math.max(0, (m.reposts || 0) - (prevMetric.reposts || 0))
                : (m.reposts || 0);
              const deltaQuotes = prevMetric
                ? Math.max(0, (m.quotes || 0) - (prevMetric.quotes || 0))
                : (m.quotes || 0);
              const deltaInteractions = deltaLikes + deltaReplies + deltaReposts + deltaQuotes;

              trendMap[key].views += deltaViews;
              trendMap[key].interactions += deltaInteractions;

              if (!postContribMap[key]) postContribMap[key] = {};
              postContribMap[key][postId] = {
                postId,
                text: postTextMap[postId] || "未知貼文",
                views: deltaViews,
                interactions: deltaInteractions,
                engagementRate: deltaViews > 0 ? (deltaInteractions / deltaViews) * 100 : 0,
              };
            }
          }
        } else if (period === "month" && dailyMetrics.length > 0) {
          // 月模式：使用 daily 快照計算 delta
          const metricsByPost: Record<string, Array<typeof dailyMetrics[0]>> = {};

          dailyMetrics.forEach((m) => {
            if (!metricsByPost[m.workspace_threads_post_id]) {
              metricsByPost[m.workspace_threads_post_id] = [];
            }
            metricsByPost[m.workspace_threads_post_id].push(m);
          });

          // 對每個貼文計算 delta
          for (const [postId, metrics] of Object.entries(metricsByPost)) {
            // 按時間排序
            metrics.sort((a, b) => new Date(a.bucket_date).getTime() - new Date(b.bucket_date).getTime());

            for (let i = 0; i < metrics.length; i++) {
              const m = metrics[i];
              const bucketDate = new Date(m.bucket_date + "T00:00:00");
              if (bucketDate.getTime() < currentStart.getTime()) continue;

              const dayDiff = Math.floor((bucketDate.getTime() - currentStart.getTime()) / (24 * 60 * 60 * 1000));
              const key = String(dayDiff);

              if (!trendMap[key]) continue;

              // 計算 delta（當前值 - 上一個時間桶的值）
              const prevMetric = i > 0 ? metrics[i - 1] : null;
              const deltaViews = prevMetric
                ? Math.max(0, (m.views || 0) - (prevMetric.views || 0))
                : (m.views || 0);
              const deltaLikes = prevMetric
                ? Math.max(0, (m.likes || 0) - (prevMetric.likes || 0))
                : (m.likes || 0);
              const deltaReplies = prevMetric
                ? Math.max(0, (m.replies || 0) - (prevMetric.replies || 0))
                : (m.replies || 0);
              const deltaReposts = prevMetric
                ? Math.max(0, (m.reposts || 0) - (prevMetric.reposts || 0))
                : (m.reposts || 0);
              const deltaQuotes = prevMetric
                ? Math.max(0, (m.quotes || 0) - (prevMetric.quotes || 0))
                : (m.quotes || 0);
              const deltaInteractions = deltaLikes + deltaReplies + deltaReposts + deltaQuotes;

              trendMap[key].views += deltaViews;
              trendMap[key].interactions += deltaInteractions;

              if (!postContribMap[key]) postContribMap[key] = {};
              postContribMap[key][postId] = {
                postId,
                text: postTextMap[postId] || "未知貼文",
                views: deltaViews,
                interactions: deltaInteractions,
                engagementRate: deltaViews > 0 ? (deltaInteractions / deltaViews) * 100 : 0,
              };
            }
          }
        }

        // 計算互動率並整理貼文明細
        const trendArray = Object.values(trendMap)
          .map((point) => {
            const key = Object.keys(trendMap).find((k) => trendMap[k] === point) || "";
            const postContribs = postContribMap[key] ? Object.values(postContribMap[key]) : [];

            // 計算每篇貼文的互動率並排序
            const sortedDetails = postContribs
              .map((p) => ({
                ...p,
                engagementRate: p.views > 0 ? (p.interactions / p.views) * 100 : 0,
              }))
              .sort((a, b) => b.views - a.views); // 按曝光數高到低排序

            return {
              ...point,
              engagementRate: point.views > 0 ? (point.interactions / point.views) * 100 : 0,
              postCount: sortedDetails.length,
              postDetails: sortedDetails,
            };
          })
          .sort((a, b) => a.timestamp - b.timestamp);
        setTrendData(trendArray);
      } catch (error) {
        console.error("[Insights] Error loading data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [selectedAccountId, isAccountLoading, period]);

  return (
    <div className="space-y-6">
      {/* 標題和期間切換 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">總覽</h1>
          <p className="text-muted-foreground">
            {periodTitle}成效概覽，快速掌握帳號表現
          </p>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="week">本週</TabsTrigger>
            <TabsTrigger value="month">本月</TabsTrigger>
          </TabsList>
        </Tabs>
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
          {/* 帳號資訊 + 本週貼文數 + 發文時間表 (1:1:2) */}
          <div className="grid gap-4 lg:grid-cols-4">
            <AccountProfileCard
              account={accountData}
              isLoading={isLoading}
              periodLabel={periodLabel}
            />
            <Card>
              <CardContent className="flex h-full flex-col justify-center p-6">
                <p className="text-sm text-muted-foreground">{periodTitle}發文</p>
                <div className="mt-2 flex items-baseline gap-2">
                  {isLoading ? (
                    <Skeleton className="h-10 w-16" />
                  ) : (
                    <>
                      <span className="text-4xl font-bold">
                        {kpiData?.postsCount || 0}
                      </span>
                      <span className="text-lg text-muted-foreground">篇</span>
                    </>
                  )}
                </div>
                {!isLoading && kpiData?.postsGrowth !== undefined && kpiData.postsGrowth !== 0 && (
                  <div className="mt-2 flex items-center gap-1">
                    <GrowthBadge value={kpiData.postsGrowth} />
                    <span className="text-xs text-muted-foreground">vs {periodLabel}</span>
                  </div>
                )}
                {!isLoading && benchmarkData && (
                  <div className="mt-1">
                    <BenchmarkBadge
                      currentValue={kpiData?.postsCount || 0}
                      benchmarkValue={period === "week" ? benchmarkData.avgPostsPerWeek : benchmarkData.avgPostsPerMonth}
                      totalPosts={benchmarkData.totalPosts}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
            <div className="lg:col-span-2">
              <PostingHeatmap
                data={heatmapData}
                isLoading={isLoading}
                periodTitle={periodTitle}
              />
            </div>
          </div>

          {/* 發文統計圖表 */}
          <div className="grid gap-4 lg:grid-cols-2">
            <PostCountChart
              data={postCountData}
              isLoading={isLoading}
              periodTitle={periodTitle}
            />
            <TagViewsPieChart
              data={tagViewsData}
              isLoading={isLoading}
              periodTitle={periodTitle}
            />
          </div>

          {/* 成效趨勢折線圖 */}
          <TrendLineChart
            data={trendData}
            isLoading={isLoading}
            periodTitle={periodTitle}
            period={period}
          />

          {/* 成效 KPI */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">{periodTitle}成效</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <KPICard
                title="總曝光數"
                value={kpiData?.totalViews || 0}
                growth={kpiData?.viewsGrowth}
                icon={<Eye className="size-4" />}
                isLoading={isLoading}
                periodLabel={periodLabel}
                benchmark={benchmarkData ? {
                  value: period === "week" ? benchmarkData.avgViewsPerWeek : benchmarkData.avgViewsPerMonth,
                  totalPosts: benchmarkData.totalPosts,
                } : undefined}
              />
              <KPICard
                title="總互動數"
                value={kpiData?.totalInteractions || 0}
                growth={kpiData?.interactionsGrowth}
                icon={<Heart className="size-4" />}
                isLoading={isLoading}
                periodLabel={periodLabel}
                benchmark={benchmarkData ? {
                  value: period === "week" ? benchmarkData.avgInteractionsPerWeek : benchmarkData.avgInteractionsPerMonth,
                  totalPosts: benchmarkData.totalPosts,
                } : undefined}
              />
              <KPICard
                title="平均互動率"
                value={kpiData?.engagementRate || 0}
                growth={kpiData?.engagementGrowth}
                icon={<TrendingUp className="size-4" />}
                isLoading={isLoading}
                format="percent"
                periodLabel={periodLabel}
                benchmark={benchmarkData ? {
                  value: benchmarkData.avgEngagementRate,
                  totalPosts: benchmarkData.totalPosts,
                } : undefined}
              />
            </div>
          </div>

          {/* 互動明細 */}
          <div>
            <h2 className="mb-3 text-lg font-semibold">互動明細</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <KPICard
                title="讚"
                value={kpiData?.totalLikes || 0}
                growth={kpiData?.likesGrowth}
                icon={<Heart className="size-4" />}
                isLoading={isLoading}
                periodLabel={periodLabel}
                benchmark={benchmarkData ? {
                  value: period === "week" ? benchmarkData.avgLikesPerWeek : benchmarkData.avgLikesPerMonth,
                  totalPosts: benchmarkData.totalPosts,
                } : undefined}
              />
              <KPICard
                title="回覆"
                value={kpiData?.totalReplies || 0}
                growth={kpiData?.repliesGrowth}
                icon={<MessageSquare className="size-4" />}
                isLoading={isLoading}
                periodLabel={periodLabel}
                benchmark={benchmarkData ? {
                  value: period === "week" ? benchmarkData.avgRepliesPerWeek : benchmarkData.avgRepliesPerMonth,
                  totalPosts: benchmarkData.totalPosts,
                } : undefined}
              />
              <KPICard
                title="轉發"
                value={kpiData?.totalReposts || 0}
                growth={kpiData?.repostsGrowth}
                icon={<Repeat2 className="size-4" />}
                isLoading={isLoading}
                periodLabel={periodLabel}
                benchmark={benchmarkData ? {
                  value: period === "week" ? benchmarkData.avgRepostsPerWeek : benchmarkData.avgRepostsPerMonth,
                  totalPosts: benchmarkData.totalPosts,
                } : undefined}
              />
              <KPICard
                title="引用"
                value={kpiData?.totalQuotes || 0}
                growth={kpiData?.quotesGrowth}
                icon={<Quote className="size-4" />}
                isLoading={isLoading}
                periodLabel={periodLabel}
                benchmark={benchmarkData ? {
                  value: period === "week" ? benchmarkData.avgQuotesPerWeek : benchmarkData.avgQuotesPerMonth,
                  totalPosts: benchmarkData.totalPosts,
                } : undefined}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
