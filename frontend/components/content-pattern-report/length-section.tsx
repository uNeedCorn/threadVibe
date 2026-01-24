"use client";

import { Ruler, Sparkles, TrendingUp, TrendingDown, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ContentPatternReportContent, ContentPatternSnapshot } from "@/hooks/use-content-pattern-report";
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

  // 找出最佳長度區間
  const bestRange = snapshot.content_length.reduce((best, current) =>
    current.avg_views > best.avg_views ? current : best
  , snapshot.content_length[0]);

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-green-500 shadow-lg shadow-emerald-500/25">
            <Ruler className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">內容長度效益</h2>
            <p className="text-[13px] text-muted-foreground">
              分析不同內容長度的表現差異
            </p>
          </div>
        </div>

        {/* 最佳長度提示 */}
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/10 to-transparent border border-emerald-500/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20">
              <Target className="size-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-[12px] text-muted-foreground">最佳長度區間</div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                {data.optimal_range}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 左側：圖表 */}
          {chartData.length > 0 && (
            <div className="rounded-2xl border bg-gradient-to-br from-background to-muted/20 p-4">
              <h3 className="text-[14px] font-semibold mb-4">各長度區間平均曝光</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                      tick={{ fontSize: 12 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip
                      formatter={(value: number) => [value.toLocaleString(), "平均曝光"]}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid hsl(var(--border))",
                        backgroundColor: "hsl(var(--background))",
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
          <div className="space-y-3">
            {snapshot.content_length.map((item, idx) => {
              const isBest = item.range === bestRange?.range;
              const rangeLabel = item.range.split(" ")[0];

              return (
                <div
                  key={item.range}
                  className={cn(
                    "flex items-center gap-4 p-3 rounded-xl border transition-all hover:shadow-md",
                    isBest
                      ? "bg-gradient-to-r from-emerald-500/10 to-emerald-500/5 border-emerald-500/30"
                      : "bg-gradient-to-r from-background to-muted/20"
                  )}
                >
                  {/* 色塊 */}
                  <div
                    className="w-1.5 h-12 rounded-full"
                    style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                  />

                  {/* 長度區間 */}
                  <div className="min-w-[80px]">
                    <div className="text-sm font-semibold">{rangeLabel}</div>
                    <div className="text-[11px] text-muted-foreground">{item.count} 篇</div>
                  </div>

                  {/* 數據 */}
                  <div className="flex-1 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-muted-foreground">平均曝光</div>
                      <div className="text-sm font-semibold">{formatNumber(item.avg_views)}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[11px] text-muted-foreground">vs 平均</div>
                      <div className={cn(
                        "text-sm font-medium flex items-center justify-end gap-1",
                        item.vs_average >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      )}>
                        {item.vs_average >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                        {item.vs_average >= 0 ? "+" : ""}{(item.vs_average * 100).toFixed(0)}%
                      </div>
                    </div>
                  </div>

                  {/* 最佳標記 */}
                  {isBest && (
                    <Badge className="text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                      最佳
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* AI 分析區 */}
        <div className="mt-6 rounded-2xl border bg-gradient-to-br from-emerald-500/5 to-transparent p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-emerald-500/10">
              <Sparkles className="size-4 text-emerald-500" />
            </div>
            <h3 className="text-[14px] font-semibold">AI 分析</h3>
          </div>
          <p className="text-[14px] leading-relaxed mb-3">{data.summary}</p>
          <ul className="space-y-2">
            {data.insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-3 text-[13px]">
                <span className="flex-shrink-0 size-1.5 rounded-full bg-emerald-500 mt-2" />
                <span className="text-muted-foreground">{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
