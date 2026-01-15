"use client";

import { useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface ReportSummary {
  // 帳號資訊
  accountName: string;
  accountUsername: string;
  accountAvatar: string | null;
  // 期間
  periodStart: Date;
  periodEnd: Date;
  // 粉絲成長
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
  // Top 貼文
  topPosts: TopPost[];
  // 趨勢數據
  trendData: TrendDataPoint[];
  // 發文分類
  categoryStats: CategoryStat[];
  // 最佳時段
  bestTimeSlot: string;
}

export interface TopPost {
  id: string;
  text: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  engagementRate: number;
}

export interface TrendDataPoint {
  date: string;
  views: number;
  interactions: number;
}

export interface CategoryStat {
  name: string;
  count: number;
  percentage: number;
}

interface UseReportDataReturn {
  data: ReportSummary | null;
  isLoading: boolean;
  error: string | null;
  fetchData: (accountId: string, startDate: Date, endDate: Date) => Promise<void>;
}

export function useReportData(): UseReportDataReturn {
  const [data, setData] = useState<ReportSummary | null>(null);
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

      // 3. 取得上一期間的貼文（用於計算成長率）
      const periodLength = endDate.getTime() - startDate.getTime();
      const prevStartDate = new Date(startDate.getTime() - periodLength);
      const prevEndDate = new Date(startDate.getTime() - 1);

      const { data: prevPosts } = await supabase
        .from("workspace_threads_posts")
        .select("current_views, current_likes, current_replies, current_reposts, current_quotes")
        .eq("workspace_threads_account_id", accountId)
        .gte("published_at", prevStartDate.toISOString())
        .lte("published_at", prevEndDate.toISOString());

      // 3.1 取得粉絲成長資料（從 daily insights）
      const startDateStr = startDate.toISOString().split("T")[0];
      const endDateStr = endDate.toISOString().split("T")[0];
      const prevStartDateStr = prevStartDate.toISOString().split("T")[0];

      // 取得期間開始的粉絲數
      const { data: startInsight } = await supabase
        .from("workspace_threads_account_insights_daily")
        .select("followers_count")
        .eq("workspace_threads_account_id", accountId)
        .lte("bucket_date", startDateStr)
        .order("bucket_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 取得期間結束的粉絲數
      const { data: endInsight } = await supabase
        .from("workspace_threads_account_insights_daily")
        .select("followers_count")
        .eq("workspace_threads_account_id", accountId)
        .lte("bucket_date", endDateStr)
        .order("bucket_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 取得上期開始的粉絲數（用於計算成長率）
      const { data: prevStartInsight } = await supabase
        .from("workspace_threads_account_insights_daily")
        .select("followers_count")
        .eq("workspace_threads_account_id", accountId)
        .lte("bucket_date", prevStartDateStr)
        .order("bucket_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      // 計算粉絲成長（如果沒有起始資料，使用結束資料，視為無成長）
      const endFollowers = endInsight?.followers_count ?? account.current_followers_count ?? 0;
      const startFollowers = startInsight?.followers_count ?? endFollowers;
      const prevStartFollowers = prevStartInsight?.followers_count ?? startFollowers;
      const followerGrowth = endFollowers - startFollowers;
      const prevFollowerGrowth = startFollowers - prevStartFollowers;
      const followerGrowthRate = prevFollowerGrowth !== 0
        ? ((followerGrowth - prevFollowerGrowth) / Math.abs(prevFollowerGrowth)) * 100
        : 0;

      // 4. 計算統計數據
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

      // 5. Top 3 貼文
      const topPosts: TopPost[] = currentPosts.slice(0, 3).map((p) => {
        const views = p.current_views || 0;
        const interactions = (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0);
        return {
          id: p.id,
          text: p.text || "",
          views,
          likes: p.current_likes || 0,
          replies: p.current_replies || 0,
          reposts: p.current_reposts || 0,
          quotes: p.current_quotes || 0,
          engagementRate: views > 0 ? (interactions / views) * 100 : 0,
        };
      });

      // 6. 分類統計（從手動標籤提取）
      const categoryMap = new Map<string, number>();
      currentPosts.forEach((p) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const postTags = p.workspace_threads_post_tags as any[] | null;

        postTags?.forEach((pt) => {
          const tagName = pt?.workspace_threads_account_tags?.name;
          if (tagName && typeof tagName === "string") {
            categoryMap.set(tagName, (categoryMap.get(tagName) || 0) + 1);
          }
        });
      });

      const categoryStats: CategoryStat[] = Array.from(categoryMap.entries())
        .map(([name, count]) => ({
          name,
          count,
          percentage: currentPosts.length > 0 ? (count / currentPosts.length) * 100 : 0,
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      // 7. 最佳時段分析
      const hourCounts = new Map<number, number>();
      currentPosts.forEach((p) => {
        const hour = new Date(p.published_at).getHours();
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      });

      let bestHour = 12;
      let maxCount = 0;
      hourCounts.forEach((count, hour) => {
        if (count > maxCount) {
          maxCount = count;
          bestHour = hour;
        }
      });

      const bestTimeSlot = `${bestHour}:00 - ${(bestHour + 6) % 24}:00`;

      // 8. 趨勢數據（按日聚合）
      const trendMap = new Map<string, { views: number; interactions: number }>();
      currentPosts.forEach((p) => {
        const date = new Date(p.published_at).toISOString().split("T")[0];
        const existing = trendMap.get(date) || { views: 0, interactions: 0 };
        const interactions = (p.current_likes || 0) + (p.current_replies || 0) + (p.current_reposts || 0) + (p.current_quotes || 0);
        trendMap.set(date, {
          views: existing.views + (p.current_views || 0),
          interactions: existing.interactions + interactions,
        });
      });

      const trendData: TrendDataPoint[] = Array.from(trendMap.entries())
        .map(([date, data]) => ({ date, ...data }))
        .sort((a, b) => a.date.localeCompare(b.date));

      // 9. 計算成長率
      const viewsGrowthRate = prevTotalViews > 0 ? ((totalViews - prevTotalViews) / prevTotalViews) * 100 : 0;
      const interactionsGrowthRate = prevTotalInteractions > 0 ? ((totalInteractions - prevTotalInteractions) / prevTotalInteractions) * 100 : 0;

      // 10. 組裝結果
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
        bestTimeSlot,
      });
    } catch (err) {
      console.error("Fetch report data error:", err);
      setError(err instanceof Error ? err.message : "取得報表資料失敗");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { data, isLoading, error, fetchData };
}
