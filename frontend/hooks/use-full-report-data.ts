"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface FullReportSummary {
  // 帳號資訊
  accountName: string;
  accountUsername: string;
  accountAvatar: string | null;
  // 期間
  periodStart: Date;
  periodEnd: Date;
  // 粉絲
  currentFollowers: number;
  followerGrowth: number;
  followerGrowthRate: number;
  // 曝光
  totalViews: number;
  viewsGrowthRate: number;
  // 互動
  totalInteractions: number;
  interactionsGrowthRate: number;
  // 互動率
  engagementRate: number;
  engagementRateChange: number;
  // 發文統計
  postCount: number;
  // Top 貼文 (擴充為 10 篇)
  topPosts: FullReportPost[];
  // 趨勢數據
  trendData: TrendDataPoint[];
  // 發文分類 (完整版)
  categoryStats: CategoryStat[];
  // 時段分析
  hourlyDistribution: HourlyData[];
  bestTimeSlot: string;
  // 上期比較
  previousPeriod: {
    totalViews: number;
    totalInteractions: number;
    postCount: number;
  };
}

export interface FullReportPost {
  id: string;
  text: string;
  publishedAt: Date;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  engagementRate: number;
  tags: string[];
}

export interface TrendDataPoint {
  date: string;
  views: number;
  interactions: number;
  posts: number;
}

export interface CategoryStat {
  name: string;
  count: number;
  percentage: number;
  totalViews: number;
  totalInteractions: number;
  avgEngagementRate: number;
}

export interface HourlyData {
  hour: number;
  postCount: number;
  avgViews: number;
  avgEngagement: number;
}

interface UseFullReportDataReturn {
  data: FullReportSummary | null;
  isLoading: boolean;
  error: string | null;
  fetchData: (accountId: string, startDate: Date, endDate: Date) => Promise<void>;
}

