"use client";

import { useMemo } from "react";
import { Eye, Clock, TreeDeciduous, TrendingUp } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
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
import { formatNumber } from "@/lib/insights-utils";
import {
  LONGTAIL_CONTRIBUTION_COLORS,
  getLongtailRating,
} from "@/lib/longtail-utils";
import { KPICard, GrowthBadge } from "@/components/insights/shared-components";
import type { LongtailPageData } from "../page";

interface Props {
  data: LongtailPageData;
}

const pieChartConfig: ChartConfig = {
  views: {
    label: "曝光數",
  },
  burst: {
    label: "爆發期 (0-7天)",
    color: LONGTAIL_CONTRIBUTION_COLORS.burst,
  },
  growth: {
    label: "成長期 (7-30天)",
    color: LONGTAIL_CONTRIBUTION_COLORS.growth,
  },
  longtail: {
    label: "長尾期 (30-90天)",
    color: LONGTAIL_CONTRIBUTION_COLORS.longtail,
  },
  deepLongtail: {
    label: "深長尾 (90天+)",
    color: LONGTAIL_CONTRIBUTION_COLORS.deepLongtail,
  },
};

export function ContributionOverviewTab({ data }: Props) {
  const { contribution, accountLongtailRatio, evergreenPostCount, potentialScore, isLoading, posts } =
    data;

  // 圓餅圖數據
  const pieData = useMemo(() => {
    const total = contribution.totalViews;
    if (total === 0) return [];

    return [
      {
        name: "burst",
        label: "爆發期",
        value: contribution.burstViews,
        percentage: ((contribution.burstViews / total) * 100).toFixed(1),
        fill: LONGTAIL_CONTRIBUTION_COLORS.burst,
      },
      {
        name: "growth",
        label: "成長期",
        value: contribution.growthViews,
        percentage: ((contribution.growthViews / total) * 100).toFixed(1),
        fill: LONGTAIL_CONTRIBUTION_COLORS.growth,
      },
      {
        name: "longtail",
        label: "長尾期",
        value: contribution.longtailViews,
        percentage: ((contribution.longtailViews / total) * 100).toFixed(1),
        fill: LONGTAIL_CONTRIBUTION_COLORS.longtail,
      },
      {
        name: "deepLongtail",
        label: "深長尾",
        value: contribution.deepLongtailViews,
        percentage: ((contribution.deepLongtailViews / total) * 100).toFixed(1),
        fill: LONGTAIL_CONTRIBUTION_COLORS.deepLongtail,
      },
    ].filter((d) => d.value > 0);
  }, [contribution]);

  // 長尾比例（30天後）
  const longtailPercentage = useMemo(() => {
    const total = contribution.totalViews;
    if (total === 0) return 0;
    return (
      ((contribution.longtailViews + contribution.deepLongtailViews) / total) *
      100
    );
  }, [contribution]);

  // 評級
  const rating = getLongtailRating(potentialScore);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* KPI Skeleton */}
        <div className="grid gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-20" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
        {/* Chart Skeleton */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="mx-auto size-48 rounded-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-48 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI 卡片組 */}
      <div className="grid gap-4 md:grid-cols-4">
        <KPICard
          title="長尾比例"
          value={longtailPercentage}
          icon={<TrendingUp className="size-4" />}
          format="percent"
          periodLabel=""
          hint="7 天後流量佔總流量比例"
          isLoading={isLoading}
        />
        <KPICard
          title="常青貼文"
          value={evergreenPostCount}
          icon={<TreeDeciduous className="size-4" />}
          format="number"
          periodLabel=""
          suffix="篇"
          hint="常青指數 > 0.3 的貼文"
          isLoading={isLoading}
        />
        <KPICard
          title="總曝光數"
          value={contribution.totalViews}
          icon={<Eye className="size-4" />}
          format="number"
          periodLabel=""
          hint="所有分析貼文的累計曝光"
          isLoading={isLoading}
        />
        <KPICard
          title="分析貼文數"
          value={posts.length}
          icon={<Clock className="size-4" />}
          format="number"
          periodLabel=""
          suffix="篇"
          hint="發布超過 7 天的貼文"
          isLoading={isLoading}
        />
      </div>

      {/* 圖表區域 */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* 長尾流量佔比圓餅圖 */}
        <Card>
          <CardHeader>
            <CardTitle>長尾流量佔比</CardTitle>
            <CardDescription>各階段曝光分佈</CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length === 0 ? (
              <div className="flex h-[250px] items-center justify-center text-muted-foreground">
                暫無數據
              </div>
            ) : (
              <div className="flex items-center gap-6">
                <ChartContainer
                  config={pieChartConfig}
                  className="h-[250px] flex-1"
                >
                  <PieChart>
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) => {
                            const item = pieData.find((d) => d.name === name);
                            return [
                              `${formatNumber(value as number)} (${item?.percentage}%)`,
                              item?.label || name,
                            ];
                          }}
                        />
                      }
                    />
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.fill} />
                      ))}
                    </Pie>
                    {/* 中心文字 */}
                    <text
                      x="50%"
                      y="45%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-foreground text-2xl font-bold"
                    >
                      {longtailPercentage.toFixed(1)}%
                    </text>
                    <text
                      x="50%"
                      y="58%"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className="fill-muted-foreground text-xs"
                    >
                      長尾比例
                    </text>
                  </PieChart>
                </ChartContainer>

                {/* 圖例 */}
                <div className="flex flex-col gap-3 text-sm">
                  {pieData.map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                      <div
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: item.fill }}
                      />
                      <span className="text-muted-foreground">{item.label}</span>
                      <span className="ml-auto font-medium">
                        {item.percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 長尾潛力評分 */}
        <Card>
          <CardHeader>
            <CardTitle>長尾潛力評分</CardTitle>
            <CardDescription>帳號整體長尾表現評估</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center py-6">
              {/* 評分圓環 */}
              <div className="relative mb-6">
                <svg className="size-40" viewBox="0 0 100 100">
                  {/* 背景圓環 */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-muted"
                  />
                  {/* 進度圓環 */}
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${(potentialScore / 100) * 251.2} 251.2`}
                    transform="rotate(-90 50 50)"
                    className={cn(
                      potentialScore >= 80
                        ? "text-emerald-500"
                        : potentialScore >= 60
                          ? "text-primary"
                          : potentialScore >= 40
                            ? "text-amber-500"
                            : "text-destructive"
                    )}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold">{potentialScore}</span>
                  <span className="text-sm text-muted-foreground">分</span>
                </div>
              </div>

              {/* 評級標籤 */}
              <div
                className={cn(
                  "mb-4 rounded-full px-4 py-1.5 text-sm font-medium",
                  rating.bgColor,
                  "text-white"
                )}
              >
                {rating.label}
              </div>

              {/* 評級說明 */}
              <p className="text-center text-muted-foreground">
                {rating.description}
              </p>

              {/* 評分細項 */}
              <div className="mt-6 w-full space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">帳號長尾比例</span>
                  <span className="font-medium">
                    {longtailPercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">常青貼文佔比</span>
                  <span className="font-medium">
                    {posts.length > 0
                      ? ((evergreenPostCount / posts.length) * 100).toFixed(1)
                      : 0}
                    %
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">分析貼文數</span>
                  <span className="font-medium">{posts.length} 篇</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 階段說明 */}
      <Card>
        <CardHeader>
          <CardTitle>各階段說明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-4">
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2">
                <div
                  className="size-3 rounded-full"
                  style={{ backgroundColor: LONGTAIL_CONTRIBUTION_COLORS.burst }}
                />
                <span className="font-medium">爆發期</span>
              </div>
              <p className="text-sm text-muted-foreground">
                發布後 0-7 天，內容初始傳播階段，大部分流量集中在此期間。
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2">
                <div
                  className="size-3 rounded-full"
                  style={{ backgroundColor: LONGTAIL_CONTRIBUTION_COLORS.growth }}
                />
                <span className="font-medium">成長期</span>
              </div>
              <p className="text-sm text-muted-foreground">
                發布後 7-30 天，流量逐漸趨緩，但仍有穩定增長。
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2">
                <div
                  className="size-3 rounded-full"
                  style={{ backgroundColor: LONGTAIL_CONTRIBUTION_COLORS.longtail }}
                />
                <span className="font-medium">長尾期</span>
              </div>
              <p className="text-sm text-muted-foreground">
                發布後 30-90 天，常青內容會在此期間持續獲得穩定流量。
              </p>
            </div>
            <div className="rounded-lg border p-4">
              <div className="mb-2 flex items-center gap-2">
                <div
                  className="size-3 rounded-full"
                  style={{
                    backgroundColor: LONGTAIL_CONTRIBUTION_COLORS.deepLongtail,
                  }}
                />
                <span className="font-medium">深長尾</span>
              </div>
              <p className="text-sm text-muted-foreground">
                發布超過 90 天，真正的內容資產，持續為帳號帶來價值。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
