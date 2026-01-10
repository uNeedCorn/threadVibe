"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TimeRange } from "./time-range-tabs";

interface MetricSnapshot {
  captured_at: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  engagement_rate: number;
  reply_rate: number;
  repost_rate: number;
  quote_rate: number;
  virality_score: number;
}

interface AccountAverage {
  avgViews: number;
  avgLikes: number;
  avgReplies: number;
  avgReposts: number;
  avgQuotes: number;
  avgEngagementRate: number;
  avgReplyRate: number;
  avgRepostRate: number;
  avgQuoteRate: number;
  avgViralityScore: number;
}

interface PostMetricsChartProps {
  metrics: MetricSnapshot[];
  accountAverage: AccountAverage | null;
  timeRange: TimeRange;
}

type MetricType = "count" | "rate";

const countMetrics = [
  { key: "views", name: "觀看", color: "var(--chart-1)" },
  { key: "likes", name: "讚", color: "var(--chart-2)" },
  { key: "replies", name: "回覆", color: "var(--chart-3)" },
  { key: "reposts", name: "轉發", color: "var(--chart-4)" },
  { key: "quotes", name: "引用", color: "var(--chart-5)" },
];

const rateMetrics = [
  { key: "engagement_rate", name: "互動率", color: "var(--chart-1)" },
  { key: "reply_rate", name: "回覆率", color: "var(--chart-2)" },
  { key: "repost_rate", name: "轉發率", color: "var(--chart-3)" },
  { key: "quote_rate", name: "引用率", color: "var(--chart-4)" },
  { key: "virality_score", name: "傳播力", color: "var(--chart-5)" },
];

export function PostMetricsChart({
  metrics,
  accountAverage,
  timeRange,
}: PostMetricsChartProps) {
  const [metricType, setMetricType] = useState<MetricType>("count");
  const [selectedMetric, setSelectedMetric] = useState<string>("views");

  const currentMetrics = metricType === "count" ? countMetrics : rateMetrics;
  const currentMetricConfig = currentMetrics.find((m) => m.key === selectedMetric) || currentMetrics[0];

  // 格式化時間軸
  const formatXAxis = (dateStr: string) => {
    const date = new Date(dateStr);
    switch (timeRange) {
      case "24h":
        return date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
      case "7d":
        return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:00`;
      case "30d":
      case "all":
        return `${date.getMonth() + 1}/${date.getDate()}`;
      default:
        return `${date.getMonth() + 1}/${date.getDate()}`;
    }
  };

  // 取得帳號平均值
  const getAverageValue = (key: string): number | null => {
    if (!accountAverage) return null;
    const avgMap: Record<string, number> = {
      views: accountAverage.avgViews,
      likes: accountAverage.avgLikes,
      replies: accountAverage.avgReplies,
      reposts: accountAverage.avgReposts,
      quotes: accountAverage.avgQuotes,
      engagement_rate: accountAverage.avgEngagementRate,
      reply_rate: accountAverage.avgReplyRate,
      repost_rate: accountAverage.avgRepostRate,
      quote_rate: accountAverage.avgQuoteRate,
      virality_score: accountAverage.avgViralityScore,
    };
    return avgMap[key] ?? null;
  };

  const averageValue = getAverageValue(selectedMetric);

  // 建立 chart config
  const chartConfig: ChartConfig = {
    [selectedMetric]: {
      label: currentMetricConfig.name,
      color: currentMetricConfig.color,
    },
  };

  // 處理指標類型切換
  const handleMetricTypeChange = (type: MetricType) => {
    setMetricType(type);
    // 切換時重設選擇的指標
    setSelectedMetric(type === "count" ? "views" : "engagement_rate");
  };

  if (metrics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>成效趨勢</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-64 items-center justify-center text-muted-foreground">
            尚無歷史資料
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle>成效趨勢</CardTitle>
          <div className="flex flex-wrap gap-2">
            {/* 指標類型切換 */}
            <Tabs value={metricType} onValueChange={(v) => handleMetricTypeChange(v as MetricType)}>
              <TabsList>
                <TabsTrigger value="count">數量指標</TabsTrigger>
                <TabsTrigger value="rate">比率指標</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        {/* 指標選擇 */}
        <div className="flex flex-wrap gap-2 pt-2">
          {currentMetrics.map((metric) => (
            <button
              key={metric.key}
              onClick={() => setSelectedMetric(metric.key)}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                selectedMetric === metric.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {metric.name}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[320px] w-full">
          <LineChart
            data={metrics}
            margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="captured_at"
              tickFormatter={formatXAxis}
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) =>
                metricType === "rate" ? `${value.toFixed(1)}%` : formatYAxis(value)
              }
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    const date = new Date(value);
                    return date.toLocaleString("zh-TW");
                  }}
                  formatter={(value) => {
                    const formattedValue = metricType === "rate"
                      ? `${Number(value).toFixed(2)}%`
                      : Number(value).toLocaleString();
                    return formattedValue;
                  }}
                />
              }
            />
            <Line
              type="monotone"
              dataKey={selectedMetric}
              name={currentMetricConfig.name}
              stroke={currentMetricConfig.color}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            {/* 帳號平均線 */}
            {averageValue !== null && (
              <ReferenceLine
                y={averageValue}
                stroke="var(--muted-foreground)"
                strokeDasharray="5 5"
                label={{
                  value: "帳號平均",
                  position: "insideTopRight",
                  fill: "var(--muted-foreground)",
                  fontSize: 11,
                  offset: 10,
                }}
              />
            )}
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}

function formatYAxis(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toString();
}
