"use client";

import { Eye, Lightbulb, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { iconGradients, typography, spacing, semanticColors } from "@/components/report-shared";
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
  const findings = data.findings || data.insights || [];

  const chartData = snapshot.daily_metrics.map((d) => ({
    date: d.date.slice(5).replace("-", "/"),
    views: d.views,
    posts: d.post_count,
  }));

  const maxViews = Math.max(...chartData.map((d) => d.views));

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl", iconGradients.blue)}>
            <Eye className="size-5 text-white" />
          </div>
          <div>
            <h2 className={typography.cardTitle}>曝光分析</h2>
            <p className={typography.caption}>觸及受眾的深度解析</p>
          </div>
        </div>

        {/* AI 摘要 */}
        <div className="relative rounded-xl border-2 border-blue-200 bg-blue-50/50 p-5">
          <Sparkles className="absolute top-4 right-4 size-4 text-blue-400/50" />
          <p className={cn(typography.body, "pr-8")}>{data.summary}</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 曝光趨勢圖 */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <h3 className={cn(typography.sectionTitle, "mb-4")}>每日曝光趨勢</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barCategoryGap="20%">
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
          <div className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-center gap-2 mb-4">
              <Lightbulb className="size-5 text-amber-600" />
              <h3 className={cn(typography.sectionTitle, "text-amber-700")}>AI 發現</h3>
            </div>
            <ul className={spacing.list}>
              {findings.map((finding, idx) => (
                <li key={idx} className="flex items-start gap-3">
                  <span className="shrink-0 size-1.5 rounded-full bg-blue-500 mt-2" />
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
