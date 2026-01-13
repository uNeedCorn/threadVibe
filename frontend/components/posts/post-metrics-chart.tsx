"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { createClient } from "@/lib/supabase/client";

interface MetricsDataPoint {
  bucket_ts: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
}

interface PostMetricsChartProps {
  postId: string;
  publishedAt?: string;
}

type MetricType = "views" | "engagement";

const CHART_COLORS = {
  views: "#2563eb",     // blue-600
  likes: "#dc2626",     // red-600
  replies: "#16a34a",   // green-600
  reposts: "#ca8a04",   // yellow-600
  quotes: "#9333ea",    // purple-600
};

export function PostMetricsChart({ postId, publishedAt }: PostMetricsChartProps) {
  const [data, setData] = useState<MetricsDataPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [metricType, setMetricType] = useState<MetricType>("views");

  useEffect(() => {
    async function fetchMetrics() {
      setIsLoading(true);

      try {
        const supabase = createClient();

        // 判斷發文時間是否超過 72 小時
        let postPublishedAt = publishedAt;
        if (!postPublishedAt) {
          // 如果沒有傳入 publishedAt，從資料庫取得
          const { data: postData } = await supabase
            .from("workspace_threads_posts")
            .select("published_at")
            .eq("id", postId)
            .single();
          postPublishedAt = postData?.published_at;
        }

        const hoursAgo = postPublishedAt
          ? (Date.now() - new Date(postPublishedAt).getTime()) / (1000 * 60 * 60)
          : 999;

        let allMetrics: MetricsDataPoint[] = [];

        if (hoursAgo > 72) {
          // 超過 72 小時：使用小時表
          const { data: metricsHourly, error } = await supabase
            .from("workspace_threads_post_metrics_hourly")
            .select("bucket_ts, views, likes, replies, reposts, quotes")
            .eq("workspace_threads_post_id", postId)
            .order("bucket_ts", { ascending: true });

          if (error) {
            console.error("Fetch hourly metrics error:", error);
            setData([]);
            return;
          }

          allMetrics = (metricsHourly || []).map((m) => ({
            bucket_ts: m.bucket_ts,
            views: m.views || 0,
            likes: m.likes || 0,
            replies: m.replies || 0,
            reposts: m.reposts || 0,
            quotes: m.quotes || 0,
          }));
        } else {
          // 72 小時內：使用 15 分鐘表，只取 :00 和 :30 的資料
          const { data: metrics15m, error } = await supabase
            .from("workspace_threads_post_metrics_15m")
            .select("bucket_ts, views, likes, replies, reposts, quotes")
            .eq("workspace_threads_post_id", postId)
            .order("bucket_ts", { ascending: true });

          if (error) {
            console.error("Fetch 15m metrics error:", error);
            setData([]);
            return;
          }

          // 過濾只保留 :00 和 :30 的資料
          allMetrics = (metrics15m || [])
            .filter((m) => {
              const minutes = new Date(m.bucket_ts).getMinutes();
              return minutes === 0 || minutes === 30;
            })
            .map((m) => ({
              bucket_ts: m.bucket_ts,
              views: m.views || 0,
              likes: m.likes || 0,
              replies: m.replies || 0,
              reposts: m.reposts || 0,
              quotes: m.quotes || 0,
            }));
        }

        setData(allMetrics);
      } catch (err) {
        console.error("Fetch metrics error:", err);
      } finally {
        setIsLoading(false);
      }
    }

    if (postId) {
      fetchMetrics();
    }
  }, [postId, publishedAt]);

  const chartConfig = useMemo((): ChartConfig => {
    if (metricType === "views") {
      return {
        views: { label: "觀看", color: CHART_COLORS.views },
      } satisfies ChartConfig;
    }
    return {
      likes: { label: "讚", color: CHART_COLORS.likes },
      replies: { label: "回覆", color: CHART_COLORS.replies },
      reposts: { label: "轉發", color: CHART_COLORS.reposts },
      quotes: { label: "引用", color: CHART_COLORS.quotes },
    } satisfies ChartConfig;
  }, [metricType]);

  const formatTime = (bucketTs: string) => {
    const date = new Date(bucketTs);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
    }
    if (diffDays < 7) {
      return `${diffDays}天前 ${date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`;
    }
    return date.toLocaleDateString("zh-TW", { month: "short", day: "numeric" });
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-[200px] w-full" />
      </div>
    );
  }

  if (data.length < 2) {
    return (
      <div className="rounded-lg border bg-muted/20 p-6 text-center">
        <p className="text-sm text-muted-foreground">
          成效數據不足，無法顯示趨勢圖
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          需要至少 2 個時間點的數據
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">成效趨勢</h3>
        <Tabs value={metricType} onValueChange={(v) => setMetricType(v as MetricType)}>
          <TabsList className="h-7">
            <TabsTrigger value="views" className="h-6 px-2 text-xs">
              觀看
            </TabsTrigger>
            <TabsTrigger value="engagement" className="h-6 px-2 text-xs">
              互動
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <ChartContainer config={chartConfig} className="h-[200px] w-full">
        <LineChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="bucket_ts"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={formatTime}
            fontSize={10}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            width={40}
            fontSize={10}
            tickFormatter={(value) => {
              if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
              if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
              return value.toString();
            }}
          />
          <ChartTooltip
            cursor={false}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const dataPoint = payload[0].payload as MetricsDataPoint;
              return (
                <ChartTooltipContent
                  active={active}
                  payload={payload}
                  label={formatTime(dataPoint.bucket_ts)}
                  hideLabel={false}
                />
              );
            }}
          />
          {metricType === "engagement" && <ChartLegend content={<ChartLegendContent />} />}

          {metricType === "views" ? (
            <Line
              type="monotone"
              dataKey="views"
              stroke={CHART_COLORS.views}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          ) : (
            <>
              <Line
                type="monotone"
                dataKey="likes"
                stroke={CHART_COLORS.likes}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="replies"
                stroke={CHART_COLORS.replies}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="reposts"
                stroke={CHART_COLORS.reposts}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
              />
              <Line
                type="monotone"
                dataKey="quotes"
                stroke={CHART_COLORS.quotes}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 3 }}
              />
            </>
          )}
        </LineChart>
      </ChartContainer>

      <p className="text-center text-xs text-muted-foreground">
        共 {data.length} 個數據點
      </p>
    </div>
  );
}
