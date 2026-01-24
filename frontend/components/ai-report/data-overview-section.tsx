"use client";

import { Eye, MessageSquare, Users, FileText, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DataSnapshot } from "@/hooks/use-weekly-report";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface Props {
  data: DataSnapshot;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function calculateChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

const statConfigs = [
  {
    key: "views",
    label: "總曝光",
    icon: Eye,
    gradient: "from-blue-500 to-cyan-500",
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
  },
  {
    key: "interactions",
    label: "總互動",
    icon: MessageSquare,
    gradient: "from-emerald-500 to-teal-500",
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
  },
  {
    key: "engagement",
    label: "互動率",
    icon: TrendingUp,
    gradient: "from-violet-500 to-purple-500",
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-500",
  },
  {
    key: "posts",
    label: "發文數",
    icon: FileText,
    gradient: "from-amber-500 to-orange-500",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
  },
  {
    key: "followers",
    label: "粉絲成長",
    icon: Users,
    gradient: "from-rose-500 to-pink-500",
    iconBg: "bg-rose-500/10",
    iconColor: "text-rose-500",
  },
];

export function DataOverviewSection({ data }: Props) {
  const viewsChange = data.previous_week
    ? calculateChange(data.summary.total_views, data.previous_week.total_views)
    : null;

  const interactionsChange = data.previous_week
    ? calculateChange(data.summary.total_interactions, data.previous_week.total_interactions)
    : null;

  const postsChange = data.previous_week
    ? calculateChange(data.summary.post_count, data.previous_week.post_count)
    : null;

  const stats = [
    { ...statConfigs[0], value: formatNumber(data.summary.total_views), change: viewsChange },
    { ...statConfigs[1], value: formatNumber(data.summary.total_interactions), change: interactionsChange },
    { ...statConfigs[2], value: `${(data.summary.engagement_rate * 100).toFixed(2)}%`, change: null },
    { ...statConfigs[3], value: data.summary.post_count.toString(), change: postsChange },
    {
      ...statConfigs[4],
      value: `${data.account.followers_growth >= 0 ? "+" : ""}${formatNumber(data.account.followers_growth)}`,
      change: null,
      iconColor: data.account.followers_growth >= 0 ? "text-emerald-500" : "text-rose-500",
    },
  ];

  // 準備圖表數據
  const chartData = data.daily_metrics.map((d) => ({
    date: d.date.slice(5).replace("-", "/"), // M/D 格式
    views: d.views,
    interactions: d.interactions,
  }));

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/25">
            <BarChart3 className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">數據概覽</h2>
            <p className="text-[13px] text-muted-foreground">本期關鍵指標一覽</p>
          </div>
        </div>

        {/* 指標卡片 */}
        <div className="grid grid-cols-2 gap-3 mb-6 md:grid-cols-5">
          {stats.map((stat, idx) => (
            <div
              key={idx}
              className="group relative overflow-hidden rounded-2xl border bg-gradient-to-br from-background to-muted/30 p-4 transition-all hover:shadow-md"
            >
              {/* 背景裝飾 */}
              <div className={cn(
                "absolute -right-4 -top-4 size-16 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20",
                `bg-gradient-to-br ${stat.gradient}`
              )} />

              <div className="relative">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className={cn("p-1.5 rounded-lg", stat.iconBg)}>
                    <stat.icon className={cn("size-3.5", stat.iconColor)} />
                  </div>
                  <span className="text-[12px] font-medium text-muted-foreground">
                    {stat.label}
                  </span>
                </div>
                <div className="text-xl font-bold tabular-nums">{stat.value}</div>
                {stat.change !== null && (
                  <div
                    className={cn(
                      "flex items-center gap-1 mt-1.5 text-[11px] font-medium",
                      stat.change >= 0 ? "text-emerald-600" : "text-rose-600"
                    )}
                  >
                    {stat.change >= 0 ? (
                      <TrendingUp className="size-3" />
                    ) : (
                      <TrendingDown className="size-3" />
                    )}
                    <span>
                      {stat.change >= 0 ? "+" : ""}
                      {stat.change.toFixed(1)}% vs 上週
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* 趨勢圖 */}
        <div className="rounded-2xl border bg-gradient-to-br from-background to-muted/20 p-4">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[14px] font-medium">每日趨勢</h3>
            <div className="flex items-center gap-4 text-[12px]">
              <div className="flex items-center gap-1.5">
                <div className="size-2 rounded-full bg-blue-500" />
                <span className="text-muted-foreground">曝光</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="size-2 rounded-full bg-emerald-500" />
                <span className="text-muted-foreground">互動</span>
              </div>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorInteractions" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(value) => formatNumber(value)}
                  width={45}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "12px",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                  formatter={(value: number, name: string) => [
                    formatNumber(value),
                    name === "views" ? "曝光" : "互動",
                  ]}
                  labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorViews)"
                />
                <Area
                  type="monotone"
                  dataKey="interactions"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorInteractions)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
