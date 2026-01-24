"use client";

import { Eye, Lightbulb, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { DataSnapshot } from "@/hooks/use-weekly-report";
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

interface ReachAnalysisData {
  summary: string;
  findings?: string[];
  // 向後相容舊格式
  insights?: string[];
  recommendations?: string[];
}

interface Props {
  data: ReachAnalysisData;
  snapshot: DataSnapshot;
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function ReachAnalysisSection({ data, snapshot }: Props) {
  // 向後相容：優先使用 findings，fallback 到 insights
  const findings = data.findings || data.insights || [];

  // 準備圖表數據
  const chartData = snapshot.daily_metrics.map((d) => ({
    date: d.date.slice(5).replace("-", "/"), // M/D 格式
    views: d.views,
    posts: d.post_count,
  }));

  // 找出最高值以高亮顯示
  const maxViews = Math.max(...chartData.map((d) => d.views));

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500 shadow-lg shadow-blue-500/25">
            <Eye className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">曝光分析</h2>
            <p className="text-[13px] text-muted-foreground">
              觸及受眾的深度解析
            </p>
          </div>
        </div>

        {/* AI 摘要 */}
        <div className="relative overflow-hidden mb-6 p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20">
          <div className="absolute top-3 right-3">
            <Sparkles className="size-4 text-blue-500/50" />
          </div>
          <p className="text-[14px] leading-relaxed pr-8">{data.summary}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 曝光趨勢圖 */}
          <div className="rounded-2xl border bg-gradient-to-br from-background to-muted/20 p-4">
            <h3 className="mb-3 text-[14px] font-medium">每日曝光趨勢</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap="20%">
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
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "12px",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                    }}
                    formatter={(value: number) => [formatNumber(value), "曝光"]}
                    cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                  />
                  <Bar dataKey="views" radius={[6, 6, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.views === maxViews ? "#3b82f6" : "#93c5fd"}
                      />
                    ))}
                  </Bar>
                </BarChart>
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
              {findings.map((finding, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="flex-shrink-0 size-1.5 rounded-full bg-blue-500 mt-2" />
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
