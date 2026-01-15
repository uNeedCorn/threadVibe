"use client";

import { useMemo } from "react";
import { Image, Film, FileText, Layers } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  LabelList,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { WEEKDAY_NAMES, getHeatmapColor } from "@/lib/insights-utils";
import { TEAL } from "@/lib/design-tokens";
import { HeatmapLegend } from "@/components/insights/shared-components";
import type { LongtailPageData } from "../page";

interface Props {
  data: LongtailPageData;
}

interface TagLongtailStats {
  id: string;
  name: string;
  color: string;
  postCount: number;
  avgLongtailRatio: number;
  avgEvergreenIndex: number;
}

interface MediaTypeLongtailStats {
  type: string;
  label: string;
  icon: React.ReactNode;
  postCount: number;
  avgLongtailRatio: number;
  avgEvergreenIndex: number;
}

const chartConfig: ChartConfig = {
  longtailRatio: {
    label: "長尾比例",
    color: TEAL[500],
  },
};

export function FeatureAnalysisTab({ data }: Props) {
  const { posts, isLoading } = data;

  // 計算標籤長尾統計
  const tagStats = useMemo<TagLongtailStats[]>(() => {
    const tagMap = new Map<
      string,
      {
        id: string;
        name: string;
        color: string;
        posts: { longtailRatio: number; evergreenIndex: number }[];
      }
    >();

    for (const post of posts) {
      for (const tag of post.tags) {
        if (!tagMap.has(tag.id)) {
          tagMap.set(tag.id, {
            id: tag.id,
            name: tag.name,
            color: tag.color,
            posts: [],
          });
        }
        tagMap.get(tag.id)!.posts.push({
          longtailRatio: post.longtailRatio,
          evergreenIndex: post.evergreenIndex,
        });
      }
    }

    return Array.from(tagMap.values())
      .filter((t) => t.posts.length >= 2) // 至少 2 篇才有意義
      .map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color,
        postCount: t.posts.length,
        avgLongtailRatio:
          t.posts.reduce((sum, p) => sum + p.longtailRatio, 0) / t.posts.length,
        avgEvergreenIndex:
          t.posts.reduce((sum, p) => sum + p.evergreenIndex, 0) / t.posts.length,
      }))
      .sort((a, b) => b.avgLongtailRatio - a.avgLongtailRatio);
  }, [posts]);

  // 計算媒體類型長尾統計
  const mediaTypeStats = useMemo<MediaTypeLongtailStats[]>(() => {
    const mediaMap = new Map<
      string,
      { posts: { longtailRatio: number; evergreenIndex: number }[] }
    >();

    for (const post of posts) {
      const type = post.mediaType || "TEXT";
      if (!mediaMap.has(type)) {
        mediaMap.set(type, { posts: [] });
      }
      mediaMap.get(type)!.posts.push({
        longtailRatio: post.longtailRatio,
        evergreenIndex: post.evergreenIndex,
      });
    }

    const getMediaLabel = (type: string) => {
      switch (type) {
        case "IMAGE":
          return "圖片";
        case "VIDEO":
          return "影片";
        case "CAROUSEL_ALBUM":
          return "輪播";
        default:
          return "純文字";
      }
    };

    const getMediaIcon = (type: string) => {
      switch (type) {
        case "IMAGE":
          return <Image className="size-4" />;
        case "VIDEO":
          return <Film className="size-4" />;
        case "CAROUSEL_ALBUM":
          return <Layers className="size-4" />;
        default:
          return <FileText className="size-4" />;
      }
    };

    return Array.from(mediaMap.entries())
      .map(([type, data]) => ({
        type,
        label: getMediaLabel(type),
        icon: getMediaIcon(type),
        postCount: data.posts.length,
        avgLongtailRatio:
          data.posts.reduce((sum, p) => sum + p.longtailRatio, 0) /
          data.posts.length,
        avgEvergreenIndex:
          data.posts.reduce((sum, p) => sum + p.evergreenIndex, 0) /
          data.posts.length,
      }))
      .sort((a, b) => b.avgLongtailRatio - a.avgLongtailRatio);
  }, [posts]);

  // 計算發布時段熱力圖數據
  const heatmapData = useMemo(() => {
    // 7 x 12 矩陣 (7 天 x 12 個 2 小時區間)
    const matrix: number[][] = Array(7)
      .fill(null)
      .map(() => Array(12).fill(0));
    const counts: number[][] = Array(7)
      .fill(null)
      .map(() => Array(12).fill(0));

    for (const post of posts) {
      const date = new Date(post.publishedAt);
      const dayOfWeek = date.getDay();
      const hourBucket = Math.floor(date.getHours() / 2);

      matrix[dayOfWeek][hourBucket] += post.longtailRatio;
      counts[dayOfWeek][hourBucket] += 1;
    }

    // 計算平均值
    let maxValue = 0;
    const avgMatrix = matrix.map((row, i) =>
      row.map((sum, j) => {
        const avg = counts[i][j] > 0 ? sum / counts[i][j] : 0;
        if (avg > maxValue) maxValue = avg;
        return { avg, count: counts[i][j] };
      })
    );

    return { avgMatrix, maxValue };
  }, [posts]);

  // 標籤柱狀圖數據
  const tagChartData = useMemo(() => {
    return tagStats.slice(0, 8).map((tag) => ({
      name: tag.name,
      value: tag.avgLongtailRatio * 100,
      fill: tag.color,
      postCount: tag.postCount,
    }));
  }, [tagStats]);

  // 媒體類型柱狀圖數據
  const mediaChartData = useMemo(() => {
    return mediaTypeStats.map((item) => ({
      name: item.label,
      value: item.avgLongtailRatio * 100,
      fill: TEAL[500],
      postCount: item.postCount,
    }));
  }, [mediaTypeStats]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-[300px] w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* 標籤 vs 長尾比例 */}
        <Card>
          <CardHeader>
            <CardTitle>標籤 vs 長尾比例</CardTitle>
            <CardDescription>
              各標籤的平均長尾比例（至少 2 篇貼文）
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tagChartData.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                暫無標籤數據
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart
                  data={tagChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 50, left: 20, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={true}
                    vertical={false}
                  />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    width={80}
                    tick={{ fontSize: 12 }}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name, props) => [
                          `${(value as number).toFixed(1)}%（${props.payload.postCount} 篇）`,
                          "平均長尾比例",
                        ]}
                      />
                    }
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {tagChartData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                    <LabelList
                      dataKey="value"
                      position="right"
                      formatter={(v: number) => `${v.toFixed(1)}%`}
                      className="fill-foreground text-xs"
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        {/* 媒體類型 vs 長尾比例 */}
        <Card>
          <CardHeader>
            <CardTitle>媒體類型 vs 長尾比例</CardTitle>
            <CardDescription>不同媒體類型的平均長尾比例</CardDescription>
          </CardHeader>
          <CardContent>
            {mediaChartData.length === 0 ? (
              <div className="flex h-[300px] items-center justify-center text-muted-foreground">
                暫無數據
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="h-[300px] w-full">
                <BarChart
                  data={mediaChartData}
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v.toFixed(0)}%`}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value, name, props) => [
                          `${(value as number).toFixed(1)}%（${props.payload.postCount} 篇）`,
                          "平均長尾比例",
                        ]}
                      />
                    }
                  />
                  <Bar dataKey="value" fill={TEAL[500]} radius={[4, 4, 0, 0]}>
                    <LabelList
                      dataKey="value"
                      position="top"
                      formatter={(v: number) => `${v.toFixed(1)}%`}
                      className="fill-foreground text-xs"
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 發布時段熱力圖 */}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>發布時段 vs 長尾效果</CardTitle>
            <CardDescription>
              不同發布時段的平均長尾比例（顏色越深表示長尾效果越好）
            </CardDescription>
          </div>
          <HeatmapLegend />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr>
                  <th className="w-16 pb-2 text-left text-xs font-normal text-muted-foreground">
                    時段
                  </th>
                  {Array.from({ length: 12 }, (_, i) => (
                    <th
                      key={i}
                      className="pb-2 text-center text-xs font-normal text-muted-foreground"
                    >
                      {i * 2}:00
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {WEEKDAY_NAMES.map((dayName, dayIndex) => (
                  <tr key={dayIndex}>
                    <td className="py-1 text-xs text-muted-foreground">
                      {dayName}
                    </td>
                    {heatmapData.avgMatrix[dayIndex].map((cell, hourIndex) => (
                      <td key={hourIndex} className="p-0.5">
                        <div
                          className={cn(
                            "flex h-8 items-center justify-center rounded text-xs",
                            getHeatmapColor(cell.avg, heatmapData.maxValue)
                          )}
                          title={`${dayName} ${hourIndex * 2}:00-${(hourIndex + 1) * 2}:00\n平均長尾比例: ${(cell.avg * 100).toFixed(1)}%\n貼文數: ${cell.count}`}
                        >
                          {cell.count > 0 && (
                            <span
                              className={cn(
                                cell.avg / heatmapData.maxValue > 0.5
                                  ? "text-white"
                                  : "text-foreground"
                              )}
                            >
                              {(cell.avg * 100).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* 說明 */}
          <p className="mt-4 text-sm text-muted-foreground">
            提示：在深色區塊對應的時段發布內容，可能獲得更好的長尾效果。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
