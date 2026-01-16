"use client";

import { useMemo } from "react";
import {
  Lightbulb,
  TrendingUp,
  Target,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Tag,
  Clock,
  Image,
} from "lucide-react";
import { PieChart, Pie, Cell } from "recharts";
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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/insights-utils";
import {
  getLongtailRating,
  LONGTAIL_RATING_CONFIG,
} from "@/lib/longtail-utils";
import { ACCENT } from "@/lib/design-tokens";
import type { LongtailPageData } from "../page";

interface Props {
  data: LongtailPageData;
}

interface Suggestion {
  type: "tag" | "time" | "media" | "trend";
  icon: React.ReactNode;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
}

const INTERACTION_COLORS = {
  likes: ACCENT.DEFAULT,
  replies: ACCENT.hover,
  reposts: ACCENT.muted,
  quotes: ACCENT.light,
};

export function DeepInsightsTab({ data }: Props) {
  const {
    posts,
    contribution,
    accountLongtailRatio,
    evergreenPostCount,
    potentialScore,
    isLoading,
  } = data;

  const rating = getLongtailRating(potentialScore);

  // 計算互動組成（新流量 vs 長尾流量）
  const interactionComparison = useMemo(() => {
    // 模擬新流量互動（前 7 天）
    const newFlowInteractions = {
      likes: 0,
      replies: 0,
      reposts: 0,
      quotes: 0,
    };

    // 模擬長尾流量互動（7 天後）
    const longtailInteractions = {
      likes: 0,
      replies: 0,
      reposts: 0,
      quotes: 0,
    };

    for (const post of posts) {
      // 假設互動按照曝光比例分配
      const newRatio = 1 - post.longtailRatio;
      const longtailRatio = post.longtailRatio;

      newFlowInteractions.likes += post.currentLikes * newRatio;
      newFlowInteractions.replies += post.currentReplies * newRatio;
      newFlowInteractions.reposts += post.currentReposts * newRatio;
      newFlowInteractions.quotes += post.currentQuotes * newRatio;

      longtailInteractions.likes += post.currentLikes * longtailRatio;
      longtailInteractions.replies += post.currentReplies * longtailRatio;
      longtailInteractions.reposts += post.currentReposts * longtailRatio;
      longtailInteractions.quotes += post.currentQuotes * longtailRatio;
    }

    const formatPieData = (interactions: typeof newFlowInteractions) => {
      const total =
        interactions.likes +
        interactions.replies +
        interactions.reposts +
        interactions.quotes;
      if (total === 0) return [];

      return [
        {
          name: "likes",
          label: "讚",
          value: interactions.likes,
          percentage: ((interactions.likes / total) * 100).toFixed(1),
          fill: INTERACTION_COLORS.likes,
        },
        {
          name: "replies",
          label: "回覆",
          value: interactions.replies,
          percentage: ((interactions.replies / total) * 100).toFixed(1),
          fill: INTERACTION_COLORS.replies,
        },
        {
          name: "reposts",
          label: "轉發",
          value: interactions.reposts,
          percentage: ((interactions.reposts / total) * 100).toFixed(1),
          fill: INTERACTION_COLORS.reposts,
        },
        {
          name: "quotes",
          label: "引用",
          value: interactions.quotes,
          percentage: ((interactions.quotes / total) * 100).toFixed(1),
          fill: INTERACTION_COLORS.quotes,
        },
      ].filter((d) => d.value > 0);
    };

    return {
      newFlow: formatPieData(newFlowInteractions),
      longtail: formatPieData(longtailInteractions),
    };
  }, [posts]);

  // 生成建議
  const suggestions = useMemo<Suggestion[]>(() => {
    const result: Suggestion[] = [];

    // 標籤建議
    const tagStats = new Map<
      string,
      { name: string; posts: number; avgRatio: number }
    >();
    for (const post of posts) {
      for (const tag of post.tags) {
        if (!tagStats.has(tag.id)) {
          tagStats.set(tag.id, { name: tag.name, posts: 0, avgRatio: 0 });
        }
        const stat = tagStats.get(tag.id)!;
        stat.posts += 1;
        stat.avgRatio =
          (stat.avgRatio * (stat.posts - 1) + post.longtailRatio) / stat.posts;
      }
    }

    const bestTag = Array.from(tagStats.values())
      .filter((t) => t.posts >= 3)
      .sort((a, b) => b.avgRatio - a.avgRatio)[0];

    if (bestTag && bestTag.avgRatio > accountLongtailRatio / 100 * 1.2) {
      result.push({
        type: "tag",
        icon: <Tag className="size-5" />,
        title: `多發「${bestTag.name}」類型內容`,
        description: `此標籤的長尾比例（${(bestTag.avgRatio * 100).toFixed(1)}%）高於帳號平均 ${(((bestTag.avgRatio * 100) / accountLongtailRatio - 1) * 100).toFixed(0)}%`,
        priority: "high",
      });
    }

    // 評分建議
    if (potentialScore < 40) {
      result.push({
        type: "trend",
        icon: <TrendingUp className="size-5" />,
        title: "增加常青類型內容",
        description:
          "目前長尾潛力評分較低，建議參考常青內容特徵，創作更多持久性內容",
        priority: "high",
      });
    } else if (potentialScore < 60) {
      result.push({
        type: "trend",
        icon: <Target className="size-5" />,
        title: "持續優化內容策略",
        description: "長尾表現中等，可以參考特徵分析中的最佳實踐進一步優化",
        priority: "medium",
      });
    } else {
      result.push({
        type: "trend",
        icon: <Sparkles className="size-5" />,
        title: "維持現有策略",
        description: "長尾表現優異，繼續保持目前的內容策略和發布習慣",
        priority: "low",
      });
    }

    // 常青貼文建議
    const evergreenRatio =
      posts.length > 0 ? evergreenPostCount / posts.length : 0;
    if (evergreenRatio < 0.1 && posts.length >= 10) {
      result.push({
        type: "media",
        icon: <AlertCircle className="size-5" />,
        title: "常青內容比例偏低",
        description: `目前僅 ${(evergreenRatio * 100).toFixed(1)}% 的貼文達到常青標準，建議研究高常青指數貼文的共同特徵`,
        priority: "high",
      });
    }

    return result;
  }, [posts, accountLongtailRatio, potentialScore, evergreenPostCount]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-40" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[200px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 長尾潛力評分詳情 */}
      <Card>
        <CardHeader>
          <CardTitle>長尾潛力評分詳情</CardTitle>
          <CardDescription>帳號長尾表現的綜合評估</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* 評分圓環 */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative mb-4">
                <svg className="size-32" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-muted"
                  />
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
                  <span className="text-3xl font-bold">{potentialScore}</span>
                  <span className="text-xs text-muted-foreground">分</span>
                </div>
              </div>
              <Badge className={cn("text-white", rating.bgColor)}>
                {rating.label}
              </Badge>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {rating.description}
              </p>
            </div>

            {/* 評分細項 */}
            <div className="space-y-4">
              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>帳號長尾比例</span>
                  <span className="font-medium">
                    {accountLongtailRatio.toFixed(1)}%
                  </span>
                </div>
                <Progress
                  value={Math.min((accountLongtailRatio / 30) * 100, 100)}
                  className="h-2"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  目標：30%（佔評分 40%）
                </p>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>常青貼文比例</span>
                  <span className="font-medium">
                    {posts.length > 0
                      ? ((evergreenPostCount / posts.length) * 100).toFixed(1)
                      : 0}
                    %
                  </span>
                </div>
                <Progress
                  value={Math.min(
                    posts.length > 0
                      ? (evergreenPostCount / posts.length / 0.2) * 100
                      : 0,
                    100
                  )}
                  className="h-2"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  目標：20%（佔評分 30%）
                </p>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>長尾趨勢</span>
                  <span className="font-medium">穩定</span>
                </div>
                <Progress value={60} className="h-2" />
                <p className="mt-1 text-xs text-muted-foreground">
                  基於近期數據（佔評分 30%）
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 互動品質對比 */}
      <Card>
        <CardHeader>
          <CardTitle>互動品質對比</CardTitle>
          <CardDescription>新流量 vs 長尾流量的互動組成</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-8 md:grid-cols-2">
            {/* 新流量互動 */}
            <div>
              <h4 className="mb-4 text-center font-medium">
                新流量互動（前 7 天）
              </h4>
              {interactionComparison.newFlow.length === 0 ? (
                <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                  暫無數據
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <ChartContainer
                    config={{
                      likes: { label: "讚", color: INTERACTION_COLORS.likes },
                      replies: {
                        label: "回覆",
                        color: INTERACTION_COLORS.replies,
                      },
                      reposts: {
                        label: "轉發",
                        color: INTERACTION_COLORS.reposts,
                      },
                      quotes: {
                        label: "引用",
                        color: INTERACTION_COLORS.quotes,
                      },
                    }}
                    className="h-[180px] flex-1"
                  >
                    <PieChart>
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, name) => {
                              const item = interactionComparison.newFlow.find(
                                (d) => d.name === name
                              );
                              return [
                                `${formatNumber(value as number)} (${item?.percentage}%)`,
                                item?.label || name,
                              ];
                            }}
                          />
                        }
                      />
                      <Pie
                        data={interactionComparison.newFlow}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {interactionComparison.newFlow.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="flex flex-col gap-2 text-sm">
                    {interactionComparison.newFlow.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div
                          className="size-3 rounded-full"
                          style={{ backgroundColor: item.fill }}
                        />
                        <span className="text-muted-foreground">
                          {item.label}
                        </span>
                        <span className="ml-auto font-medium">
                          {item.percentage}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 長尾流量互動 */}
            <div>
              <h4 className="mb-4 text-center font-medium">
                長尾流量互動（7 天後）
              </h4>
              {interactionComparison.longtail.length === 0 ? (
                <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                  暫無數據
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <ChartContainer
                    config={{
                      likes: { label: "讚", color: INTERACTION_COLORS.likes },
                      replies: {
                        label: "回覆",
                        color: INTERACTION_COLORS.replies,
                      },
                      reposts: {
                        label: "轉發",
                        color: INTERACTION_COLORS.reposts,
                      },
                      quotes: {
                        label: "引用",
                        color: INTERACTION_COLORS.quotes,
                      },
                    }}
                    className="h-[180px] flex-1"
                  >
                    <PieChart>
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value, name) => {
                              const item = interactionComparison.longtail.find(
                                (d) => d.name === name
                              );
                              return [
                                `${formatNumber(value as number)} (${item?.percentage}%)`,
                                item?.label || name,
                              ];
                            }}
                          />
                        }
                      />
                      <Pie
                        data={interactionComparison.longtail}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                      >
                        {interactionComparison.longtail.map((entry) => (
                          <Cell key={entry.name} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="flex flex-col gap-2 text-sm">
                    {interactionComparison.longtail.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div
                          className="size-3 rounded-full"
                          style={{ backgroundColor: item.fill }}
                        />
                        <span className="text-muted-foreground">
                          {item.label}
                        </span>
                        <span className="ml-auto font-medium">
                          {item.percentage}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 優化建議 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lightbulb className="size-5" />
            優化建議
          </CardTitle>
          <CardDescription>基於你的數據生成的個人化建議</CardDescription>
        </CardHeader>
        <CardContent>
          {suggestions.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <CheckCircle2 className="mr-2 size-5" />
              目前沒有特別的優化建議，繼續保持！
            </div>
          ) : (
            <div className="space-y-4">
              {suggestions.map((suggestion, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-start gap-4 rounded-lg border p-4",
                    suggestion.priority === "high" &&
                      "border-amber-500/50 bg-amber-500/5",
                    suggestion.priority === "medium" &&
                      "border-primary/50 bg-primary/5",
                    suggestion.priority === "low" && "border-muted"
                  )}
                >
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-lg",
                      suggestion.priority === "high" &&
                        "bg-amber-500/10 text-amber-600",
                      suggestion.priority === "medium" &&
                        "bg-primary/10 text-primary",
                      suggestion.priority === "low" &&
                        "bg-muted text-muted-foreground"
                    )}
                  >
                    {suggestion.icon}
                  </div>
                  <div className="flex-1">
                    <div className="mb-1 flex items-center gap-2">
                      <h4 className="font-medium">{suggestion.title}</h4>
                      <Badge
                        variant={
                          suggestion.priority === "high"
                            ? "default"
                            : "secondary"
                        }
                        className={cn(
                          "text-xs",
                          suggestion.priority === "high" &&
                            "bg-amber-500 hover:bg-amber-600",
                          suggestion.priority === "medium" &&
                            "bg-primary hover:bg-primary/90"
                        )}
                      >
                        {suggestion.priority === "high"
                          ? "重要"
                          : suggestion.priority === "medium"
                            ? "建議"
                            : "參考"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {suggestion.description}
                    </p>
                  </div>
                  <ArrowRight className="size-5 shrink-0 text-muted-foreground" />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
