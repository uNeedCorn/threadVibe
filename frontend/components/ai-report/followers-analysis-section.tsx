"use client";

import { Users, Lightbulb, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { DataSnapshot } from "@/hooks/use-weekly-report";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface FollowersAnalysisData {
  summary: string;
  findings: string[];
}

interface Props {
  data: FollowersAnalysisData;
  snapshot: DataSnapshot;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function FollowersAnalysisSection({ data, snapshot }: Props) {
  // 準備粉絲趨勢數據
  const chartData = snapshot.daily_metrics.map((d) => ({
    date: d.date.slice(5).replace("-", "/"), // M/D 格式
    followers: d.followers_count,
    posts: d.post_count,
  }));

  // 計算成長數據
  const startFollowers = chartData.length > 0 ? chartData[0].followers : 0;
  const endFollowers = chartData.length > 0 ? chartData[chartData.length - 1].followers : 0;
  const growth = endFollowers - startFollowers;
  const growthRate = startFollowers > 0 ? ((growth / startFollowers) * 100).toFixed(2) : "0";
  const isPositiveGrowth = growth >= 0;

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 shadow-lg shadow-pink-500/25">
            <Users className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">粉絲成長</h2>
            <p className="text-[13px] text-muted-foreground">
              追蹤者變化趨勢分析
            </p>
          </div>
        </div>

        {/* AI 摘要 */}
        <div className="relative overflow-hidden mb-6 p-5 rounded-2xl bg-gradient-to-br from-pink-500/10 via-pink-500/5 to-transparent border border-pink-500/20">
          <div className="absolute top-3 right-3">
            <Sparkles className="size-4 text-pink-500/50" />
          </div>
          <p className="text-[14px] leading-relaxed pr-8">{data.summary}</p>
        </div>

        {/* 成長摘要 */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
            <div className="text-[12px] text-muted-foreground mb-1">
              期初粉絲
            </div>
            <div className="text-xl font-bold">{formatNumber(startFollowers)}</div>
          </div>
          <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
            <div className="text-[12px] text-muted-foreground mb-1">
              期末粉絲
            </div>
            <div className="text-xl font-bold">{formatNumber(endFollowers)}</div>
          </div>
          <div
            className={cn(
              "p-4 rounded-xl border",
              isPositiveGrowth
                ? "bg-emerald-500/10 border-emerald-500/30"
                : "bg-rose-500/10 border-rose-500/30"
            )}
          >
            <div className="text-[12px] text-muted-foreground mb-1">本期成長</div>
            <div className="flex items-center gap-2">
              {isPositiveGrowth ? (
                <TrendingUp className="size-5 text-emerald-500" />
              ) : (
                <TrendingDown className="size-5 text-rose-500" />
              )}
              <span
                className={cn(
                  "text-xl font-bold",
                  isPositiveGrowth ? "text-emerald-600" : "text-rose-600"
                )}
              >
                {isPositiveGrowth ? "+" : ""}
                {formatNumber(growth)}
              </span>
              <span
                className={cn(
                  "text-[12px] font-medium",
                  isPositiveGrowth ? "text-emerald-500" : "text-rose-500"
                )}
              >
                ({isPositiveGrowth ? "+" : ""}
                {growthRate}%)
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 粉絲趨勢圖 */}
          <div className="rounded-2xl border bg-gradient-to-br from-background to-muted/20 p-4">
            <h3 className="mb-3 text-[14px] font-medium">每日粉絲變化</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    className="stroke-muted/50"
                    vertical={false}
                  />
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
                    domain={["dataMin - 10", "dataMax + 10"]}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                    formatter={(value: number) => [formatNumber(value), "粉絲"]}
                    cursor={{ stroke: "hsl(var(--muted))", strokeWidth: 1 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="followers"
                    stroke="#ec4899"
                    strokeWidth={2.5}
                    dot={{ fill: "#ec4899", strokeWidth: 0, r: 3 }}
                    activeDot={{ r: 5, fill: "#ec4899" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* AI 發現 */}
          <div className="rounded-2xl border bg-gradient-to-br from-amber-500/5 to-transparent p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="p-1.5 rounded-lg bg-amber-500/10">
                <Lightbulb className="size-4 text-amber-500" />
              </div>
              <h3 className="text-[14px] font-semibold">AI 發現</h3>
            </div>
            <ul className="space-y-2.5">
              {data.findings.map((finding, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="flex-shrink-0 size-1.5 rounded-full bg-pink-500 mt-2" />
                  <span className="text-[14px] text-foreground/90 leading-relaxed">
                    {finding}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
