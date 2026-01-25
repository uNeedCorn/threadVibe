"use client";

import { Ruler, Sparkles, TrendingUp, TrendingDown, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { iconGradients, typography, spacing, semanticColors } from "@/components/report-shared";
import type { ContentPatternReportContent, ContentPatternSnapshot } from "@/hooks/use-content-pattern-report";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Props {
  data: ContentPatternReportContent["length_analysis"];
  snapshot: ContentPatternSnapshot;
}

const COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6"];

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function LengthSection({ data, snapshot }: Props) {
  const chartData = snapshot.content_length.map((item, idx) => ({
    name: item.range.replace(/\s*\([^)]*\)/, ""),
    曝光: item.avg_views,
    fill: COLORS[idx % COLORS.length],
  }));

  const bestRange = snapshot.content_length.reduce((best, current) =>
    current.avg_views > best.avg_views ? current : best
  , snapshot.content_length[0]);

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl", iconGradients.emerald)}>
            <Ruler className="size-5 text-white" />
          </div>
          <div>
            <h2 className={typography.cardTitle}>內容長度效益</h2>
            <p className={typography.caption}>分析不同內容長度的表現差異</p>
          </div>
        </div>

        {/* 最佳長度提示 */}
        <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20">
              <Target className="size-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">最佳長度區間</div>
              <div className="text-lg font-bold text-emerald-600">{data.optimal_range}</div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 左側：圖表 */}
          {chartData.length > 0 && (
            <div className="rounded-xl border bg-muted/30 p-4">
              <h3 className={cn(typography.sectionTitle, "mb-4")}>各長度區間平均曝光</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted/50" />
                    <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(value: number) => [value.toLocaleString(), "平均曝光"]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                    />
                    <Bar dataKey="曝光" radius={[4, 4, 0, 0]} maxBarSize={40}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 右側：詳細數據 */}
          <div className={spacing.list}>
            {snapshot.content_length.map((item, idx) => {
              const isBest = item.range === bestRange?.range;
              const rangeLabel = item.range.split(" ")[0];

              return (
                <div
                  key={item.range}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-xl border transition-all hover:shadow-md",
                    isBest ? "bg-emerald-50/50 border-emerald-200" : "bg-muted/30"
                  )}
                >
                  <div className="w-1.5 h-12 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />

                  <div className="min-w-[80px]">
                    <div className={typography.sectionTitle}>{rangeLabel}</div>
                    <div className="text-xs text-muted-foreground">{item.count} 篇</div>
                  </div>

                  <div className="flex-1 flex items-center justify-between">
                    <div>
                      <div className="text-xs text-muted-foreground">平均曝光</div>
                      <div className={cn("text-sm font-semibold", typography.number)}>{formatNumber(item.avg_views)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">vs 平均</div>
                      <div className={cn(
                        "text-sm font-medium flex items-center justify-end gap-1",
                        item.vs_average >= 0 ? "text-emerald-600" : "text-rose-600"
                      )}>
                        {item.vs_average >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                        {item.vs_average >= 0 ? "+" : ""}{(item.vs_average * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  {isBest && <Badge className={semanticColors.success.badge}>最佳</Badge>}
                </div>
              );
            })}
          </div>
        </div>

        {/* AI 分析區 */}
        <section className="rounded-xl border-2 border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="size-5 text-amber-600" />
            <h3 className={cn(typography.sectionTitle, "text-amber-700")}>AI 分析</h3>
          </div>
          <p className={cn(typography.body, "mb-3")}>{data.summary}</p>
          <ul className={spacing.listCompact}>
            {data.insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 size-1.5 rounded-full bg-emerald-500 mt-2" />
                <span className={typography.caption}>{insight}</span>
              </li>
            ))}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
