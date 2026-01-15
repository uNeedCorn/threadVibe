"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface AccountAverage {
  avgViews: number;
  avgLikes: number;
  avgReplies: number;
  avgReposts: number;
  avgQuotes: number;
  avgEngagementRate: number;
  postCount: number;
}

interface UseAccountAverageOptions {
  accountId: string | null;
  days?: number; // 預設 30 天
}

interface UseAccountAverageResult {
  accountAverage: AccountAverage | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * 計算帳號指定天數內的貼文平均成效
 */
export function useAccountAverage({
  accountId,
  days = 30,
}: UseAccountAverageOptions): UseAccountAverageResult {
  const [accountAverage, setAccountAverage] = useState<AccountAverage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAverage = useCallback(async () => {
    if (!accountId) {
      setAccountAverage(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // 計算 N 天前的日期
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - days);
      const daysAgoISO = daysAgo.toISOString();

      // 查詢該帳號在指定天數內的所有貼文
      const { data: posts, error: queryError } = await supabase
        .from("workspace_threads_posts")
        .select(`
          current_views,
          current_likes,
          current_replies,
          current_reposts,
          current_quotes,
          engagement_rate
        `)
        .eq("workspace_threads_account_id", accountId)
        .gte("published_at", daysAgoISO)
        .not("media_type", "eq", "REPOST_FACADE"); // 排除轉發貼文

      if (queryError) {
        throw new Error(queryError.message);
      }

      if (!posts || posts.length === 0) {
        setAccountAverage(null);
        return;
      }

      // 計算平均值
      const sum = posts.reduce(
        (acc, post) => ({
          views: acc.views + (post.current_views || 0),
          likes: acc.likes + (post.current_likes || 0),
          replies: acc.replies + (post.current_replies || 0),
          reposts: acc.reposts + (post.current_reposts || 0),
          quotes: acc.quotes + (post.current_quotes || 0),
          engagementRate: acc.engagementRate + (post.engagement_rate || 0),
        }),
        { views: 0, likes: 0, replies: 0, reposts: 0, quotes: 0, engagementRate: 0 }
      );

      const count = posts.length;

      setAccountAverage({
        avgViews: sum.views / count,
        avgLikes: sum.likes / count,
        avgReplies: sum.replies / count,
        avgReposts: sum.reposts / count,
        avgQuotes: sum.quotes / count,
        avgEngagementRate: sum.engagementRate / count,
        postCount: count,
      });
    } catch (err) {
      console.error("Fetch account average error:", err);
      setError(err instanceof Error ? err.message : "計算平均值失敗");
      setAccountAverage(null);
    } finally {
      setIsLoading(false);
    }
  }, [accountId, days]);

  useEffect(() => {
    fetchAverage();
  }, [fetchAverage]);

  return { accountAverage, isLoading, error };
}

/**
 * 計算相對比較
 */
export function getComparison(
  current: number,
  average: number | null
): { type: "above" | "below" | "neutral"; diff: number; label: string } | null {
  if (average === null || average === 0) return null;

  const diff = ((current - average) / average) * 100;

  if (diff > 10) {
    return {
      type: "above",
      diff: Math.round(diff),
      label: `↑${Math.round(diff)}%`,
    };
  } else if (diff < -10) {
    return {
      type: "below",
      diff: Math.round(Math.abs(diff)),
      label: `↓${Math.round(Math.abs(diff))}%`,
    };
  }
  return {
    type: "neutral",
    diff: 0,
    label: "~",
  };
}

/**
 * 格式化數字
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}
