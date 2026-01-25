"use client";

import { Image, Video, FileText, Images, Lightbulb, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { iconGradients, typography, spacing, semanticColors } from "@/components/report-shared";
import type { ContentPatternReportContent, ContentPatternSnapshot } from "@/hooks/use-content-pattern-report";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

interface Props {
  data: ContentPatternReportContent["media_type_analysis"];
  snapshot: ContentPatternSnapshot;
}

const MEDIA_TYPE_LABELS: Record<string, string> = {
  TEXT_POST: "純文字", IMAGE: "圖片", VIDEO: "影片", CAROUSEL_ALBUM: "輪播", REPOST_FACADE: "轉發",
  "純文字": "純文字", "圖片": "圖片", "影片": "影片", "輪播": "輪播", "轉發": "轉發",
};

function getMediaTypeLabel(type: string): string {
  return MEDIA_TYPE_LABELS[type] || type;
}

const MEDIA_TYPE_ICONS: Record<string, React.ElementType> = {
  "純文字": FileText, "圖片": Image, "影片": Video, "輪播": Images,
  TEXT_POST: FileText, IMAGE: Image, VIDEO: Video, CAROUSEL_ALBUM: Images,
};

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function MediaTypeSection({ data, snapshot }: Props) {
  const chartData = snapshot.media_type.map((item, idx) => ({
    name: getMediaTypeLabel(item.type),
    曝光: item.avg_views,
    fill: COLORS[idx % COLORS.length],
  }));

  const bestType = snapshot.media_type.reduce((best, current) =>
    current.avg_views > best.avg_views ? current : best
  , snapshot.media_type[0]);

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3">
          <div className={cn("p-2.5 rounded-xl", iconGradients.blue)}>
            <Image className="size-5 text-white" />
          </div>
          <div>
            <h2 className={typography.cardTitle}>內容格式效益</h2>
            <p className={typography.caption}>分析不同媒體格式的表現差異</p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 左側：圖表 */}
          {chartData.length > 0 && (
            <div className="rounded-xl border bg-muted/30 p-4">
              <h3 className={cn(typography.sectionTitle, "mb-4")}>平均曝光對比</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-muted/50" />
                    <XAxis type="number" tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <Tooltip
                      formatter={(value: number) => [value.toLocaleString(), "平均曝光"]}
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "12px",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      }}
                    />
                    <Bar dataKey="曝光" radius={[0, 4, 4, 0]} maxBarSize={32}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 右側：詳細數據卡片 */}
          <div className="grid gap-3 grid-cols-2">
            {snapshot.media_type.map((item, idx) => {
              const Icon = MEDIA_TYPE_ICONS[item.type] || FileText;
              const isBest = item.type === bestType?.type;

              return (
                <div
                  key={item.type}
                  className={cn(
                    "rounded-xl border p-4 transition-all hover:shadow-md",
                    isBest ? "bg-emerald-50/50 border-emerald-200" : "bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: `${COLORS[idx % COLORS.length]}20` }}>
                      <Icon className="size-4" style={{ color: COLORS[idx % COLORS.length] }} />
                    </div>
                    <span className="font-medium">{getMediaTypeLabel(item.type)}</span>
                    {isBest && <Badge className={cn("ml-auto text-xs", semanticColors.success.badge)}>最佳</Badge>}
                  </div>
                  <div className={spacing.listCompact}>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">平均曝光</span>
                      <span className={cn("font-semibold", typography.number)}>{formatNumber(item.avg_views)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">互動率</span>
                      <span className={cn("font-medium", typography.number)}>{(item.avg_engagement_rate * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">vs 平均</span>
                      <span className={cn("font-medium flex items-center gap-1", item.vs_average >= 0 ? "text-emerald-600" : "text-rose-600")}>
                        {item.vs_average >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                        {item.vs_average >= 0 ? "+" : ""}{(item.vs_average * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Badge variant="outline" className="text-xs mt-1">{item.count} 篇</Badge>
                  </div>
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
          <ul className={cn(spacing.listCompact, "mb-4")}>
            {data.insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="shrink-0 size-1.5 rounded-full bg-blue-500 mt-2" />
                <span className={typography.caption}>{insight}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-start gap-2 pt-3 border-t">
            <Lightbulb className="size-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm font-medium text-blue-600">{data.recommendation}</p>
          </div>
        </section>
      </CardContent>
    </Card>
  );
}
