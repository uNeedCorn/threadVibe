"use client";

import { Clock, Lightbulb, Sparkles, TrendingUp, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface TimingAnalysisData {
  summary: string;
  findings?: string[];
  best_times?: string[];
  // 向後相容舊格式
  insights?: string[];
  best_posting_times?: string[];
}

interface HourlyData {
  hour: number;
  post_count: number;
  avg_views: number;
  avg_engagement: number;
}

interface Props {
  data: TimingAnalysisData;
  hourlyData: HourlyData[];
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function TimingAnalysisSection({ data, hourlyData }: Props) {
  // 向後相容：優先使用新欄位，fallback 到舊欄位
  const findings = data.findings || data.insights || [];
  const bestTimes = data.best_times || data.best_posting_times || [];

  // 準備圖表數據（只顯示有發文的時段）
  const chartData = hourlyData
    .filter((h) => h.post_count > 0)
    .map((h) => ({
      hour: `${h.hour.toString().padStart(2, "0")}:00`,
      posts: h.post_count,
      avgViews: h.avg_views,
    }));

  // 找出最佳時段（按平均曝光排序）
  const sortedByViews = [...hourlyData]
    .filter((h) => h.post_count > 0)
    .sort((a, b) => b.avg_views - a.avg_views);

  // 找出最高平均曝光值
  const maxAvgViews = sortedByViews.length > 0 ? sortedByViews[0].avg_views : 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-500 shadow-lg shadow-violet-500/25">
            <Clock className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              發文時間分析
            </h2>
            <p className="text-[13px] text-muted-foreground">
              找出最佳發文時機
            </p>
          </div>
        </div>

        {/* AI 摘要 */}
        <div className="relative overflow-hidden mb-6 p-5 rounded-2xl bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent border border-violet-500/20">
          <div className="absolute top-3 right-3">
            <Sparkles className="size-4 text-violet-500/50" />
          </div>
          <p className="text-[14px] leading-relaxed pr-8">{data.summary}</p>
        </div>

        {/* 最佳發文時段 */}
        {bestTimes.length > 0 && (
          <div className="mb-6 p-4 rounded-2xl bg-gradient-to-br from-violet-500/5 to-transparent border border-violet-500/20">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="size-4 text-violet-500" />
              <h3 className="text-[14px] font-semibold">推薦發文時段</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {bestTimes.map((time, idx) => (
                <Badge
                  key={idx}
                  className="px-4 py-2 text-[13px] font-medium bg-gradient-to-r from-violet-500 to-purple-500 text-white border-0 shadow-md shadow-violet-500/25 hover:shadow-lg hover:shadow-violet-500/30 transition-shadow"
                >
                  {time}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 時段分佈圖 */}
          <div className="rounded-2xl border bg-gradient-to-br from-background to-muted/20 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[14px] font-medium">時段表現分佈</h3>
              <div className="flex items-center gap-3 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-violet-500" />
                  <span className="text-muted-foreground">發文數</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="size-2 rounded-full bg-violet-300" />
                  <span className="text-muted-foreground">平均曝光</span>
                </div>
              </div>
            </div>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={2}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted/50"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="hour"
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{
                      fontSize: 10,
                      fill: "hsl(var(--muted-foreground))",
                    }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => formatNumber(value)}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                    formatter={(value: number, name: string) => [
                      name === "posts" ? value : formatNumber(value),
                      name === "posts" ? "發文數" : "平均曝光",
                    ]}
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                  />
                  <Bar
                    yAxisId="left"
                    dataKey="posts"
                    fill="#8b5cf6"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar yAxisId="right" dataKey="avgViews" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.avgViews === maxAvgViews ? "#a78bfa" : "#ddd6fe"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 時段表現排名 & AI 發現 */}
          <div className="space-y-4">
            {/* 時段表現排名 */}
            {sortedByViews.length > 0 && (
              <div className="rounded-2xl border bg-gradient-to-br from-violet-500/5 to-transparent p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-violet-500/10">
                    <TrendingUp className="size-4 text-violet-500" />
                  </div>
                  <h3 className="text-[14px] font-semibold">時段表現排名</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {sortedByViews.slice(0, 4).map((h, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border transition-colors",
                        idx === 0
                          ? "bg-violet-500/10 border-violet-500/30"
                          : "bg-muted/30 border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            "text-[11px] font-bold size-5 rounded-full flex items-center justify-center",
                            idx === 0
                              ? "bg-violet-500 text-white"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {idx + 1}
                        </span>
                        <span className="text-[13px] font-medium tabular-nums">
                          {h.hour.toString().padStart(2, "0")}:00
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye className="size-3 text-muted-foreground" />
                        <span className="text-[13px] font-semibold tabular-nums">
                          {formatNumber(h.avg_views)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI 發現 */}
            <div className="rounded-2xl border bg-gradient-to-br from-amber-500/5 to-transparent p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="p-1.5 rounded-lg bg-amber-500/10">
                  <Lightbulb className="size-4 text-amber-500" />
                </div>
                <h3 className="text-[14px] font-semibold">AI 發現</h3>
              </div>
              <ul className="space-y-2.5">
                {findings.map((finding, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="flex-shrink-0 size-1.5 rounded-full bg-violet-500 mt-2" />
                    <span className="text-[14px] text-foreground/90 leading-relaxed">
                      {finding}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
