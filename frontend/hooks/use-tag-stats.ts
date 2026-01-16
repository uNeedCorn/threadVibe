"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface TagStats {
  id: string;
  name: string;
  color: string;
  postCount: number;
  avgViews: number;
  avgLikes: number;
  avgReplies: number;
  engagementRate: number;
  peakHour: number | null;
  // 生命週期高峰（簡化版：基於貼文年齡分析）
  lifecyclePeak: string | null;
}

interface UseTagStatsOptions {
  tagIds: string[];
  accountId: string | null;
}

interface UseTagStatsResult {
  stats: TagStats[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

// 查詢結果的貼文類型
interface PostData {
  id: string;
  published_at: string | null;
  current_views: number | null;
  current_likes: number | null;
  current_replies: number | null;
  current_reposts: number | null;
  current_quotes: number | null;
  engagement_rate: number | null;
  workspace_threads_account_id: string;
}

// 標籤貼文關聯查詢結果
interface PostTagResult {
  post_id: string;
  workspace_threads_posts: PostData;
}

export function useTagStats({ tagIds, accountId }: UseTagStatsOptions): UseTagStatsResult {
  const [stats, setStats] = useState<TagStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchStats = useCallback(async () => {
    if (!accountId || tagIds.length === 0) {
      setStats([]);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const results: TagStats[] = [];

      // 為每個標籤查詢統計資料
      for (const tagId of tagIds) {
        // 1. 取得標籤基本資訊
        const { data: tagData } = await supabase
          .from("workspace_threads_account_tags")
          .select("id, name, color")
          .eq("id", tagId)
          .single();

        if (!tagData) continue;

        // 2. 取得該標籤所有貼文的成效
        const { data: postsData } = await supabase
          .from("workspace_threads_post_tags")
          .select(`
            post_id,
            workspace_threads_posts!inner (
              id,
              published_at,
              current_views,
              current_likes,
              current_replies,
              current_reposts,
              current_quotes,
              engagement_rate,
              workspace_threads_account_id
            )
          `)
          .eq("tag_id", tagId) as { data: PostTagResult[] | null };

        // 過濾出屬於當前帳號的貼文
        const posts = (postsData || [])
          .map((pt) => pt.workspace_threads_posts)
          .filter((p) => p.workspace_threads_account_id === accountId);

        const postCount = posts.length;

        if (postCount === 0) {
          results.push({
            id: tagData.id,
            name: tagData.name,
            color: tagData.color,
            postCount: 0,
            avgViews: 0,
            avgLikes: 0,
            avgReplies: 0,
            engagementRate: 0,
            peakHour: null,
            lifecyclePeak: null,
          });
          continue;
        }

        // 3. 計算平均成效
        const totalViews = posts.reduce((sum, p) => sum + (p.current_views || 0), 0);
        const totalLikes = posts.reduce((sum, p) => sum + (p.current_likes || 0), 0);
        const totalReplies = posts.reduce((sum, p) => sum + (p.current_replies || 0), 0);
        const totalEngagement = posts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0);

        const avgViews = Math.round(totalViews / postCount);
        const avgLikes = Math.round(totalLikes / postCount);
        const avgReplies = Math.round(totalReplies / postCount);
        const engagementRate = totalEngagement / postCount;

        // 4. 分析最佳發文時間（基於高互動率貼文）
        const peakHour = calculatePeakHour(posts);

        // 5. 估算生命週期高峰（簡化版）
        const lifecyclePeak = estimateLifecyclePeak(posts);

        results.push({
          id: tagData.id,
          name: tagData.name,
          color: tagData.color,
          postCount,
          avgViews,
          avgLikes,
          avgReplies,
          engagementRate,
          peakHour,
          lifecyclePeak,
        });
      }

      setStats(results);
    } catch (err) {
      console.error("Error fetching tag stats:", err);
      setError(err instanceof Error ? err : new Error("Failed to fetch tag stats"));
    } finally {
      setIsLoading(false);
    }
  }, [accountId, tagIds]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, isLoading, error, refetch: fetchStats };
}

/**
 * 計算最佳發文時間
 * 基於高互動率貼文的發布時間分析
 */
function calculatePeakHour(
  posts: Array<{
    published_at: string | null;
    engagement_rate: number | null;
    current_views: number | null;
  }>
): number | null {
  if (posts.length === 0) return null;

  // 計算每個小時的互動率總和與貼文數
  const hourStats: Record<number, { totalEngagement: number; count: number }> = {};

  for (const post of posts) {
    if (!post.published_at) continue;

    const hour = new Date(post.published_at).getHours();
    const engagement = post.engagement_rate || 0;

    if (!hourStats[hour]) {
      hourStats[hour] = { totalEngagement: 0, count: 0 };
    }
    hourStats[hour].totalEngagement += engagement;
    hourStats[hour].count += 1;
  }

  // 找出平均互動率最高的時間
  let bestHour: number | null = null;
  let bestAvgEngagement = 0;

  for (const [hourStr, data] of Object.entries(hourStats)) {
    const hour = parseInt(hourStr, 10);
    const avgEngagement = data.totalEngagement / data.count;

    if (avgEngagement > bestAvgEngagement) {
      bestAvgEngagement = avgEngagement;
      bestHour = hour;
    }
  }

  // 如果沒有足夠數據，返回預設值
  if (bestHour === null) {
    // 根據貼文發布時間分布返回最常發布的時間
    const hourCounts: Record<number, number> = {};
    for (const post of posts) {
      if (!post.published_at) continue;
      const hour = new Date(post.published_at).getHours();
      hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    }

    let maxCount = 0;
    for (const [hourStr, count] of Object.entries(hourCounts)) {
      if (count > maxCount) {
        maxCount = count;
        bestHour = parseInt(hourStr, 10);
      }
    }
  }

  return bestHour;
}

/**
 * 估算生命週期高峰
 * 簡化版：基於貼文類型和互動模式推估
 */
function estimateLifecyclePeak(
  posts: Array<{
    current_views: number | null;
    current_likes: number | null;
  }>
): string | null {
  if (posts.length === 0) return null;

  // 計算平均互動密度（likes/views 比例）
  let totalRatio = 0;
  let validCount = 0;

  for (const post of posts) {
    const views = post.current_views || 0;
    const likes = post.current_likes || 0;

    if (views > 0) {
      totalRatio += likes / views;
      validCount += 1;
    }
  }

  if (validCount === 0) return "24hr";

  const avgRatio = totalRatio / validCount;

  // 高互動率貼文通常較快達到高峰
  // 低互動率貼文可能是長尾型
  if (avgRatio > 0.1) {
    return "12hr"; // 高互動，快速達峰
  } else if (avgRatio > 0.05) {
    return "24hr"; // 中等互動
  } else if (avgRatio > 0.02) {
    return "48hr"; // 較低互動，慢熱型
  } else {
    return "72hr"; // 長尾型
  }
}
