"use client";

import { Clock, Lightbulb, Sparkles, TrendingUp, Eye } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { iconGradients, typography, spacing } from "@/components/report-shared";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface TimingAnalysisData {
  summary: string;
  findings?: string[];
  best_times?: string[];
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
  const findings = data.findings || data.insights || [];
  const bestTimes = data.best_times || data.best_posting_times || [];

  const chartData = hourlyData
    .filter((h) => h.post_count > 0)
    .map((h) => ({
      hour: `${h.hour.toString().padStart(2, "0")}:00`,
      posts: h.post_count,
      avgViews: h.avg_views,
    }));

  const sortedByViews = [...hourlyData]
    .filter((h) => h.post_count > 0)
    .sort((a, b) => b.avg_views - a.avg_views);

  const maxAvgViews = sortedByViews.length > 0 ? sortedByViews[0].avg_views : 0;

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl", iconGradients.purple)}>
            <Clock className="size-5 text-white" />
          </div>
          <div>
            <h2 className={typography.cardTitle}>發文時間分析</h2>
            <p className={typography.caption}>找出最佳發文時機</p>
          </div>
        </div>

        {/* AI 摘要 */}
        <div className="relative rounded-xl border-2 border-violet-200 bg-violet-50/50 p-5">
          <Sparkles className="absolute top-4 right-4 size-4 text-violet-400/50" />
          <p className={cn(typography.body, "pr-8")}>{data.summary}</p>
        </div>

        {/* 最佳發文時段 */}
        {bestTimes.length > 0 && (
          <section className="rounded-xl border-2 border-violet-200 bg-violet-50/50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="size-5 text-violet-600" />
              <h3 className={cn(typography.sectionTitle, "text-violet-700")}>推薦發文時段</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {bestTimes.map((time, idx) => (
                <Badge
                  key={idx}
                  className="px-4 py-2 text-sm font-medium bg-gradient-to-r from-violet-500 to-purple-500 text-white border-0 shadow-md"
                >
                  {time}
                </Badge>
              ))}
            </div>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 時段分佈圖 */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className={typography.sectionTitle}>時段表現分佈</h3>
              <div className="flex items-center gap-3 text-xs">
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
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted/50" vertical={false} />
                  <XAxis
                    dataKey="hour"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    yAxisId="left"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                    tickLine={false}
                    axisLine={false}
                    width={30}
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
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
                  <Bar yAxisId="left" dataKey="posts" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
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

          {/* 時段排名 & AI 發現 */}
          <div className={spacing.content}>
            {/* 時段表現排名 */}
            {sortedByViews.length > 0 && (
              <section className="rounded-xl border bg-muted/30 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <TrendingUp className="size-5 text-violet-600" />
                  <h3 className={typography.sectionTitle}>時段表現排名</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {sortedByViews.slice(0, 4).map((h, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-xl border-2 transition-colors",
                        idx === 0 ? "bg-violet-50 border-violet-200" : "bg-muted/30 border-transparent"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          "text-xs font-bold size-5 rounded-full flex items-center justify-center",
                          idx === 0 ? "bg-violet-500 text-white" : "bg-muted text-muted-foreground"
                        )}>
                          {idx + 1}
                        </span>
                        <span className={cn("text-sm font-medium", typography.number)}>
                          {h.hour.toString().padStart(2, "0")}:00
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Eye className="size-3 text-muted-foreground" />
                        <span className={cn("text-sm font-semibold", typography.number)}>
                          {formatNumber(h.avg_views)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* AI 發現 */}
            <section className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="size-5 text-amber-600" />
                <h3 className={cn(typography.sectionTitle, "text-amber-700")}>AI 發現</h3>
              </div>
              <ul className={spacing.list}>
                {findings.map((finding, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <span className="shrink-0 size-1.5 rounded-full bg-violet-500 mt-2" />
                    <span className={typography.body}>{finding}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
