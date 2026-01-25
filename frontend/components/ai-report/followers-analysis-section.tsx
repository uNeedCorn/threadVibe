"use client";

import { Users, Lightbulb, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { iconGradients, typography, spacing } from "@/components/report-shared";
import type { DataSnapshot } from "@/hooks/use-weekly-report";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

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
  const chartData = snapshot.daily_metrics.map((d) => ({
    date: d.date.slice(5).replace("-", "/"),
    followers: d.followers_count,
    posts: d.post_count,
  }));

  const startFollowers = chartData.length > 0 ? chartData[0].followers : 0;
  const endFollowers = chartData.length > 0 ? chartData[chartData.length - 1].followers : 0;
  const growth = endFollowers - startFollowers;
  const growthRate = startFollowers > 0 ? ((growth / startFollowers) * 100).toFixed(2) : "0";
  const isPositiveGrowth = growth >= 0;

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 shadow-lg shadow-pink-500/25">
            <Users className="size-5 text-white" />
          </div>
          <div>
            <h2 className={typography.cardTitle}>粉絲成長</h2>
            <p className={typography.caption}>追蹤者變化趨勢分析</p>
          </div>
        </div>

        {/* AI 摘要 */}
        <div className="relative rounded-xl border-2 border-pink-200 bg-pink-50/50 p-5">
          <Sparkles className="absolute top-4 right-4 size-4 text-pink-400/50" />
          <p className={cn(typography.body, "pr-8")}>{data.summary}</p>
        </div>

        {/* 成長摘要 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className={cn(typography.label, "text-muted-foreground mb-1")}>期初粉絲</p>
            <p className={typography.bigNumber}>{formatNumber(startFollowers)}</p>
          </div>
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className={cn(typography.label, "text-muted-foreground mb-1")}>期末粉絲</p>
            <p className={typography.bigNumber}>{formatNumber(endFollowers)}</p>
          </div>
          <div className={cn(
            "rounded-xl border-2 p-4",
            isPositiveGrowth ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"
          )}>
            <p className={cn(typography.label, "text-muted-foreground mb-1")}>本期成長</p>
            <div className="flex items-center gap-2">
              {isPositiveGrowth ? (
                <TrendingUp className="size-5 text-emerald-500" />
              ) : (
                <TrendingDown className="size-5 text-rose-500" />
              )}
              <span className={cn(
                typography.bigNumber,
                isPositiveGrowth ? "text-emerald-600" : "text-rose-600"
              )}>
                {isPositiveGrowth ? "+" : ""}{formatNumber(growth)}
              </span>
              <span className={cn(
                "text-xs font-medium",
                isPositiveGrowth ? "text-emerald-500" : "text-rose-500"
              )}>
                ({isPositiveGrowth ? "+" : ""}{growthRate}%)
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 粉絲趨勢圖 */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <h3 className={cn(typography.sectionTitle, "mb-4")}>每日粉絲變化</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
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
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="size-5 text-amber-600" />
              <h3 className={cn(typography.sectionTitle, "text-amber-700")}>AI 發現</h3>
            </div>
            <ul className={spacing.list}>
              {data.findings.map((finding, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="shrink-0 size-1.5 rounded-full bg-pink-500 mt-2" />
                  <span className={typography.body}>{finding}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
