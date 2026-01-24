"use client";

import { Image, Video, FileText, Images, Lightbulb, Sparkles, TrendingUp, TrendingDown } from "lucide-react";
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
  data: ContentPatternReportContent["media_type_analysis"];
  snapshot: ContentPatternSnapshot;
}

const MEDIA_TYPE_LABELS: Record<string, string> = {
  TEXT_POST: "純文字",
  IMAGE: "圖片",
  VIDEO: "影片",
  CAROUSEL_ALBUM: "輪播",
  REPOST_FACADE: "轉發",
  "純文字": "純文字",
  "圖片": "圖片",
  "影片": "影片",
  "輪播": "輪播",
  "轉發": "轉發",
};

function getMediaTypeLabel(type: string): string {
  return MEDIA_TYPE_LABELS[type] || type;
}

const MEDIA_TYPE_ICONS: Record<string, React.ElementType> = {
  "純文字": FileText,
  "圖片": Image,
  "影片": Video,
  "輪播": Images,
  TEXT_POST: FileText,
  IMAGE: Image,
  VIDEO: Video,
  CAROUSEL_ALBUM: Images,
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

  // 找出最佳媒體類型
  const bestType = snapshot.media_type.reduce((best, current) =>
    current.avg_views > best.avg_views ? current : best
  , snapshot.media_type[0]);

  return (
    <Card className="overflow-hidden">
      <CardContent className="pt-6">
        {/* 標題區 */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 shadow-lg shadow-blue-500/25">
            <Image className="size-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">內容格式效益</h2>
            <p className="text-[13px] text-muted-foreground">
              分析不同媒體格式的表現差異
            </p>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 左側：圖表 */}
          {chartData.length > 0 && (
            <div className="rounded-2xl border bg-gradient-to-br from-background to-muted/20 p-4">
              <h3 className="text-[14px] font-semibold mb-4">平均曝光對比</h3>
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                    <XAxis
                      type="number"
                      tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
                      tick={{ fontSize: 12 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={60}
                      tick={{ fontSize: 12 }}
                      stroke="hsl(var(--muted-foreground))"
                    />
                    <Tooltip
                      formatter={(value: number) => [value.toLocaleString(), "平均曝光"]}
                      labelFormatter={(label) => `${label}`}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid hsl(var(--border))",
                        backgroundColor: "hsl(var(--background))",
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
                    isBest
                      ? "bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/30"
                      : "bg-gradient-to-br from-background to-muted/20"
                  )}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div
                      className="p-1.5 rounded-lg"
                      style={{ backgroundColor: `${COLORS[idx % COLORS.length]}20` }}
                    >
                      <Icon className="size-4" style={{ color: COLORS[idx % COLORS.length] }} />
                    </div>
                    <span className="font-medium">{getMediaTypeLabel(item.type)}</span>
                    {isBest && (
                      <Badge className="ml-auto text-[10px] bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                        最佳
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-[13px]">
                      <span className="text-muted-foreground">平均曝光</span>
                      <span className="font-semibold">{formatNumber(item.avg_views)}</span>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-muted-foreground">互動率</span>
                      <span className="font-medium">{(item.avg_engagement_rate * 100).toFixed(2)}%</span>
                    </div>
                    <div className="flex justify-between text-[13px]">
                      <span className="text-muted-foreground">vs 平均</span>
                      <span className={cn(
                        "font-medium flex items-center gap-1",
                        item.vs_average >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                      )}>
                        {item.vs_average >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                        {item.vs_average >= 0 ? "+" : ""}{(item.vs_average * 100).toFixed(0)}%
                      </span>
                    </div>
                    <Badge variant="outline" className="text-[11px] mt-2">
                      {item.count} 篇
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* AI 分析區 */}
        <div className="mt-6 rounded-2xl border bg-gradient-to-br from-blue-500/5 to-transparent p-5">
          <div className="flex items-center gap-2 mb-3">
            <div className="p-1.5 rounded-lg bg-blue-500/10">
              <Sparkles className="size-4 text-blue-500" />
            </div>
            <h3 className="text-[14px] font-semibold">AI 分析</h3>
          </div>
          <p className="text-[14px] leading-relaxed mb-3">{data.summary}</p>
          <ul className="space-y-2 mb-4">
            {data.insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-3 text-[13px]">
                <span className="flex-shrink-0 size-1.5 rounded-full bg-blue-500 mt-2" />
                <span className="text-muted-foreground">{insight}</span>
              </li>
            ))}
          </ul>
          <div className="flex items-start gap-2 pt-3 border-t">
            <Lightbulb className="size-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-[13px] font-medium text-blue-600 dark:text-blue-400">
              {data.recommendation}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