export function useFullReportData(): UseFullReportDataReturn {
  const [data, setData] = useState<FullReportSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (accountId: string, startDate: Date, endDate: Date) => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const startStr = startDate.toISOString();
      const endStr = endDate.toISOString();

      // 1. 取得帳號資訊
      const { data: account, error: accountError } = await supabase
        .from("workspace_threads_accounts")
        .select("username, name, profile_pic_url, current_followers_count")
        .eq("id", accountId)
        .single();

      if (accountError) throw new Error(`取得帳號資訊失敗: ${accountError.message}`);

      // 2. 取得期間內的貼文（含標籤）
      const { data: posts, error: postsError } = await supabase
        .from("workspace_threads_posts")
        .select(`
          id,
          text,
          published_at,
          current_views,
          current_likes,
          current_replies,
          current_reposts,
          current_quotes,
          workspace_threads_post_tags (
            workspace_threads_account_tags (
              name
            )
          )
        `)
        .eq("workspace_threads_account_id", accountId)
        .gte("published_at", startStr)
        .lte("published_at", endStr)
        .order("current_views", { ascending: false });

      if (postsError) throw new Error(`取得貼文失敗: ${postsError.message}`);

      // 3. 取得上一期間的貼文
      const periodLength = endDate.getTime() - startDate.getTime();
      const prevStartDate = new Date(startDate.getTime() - periodLength);
      const prevEndDate = new Date(startDate.getTime() - 1);

      const { data: prevPosts } = await supabase
        .from("workspace_threads_posts")
        .select("current_views, current_likes, current_replies, current_reposts, current_quotes")
        .eq("workspace_threads_account_id", accountId)
        .gte("published_at", prevStartDate.toISOString())
        .lte("published_at", prevEndDate.toISOString());

      // 4. 取得粉絲成長資料
      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];
      const prevStartDateStr = prevStartDate.toISOString().split("T")[0];

      const { data: startInsight } = await supabase
        .from("workspace_threads_account_insights_daily")
        .select("followers_count")
        .eq("workspace_threads_account_id", accountId)
        .lte("bucket_date", startDateStr)
        .order("bucket_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: endInsight } = await supabase
        .from("workspace_threads_account_insights_daily")
        .select("followers_count")
        .eq("workspace_threads_account_id", accountId)
        .lte("bucket_date", endDateStr)
        .order("bucket_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      const { data: prevStartInsight } = await supabase
        .from("workspace_threads_account_insights_daily")
        .select("followers_count")
        .eq("workspace_threads_account_id", accountId)
        .lte("bucket_date", prevStartDateStr)
        .order("bucket_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 5. 計算統計
      const currentPosts = posts || [];
      const previousPosts = prevPosts || [];

      const totalViews = currentPosts.reduce((sum, p) => sum + (p.current_views || 0), 0);
      const totalLikes = currentPosts.reduce((sum, p) => sum + (p.current_likes || 0), 0);
      const totalReplies = currentPosts.reduce((sum, p) => sum + (p.current_replies || 0), 0);
      const totalReposts = currentPosts.reduce((sum, p) => sum + (p.current_reposts || 0), 0);
      const totalQuotes = currentPosts.reduce((sum, p) => sum + (p.current_quotes || 0), 0);
      const totalInteractions = totalLikes + totalReplies + totalReposts + totalQuotes;

      const prevTotalViews = previousPosts.reduce((sum, p) => sum + (p.current_views || 0), 0);
      const prevTotalInteractions = previousPosts.reduce(
        (sum, p) => sum + (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0),
        0
      );

      const engagementRate = totalViews > 0 ? (totalInteractions / totalViews) * 100 : 0;
      const prevEngagementRate = prevTotalViews > 0 ? (prevTotalInteractions / prevTotalViews) * 100 : 0;

      // 粉絲成長（如果沒有起始資料，使用結束資料，視為無成長）
      const endFollowers = endInsight?.followers_count ?? account.current_followers_count ?? 0;
      const startFollowers = startInsight?.followers_count ?? endFollowers;
      const prevStartFollowers = prevStartInsight?.followers_count ?? startFollowers;
      const followerGrowth = endFollowers - startFollowers;
      const prevFollowerGrowth = startFollowers - prevStartFollowers;
      const followerGrowthRate = prevFollowerGrowth !== 0
        ? ((followerGrowth - prevFollowerGrowth) / Math.abs(prevFollowerGrowth)) * 100
        : 0;

      // 6. Top 10 貼文
      const topPosts: FullReportPost[] = currentPosts.slice(0, 10).map((p) => {
        const views = p.current_views || 0;
        const interactions = (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const postTags = p.workspace_threads_post_tags as any[] | null;
        const tags = postTags
          ?.map((pt) => pt?.workspace_threads_account_tags?.name)
          .filter((name): name is string => typeof name === "string") || [];

        return {
          id: p.id,
          text: p.text || "",
          publishedAt: new Date(p.published_at),
          views,
          likes: p.current_likes || 0,
          replies: p.current_replies || 0,
          reposts: p.current_reposts || 0,
          quotes: p.current_quotes || 0,
          engagementRate: views > 0 ? (interactions / views) * 100 : 0,
          tags,
        };
      });

      // 7. 分類統計（完整版，含成效數據）
      const categoryMap = new Map<string, {
        count: number;
        views: number;
        interactions: number;
      }>();

      currentPosts.forEach((p) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const postTags = p.workspace_threads_post_tags as any[] | null;
        const views = p.current_views || 0;
        const interactions = (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0);

        postTags?.forEach((pt) => {
          const tagName = pt?.workspace_threads_account_tags?.name;
          if (tagName && typeof tagName === "string") {
            const existing = categoryMap.get(tagName) || { count: 0, views: 0, interactions: 0 };
            categoryMap.set(tagName, {
              count: existing.count + 1,
              views: existing.views + views,
              interactions: existing.interactions + interactions,
            });
          }
        });
      });

      const categoryStats: CategoryStat[] = Array.from(categoryMap.entries())
        .map(([name, stats]) => ({
          name,
          count: stats.count,
          percentage: currentPosts.length > 0 ? (stats.count / currentPosts.length) * 100 : 0,
          totalViews: stats.views,
          totalInteractions: stats.interactions,
          avgEngagementRate: stats.views > 0 ? (stats.interactions / stats.views) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count);

      // 8. 時段分析
      const hourlyMap = new Map<number, { count: number; views: number; interactions: number }>();
      for (let h = 0; h < 24; h++) {
        hourlyMap.set(h, { count: 0, views: 0, interactions: 0 });
      }

      currentPosts.forEach((p) => {
        const hour = new Date(p.published_at).getHours();
        const views = p.current_views || 0;
        const interactions = (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0);
        const existing = hourlyMap.get(hour)!;
        hourlyMap.set(hour, {
          count: existing.count + 1,
          views: existing.views + views,
          interactions: existing.interactions + interactions,
        });
      });

      const hourlyDistribution: HourlyData[] = Array.from(hourlyMap.entries()).map(([hour, stats]) => ({
        hour,
        postCount: stats.count,
        avgViews: stats.count > 0 ? Math.round(stats.views / stats.count) : 0,
        avgEngagement: stats.views > 0 ? (stats.interactions / stats.views) * 100 : 0,
      }));

      // 最佳時段（基於平均觀看數）
      let bestHour = 12;
      let maxAvgViews = 0;
      hourlyDistribution.forEach((h) => {
        if (h.postCount > 0 && h.avgViews > maxAvgViews) {
          maxAvgViews = h.avgViews;
          bestHour = h.hour;
        }
      });
      const bestTimeSlot = `${bestHour.toString().padStart(2, "0")}:00`;

      // 9. 趨勢數據
      const trendMap = new Map<string, { views: number; interactions: number; posts: number }>();
      currentPosts.forEach((p) => {
        const date = new Date(p.published_at).toISOString().split("T")[0];
        const existing = trendMap.get(date) || { views: 0, interactions: 0, posts: 0 };
        const interactions = (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0);
        trendMap.set(date, {
          views: existing.views + (p.current_views || 0),
          interactions: existing.interactions + interactions,
          posts: existing.posts + 1,
        });
      });

      const trendData: TrendDataPoint[] = Array.from(trendMap.entries())
        .map(([date, stats]) => ({ date, ...stats }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // 10. 成長率
      const viewsGrowthRate = prevTotalViews > 0 ? ((totalViews - prevTotalViews) / prevTotalViews) * 100 : 0;
      const interactionsGrowthRate = prevTotalInteractions > 0 ? ((totalInteractions - prevTotalInteractions) / prevTotalInteractions) * 100 : 0;

      // 11. 組裝結果
      setData({
        accountName: account.name || account.username,
        accountUsername: account.username,
        accountAvatar: account.profile_pic_url,
        periodStart: startDate,
        periodEnd: endDate,
        currentFollowers: endFollowers,
        followerGrowth,
        followerGrowthRate,
        totalViews,
        viewsGrowthRate,
        totalInteractions,
        interactionsGrowthRate,
        engagementRate,
        engagementRateChange: engagementRate - prevEngagementRate,
        postCount: currentPosts.length,
        topPosts,
        trendData,
        categoryStats,
        hourlyDistribution,
        bestTimeSlot,
        previousPeriod: {
          totalViews: prevTotalViews,
          totalInteractions: prevTotalInteractions,
          postCount: previousPosts.length,
        },
      });
    } catch (err) {
      console.error("Fetch full report data error:", err);
      setError(err instanceof Error ? err.message : "取得報表資料失敗");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { data, isLoading, error, fetchData };
}
