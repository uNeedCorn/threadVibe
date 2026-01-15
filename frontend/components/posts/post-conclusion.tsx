"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccountAverage } from "@/hooks/use-account-average";

interface PostConclusionProps {
  post: {
    current_views: number;
    current_likes: number;
    engagement_rate: number;
  };
  accountAverage: AccountAverage | null;
  isLoading?: boolean;
}

/**
 * 一句話結論區塊
 * 顯示貼文與帳號平均值的比較結論
 */
export function PostConclusion({ post, accountAverage, isLoading }: PostConclusionProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg bg-muted/50 px-4 py-3 animate-pulse">
        <div className="h-5 w-48 bg-muted rounded" />
      </div>
    );
  }

  if (!accountAverage || accountAverage.postCount < 3) {
    return (
      <div className="rounded-lg bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        資料不足，尚無法比較（需至少 3 篇貼文）
      </div>
    );
  }

  // 以互動率為主要比較指標
  const engagementDiff = accountAverage.avgEngagementRate > 0
    ? ((post.engagement_rate - accountAverage.avgEngagementRate) / accountAverage.avgEngagementRate) * 100
    : 0;

  // 以觀看數為次要指標
  const viewsDiff = accountAverage.avgViews > 0
    ? ((post.current_views - accountAverage.avgViews) / accountAverage.avgViews) * 100
    : 0;

  // 綜合評估（互動率權重 60%，觀看數權重 40%）
  const overallDiff = engagementDiff * 0.6 + viewsDiff * 0.4;
  const roundedDiff = Math.round(Math.abs(overallDiff));

  // 決定結論類型
  let conclusionType: "above" | "below" | "neutral";
  let Icon: typeof TrendingUp;
  let bgColor: string;
  let textColor: string;
  let message: string;

  if (overallDiff > 10) {
    conclusionType = "above";
    Icon = TrendingUp;
    bgColor = "bg-green-50 dark:bg-green-950/30";
    textColor = "text-green-700 dark:text-green-400";
    message = `表現優於平均 ${roundedDiff}%`;
  } else if (overallDiff < -10) {
    conclusionType = "below";
    Icon = TrendingDown;
    bgColor = "bg-orange-50 dark:bg-orange-950/30";
    textColor = "text-orange-700 dark:text-orange-400";
    message = `表現低於平均 ${roundedDiff}%`;
  } else {
    conclusionType = "neutral";
    Icon = Minus;
    bgColor = "bg-gray-50 dark:bg-gray-800/50";
    textColor = "text-gray-600 dark:text-gray-400";
    message = "表現接近平均水準";
  }

  return (
    <div className={cn("rounded-lg px-4 py-3 flex items-center gap-2", bgColor)}>
      <Icon className={cn("size-5", textColor)} />
      <span className={cn("text-sm font-medium", textColor)}>
        {message}
      </span>
      <span className="text-xs text-muted-foreground ml-auto">
        vs {accountAverage.postCount} 篇貼文平均
      </span>
    </div>
  );
}
