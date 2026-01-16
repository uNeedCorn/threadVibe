"use client";

import { useMemo, useState } from "react";
import {
  Eye,
  Calendar,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Image,
  Film,
  FileText,
  Layers,
} from "lucide-react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Cell,
  ZAxis,
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
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatNumber, truncateText } from "@/lib/insights-utils";
import {
  LONGTAIL_STATUS_CONFIG,
  getEvergreenColor,
  type LongtailStatus,
} from "@/lib/longtail-utils";
import { TEAL } from "@/lib/design-tokens";
import type { LongtailPageData, PostWithMetrics } from "../page";

interface Props {
  data: LongtailPageData;
}

type SortKey = "recent30d" | "evergreenIndex" | "longtailRatio" | "daysSince";
type SortDirection = "asc" | "desc";

export function EvergreenContentTab({ data }: Props) {
  const { posts, isLoading } = data;
  const [sortKey, setSortKey] = useState<SortKey>("evergreenIndex");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showAll, setShowAll] = useState(false);

  // 排序貼文
  const sortedPosts = useMemo(() => {
    const sorted = [...posts].sort((a, b) => {
      let aVal: number;
      let bVal: number;

      switch (sortKey) {
        case "recent30d":
          // 模擬近 30 天曝光（使用當前曝光 * 長尾比例作為估算）
          aVal = a.currentViews * a.longtailRatio;
          bVal = b.currentViews * b.longtailRatio;
          break;
        case "evergreenIndex":
          aVal = a.evergreenIndex;
          bVal = b.evergreenIndex;
          break;
        case "longtailRatio":
          aVal = a.longtailRatio;
          bVal = b.longtailRatio;
          break;
        case "daysSince":
          aVal = a.daysSincePublish;
          bVal = b.daysSincePublish;
          break;
        default:
          aVal = 0;
          bVal = 0;
      }

      return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
    });

    return showAll ? sorted : sorted.slice(0, 10);
  }, [posts, sortKey, sortDirection, showAll]);

  // 散佈圖數據
  const scatterData = useMemo(() => {
    return posts.map((post) => ({
      x: post.daysSincePublish,
      y: Math.round(post.currentViews * post.longtailRatio), // 長尾期間曝光（7天後）
      z: post.currentViews,
      postId: post.id,
      text: post.text,
      evergreenIndex: post.evergreenIndex,
      status: post.status,
    }));
  }, [posts]);

  // 處理排序
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
  };

  // 取得媒體類型圖示
  const getMediaIcon = (mediaType: string | null) => {
    switch (mediaType) {
      case "IMAGE":
        return <Image className="size-4 text-muted-foreground" />;
      case "VIDEO":
        return <Film className="size-4 text-muted-foreground" />;
      case "CAROUSEL_ALBUM":
        return <Layers className="size-4 text-muted-foreground" />;
      default:
        return <FileText className="size-4 text-muted-foreground" />;
    }
  };

  // 取得狀態配置
  const getStatusConfig = (status: string) => {
    return (
      LONGTAIL_STATUS_CONFIG[status as LongtailStatus] ||
      LONGTAIL_STATUS_CONFIG.growing
    );
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
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
            <Skeleton className="h-[400px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 年齡 vs 長尾曝光散佈圖 */}
      <Card>
        <CardHeader>
          <CardTitle>貼文年齡 vs 長尾曝光</CardTitle>
          <CardDescription>
            X 軸為發布天數，Y 軸為 7 天後曝光數，氣泡大小為總曝光
          </CardDescription>
        </CardHeader>
        <CardContent>
          {scatterData.length === 0 ? (
            <div className="flex h-[300px] items-center justify-center text-muted-foreground">
              暫無數據
            </div>
          ) : (
            <ChartContainer
              config={{
                scatter: { label: "貼文", color: TEAL[500] },
              }}
              className="h-[350px] w-full"
            >
              <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="發布天數"
                  tickLine={false}
                  axisLine={false}
                  label={{
                    value: "發布天數",
                    position: "bottom",
                    offset: 20,
                    fontSize: 12,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="長尾曝光"
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => formatNumber(v)}
                  label={{
                    value: "長尾曝光",
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 12,
                  }}
                />
                <ZAxis
                  type="number"
                  dataKey="z"
                  name="總曝光"
                  range={[40, 400]}
                />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value, name) => {
                        if (name === "x") return [`${value} 天`, "發布天數"];
                        if (name === "y")
                          return [formatNumber(value as number), "長尾曝光"];
                        if (name === "z")
                          return [formatNumber(value as number), "總曝光"];
                        return [value, name];
                      }}
                    />
                  }
                />
                <Scatter data={scatterData} fill={TEAL[500]}>
                  {scatterData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={getEvergreenColor(entry.evergreenIndex)}
                      fillOpacity={0.7}
                    />
                  ))}
                </Scatter>
              </ScatterChart>
            </ChartContainer>
          )}

          {/* 圖例說明 */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-full bg-amber-500" />
              <span className="text-muted-foreground">舊文復活</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">常青</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-full bg-teal-500" />
              <span className="text-muted-foreground">成長中</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="size-3 rounded-full bg-slate-400" />
              <span className="text-muted-foreground">一般/休眠</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 常青內容排行榜 */}
      <Card>
        <CardHeader>
          <CardTitle>常青內容排行榜</CardTitle>
          <CardDescription>
            發布超過 7 天的貼文，按長尾表現排序
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead className="min-w-[200px]">貼文</TableHead>
                  <TableHead
                    className="cursor-pointer"
                    onClick={() => handleSort("daysSince")}
                  >
                    <div className="flex items-center gap-1">
                      發布天數
                      {sortKey === "daysSince" &&
                        (sortDirection === "desc" ? (
                          <ChevronDown className="size-4" />
                        ) : (
                          <ChevronUp className="size-4" />
                        ))}
                    </div>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer text-right"
                    onClick={() => handleSort("evergreenIndex")}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-end gap-1">
                          <span className="border-b border-dashed border-muted-foreground/50">
                            常青指數
                          </span>
                          {sortKey === "evergreenIndex" &&
                            (sortDirection === "desc" ? (
                              <ChevronDown className="size-4" />
                            ) : (
                              <ChevronUp className="size-4" />
                            ))}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[240px]">
                        <p>近 30 天日均曝光 ÷ 前 7 天日均曝光</p>
                        <p className="mt-1 text-muted-foreground">
                          &gt;0.3 為常青、&gt;1.0 為舊文復活
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead
                    className="cursor-pointer text-right"
                    onClick={() => handleSort("longtailRatio")}
                  >
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div className="flex items-center justify-end gap-1">
                          <span className="border-b border-dashed border-muted-foreground/50">
                            長尾比例
                          </span>
                          {sortKey === "longtailRatio" &&
                            (sortDirection === "desc" ? (
                              <ChevronDown className="size-4" />
                            ) : (
                              <ChevronUp className="size-4" />
                            ))}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[240px]">
                        <p>發布 7 天後的流量佔總流量比例</p>
                        <p className="mt-1 text-muted-foreground">
                          越高代表長尾效果越好
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TableHead>
                  <TableHead className="w-24">狀態</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPosts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      暫無符合條件的貼文
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedPosts.map((post, index) => {
                    const statusConfig = getStatusConfig(post.status);
                    return (
                      <TableRow key={post.id}>
                        <TableCell className="font-medium text-muted-foreground">
                          {index + 1}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-start gap-2">
                            {getMediaIcon(post.mediaType)}
                            <span className="line-clamp-2 text-sm">
                              {truncateText(post.text, 50)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Calendar className="size-3 text-muted-foreground" />
                            <span>{post.daysSincePublish} 天</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Tooltip>
                            <TooltipTrigger>
                              <span
                                className={cn(
                                  "font-medium tabular-nums",
                                  post.evergreenIndex > 1.0
                                    ? "text-amber-600"
                                    : post.evergreenIndex > 0.3
                                      ? "text-emerald-600"
                                      : post.evergreenIndex > 0.15
                                        ? "text-primary"
                                        : "text-muted-foreground"
                                )}
                              >
                                {post.evergreenIndex.toFixed(2)}x
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              近期日均是前 7 天的 {post.evergreenIndex.toFixed(2)} 倍
                            </TooltipContent>
                          </Tooltip>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {(post.longtailRatio * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={cn("gap-1", statusConfig.bgColor)}
                          >
                            <span>{statusConfig.icon}</span>
                            <span className={statusConfig.color}>
                              {statusConfig.label}
                            </span>
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* 顯示更多按鈕 */}
          {posts.length > 10 && (
            <div className="mt-4 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAll(!showAll)}
              >
                {showAll ? (
                  <>
                    <ChevronUp className="mr-1 size-4" />
                    收起
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 size-4" />
                    顯示全部 ({posts.length} 篇)
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 常青內容精選 */}
      {posts.filter((p) => p.evergreenIndex > 0.3).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>常青內容精選</CardTitle>
            <CardDescription>
              常青指數 &gt; 0.3 的優質長尾內容
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              {posts
                .filter((p) => p.evergreenIndex > 0.3)
                .sort((a, b) => b.evergreenIndex - a.evergreenIndex)
                .slice(0, 3)
                .map((post) => (
                  <div
                    key={post.id}
                    className="rounded-lg border bg-gradient-to-br from-emerald-500/5 to-transparent p-4"
                  >
                    <div className="mb-3 flex items-start justify-between">
                      {getMediaIcon(post.mediaType)}
                      <Badge
                        variant="secondary"
                        className="bg-emerald-500/10 text-emerald-600"
                      >
                        🌲 常青
                      </Badge>
                    </div>
                    <p className="mb-3 line-clamp-3 text-sm">
                      {truncateText(post.text, 100)}
                    </p>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <div>
                        <span className="text-muted-foreground">常青指數：</span>
                        <span className="font-medium text-emerald-600">
                          {post.evergreenIndex.toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">長尾比例：</span>
                        <span className="font-medium">
                          {(post.longtailRatio * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">發布：</span>
                        <span className="font-medium">
                          {post.daysSincePublish} 天前
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
