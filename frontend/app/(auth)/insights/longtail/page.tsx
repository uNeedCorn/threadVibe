"use client";

import { useState, useEffect, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  TreeDeciduous,
  TrendingUp,
  Clock,
  Sparkles,
  BarChart3,
  Lightbulb,
  Target,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSelectedAccount } from "@/hooks/use-selected-account";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  type Period,
  formatNumber,
  formatDateLocal,
  getDateRange,
  calcGrowth,
} from "@/lib/insights-utils";
import {
  type LongtailContribution,
  calculateLongtailContribution,
  calculateLongtailRatio,
  calculateEvergreenIndex,
  calculateLongtailPotentialScore,
  isEligibleForLongtailAnalysis,
  LONGTAIL_STATUS_CONFIG,
  getLongtailRating,
  getDaysSincePublish,
  getPostLongtailStatus,
} from "@/lib/longtail-utils";
import { GrowthBadge, KPICard } from "@/components/insights/shared-components";

// Tab 元件
import { ContributionOverviewTab } from "./tabs/contribution-overview";
import { EvergreenContentTab } from "./tabs/evergreen-content";
import { FeatureAnalysisTab } from "./tabs/feature-analysis";
import { DeepInsightsTab } from "./tabs/deep-insights";

type LongtailTab = "contribution" | "evergreen" | "features" | "insights";

// 共用資料類型
export interface PostWithMetrics {
  id: string;
  text: string;
  mediaType: string | null;
  publishedAt: string;
  currentViews: number;
  currentLikes: number;
  currentReplies: number;
  currentReposts: number;
  currentQuotes: number;
  daysSincePublish: number;
  first7dViews: number;
  longtailRatio: number;
  evergreenIndex: number;
  status: string;
  tags: { id: string; name: string; color: string }[];
}

export interface LongtailPageData {
  posts: PostWithMetrics[];
  contribution: LongtailContribution;
  accountLongtailRatio: number;
  evergreenPostCount: number;
  avgHalfLifeDays: number | null;
  potentialScore: number;
  isLoading: boolean;
}

export default function LongtailPage() {
  const supabase = createClient();
  const { selectedAccountId, isLoading: isAccountLoading } =
    useSelectedAccount();
  const [activeTab, setActiveTab] = useState<LongtailTab>("contribution");
  const [period, setPeriod] = useState<Period>("month");
  const [offset, setOffset] = useState(0);

  // 資料狀態
  const [posts, setPosts] = useState<PostWithMetrics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dailyMetricsMap, setDailyMetricsMap] = useState<
    Map<string, { date: string; views: number }[]>
  >(new Map());

  // 計算當前和上期日期範圍
  const currentRange = useMemo(
    () => getDateRange(period, offset),
    [period, offset]
  );
  const previousRange = useMemo(
    () => getDateRange(period, offset - 1),
    [period, offset]
  );

  // 載入資料
  useEffect(() => {
    if (isAccountLoading || !selectedAccountId) {
      setIsLoading(false);
      return;
    }

    async function loadData() {
      setIsLoading(true);

      try {
        // 1. 取得所有貼文（發布超過 7 天的）
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { data: postsData, error: postsError } = await supabase
          .from("workspace_threads_posts")
          .select(
            `
            id,
            text,
            media_type,
            published_at,
            current_views,
            current_likes,
            current_replies,
            current_reposts,
            current_quotes,
            first_7d_views,
            longtail_ratio,
            evergreen_index,
            longtail_status,
            workspace_threads_post_tags (
              workspace_threads_account_tags (
                id,
                name,
                color
              )
            )
          `
          )
          .eq("workspace_threads_account_id", selectedAccountId)
          .neq("media_type", "REPOST_FACADE")
          .lt("published_at", sevenDaysAgo.toISOString())
          .order("published_at", { ascending: false });

        if (postsError) {
          console.error("Failed to fetch posts:", postsError);
          return;
        }

        // 取得貼文 ID 列表
        const postIds = postsData?.map((p) => p.id) || [];

        // 2. 取得日級成效數據（用於計算長尾貢獻）
        let dailyMetrics: {
          workspace_threads_post_id: string;
          bucket_date: string;
          views: number;
        }[] = [];

        if (postIds.length > 0) {
          const { data: metricsData, error: metricsError } = await supabase
            .from("workspace_threads_post_metrics_daily")
            .select("workspace_threads_post_id, bucket_date, views")
            .in("workspace_threads_post_id", postIds)
            .order("bucket_date", { ascending: true });

          if (!metricsError && metricsData) {
            dailyMetrics = metricsData;
          }
        }

        // 3. 建立每篇貼文的日級數據 Map
        const metricsMap = new Map<string, { date: string; views: number }[]>();
        for (const metric of dailyMetrics) {
          const postId = metric.workspace_threads_post_id;
          if (!metricsMap.has(postId)) {
            metricsMap.set(postId, []);
          }
          metricsMap.get(postId)!.push({
            date: metric.bucket_date,
            views: metric.views,
          });
        }
        setDailyMetricsMap(metricsMap);

        // 4. 處理貼文資料
        const processedPosts: PostWithMetrics[] = (postsData || []).map(
          (post) => {
            const daysSincePublish = getDaysSincePublish(post.published_at);
            const postDailyMetrics = metricsMap.get(post.id) || [];

            // 使用 contribution 分佈計算長尾比例（更準確）
            const contribution = calculateLongtailContribution(
              new Date(post.published_at),
              postDailyMetrics
            );

            // 長尾比例：7 天後曝光 / 總曝光
            // 注意：growth (7-30天) + longtail (30-90天) + deepLongtail (90+天) 都算長尾
            let longtailRatio = post.longtail_ratio || 0;
            if (longtailRatio === 0 && contribution.totalViews > 0) {
              const longtailViews =
                contribution.growthViews +
                contribution.longtailViews +
                contribution.deepLongtailViews;
              longtailRatio = longtailViews / contribution.totalViews;
            }

            // 計算前 7 天曝光（用於常青指數計算）
            const first7dViews = contribution.burstViews;

            // 計算常青指數（需要近 30 天數據）
            let evergreenIndex = post.evergreen_index || 0;
            if (evergreenIndex === 0 && daysSincePublish >= 37 && first7dViews > 0) {
              const now = new Date();
              const recent30dStart = new Date(now);
              recent30dStart.setDate(recent30dStart.getDate() - 30);

              // 計算近 30 天增量
              const sortedMetrics = [...postDailyMetrics].sort(
                (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
              );
              let recent30dViews = 0;
              for (let i = 0; i < sortedMetrics.length; i++) {
                const m = sortedMetrics[i];
                if (new Date(m.date) >= recent30dStart) {
                  const prev = i > 0 ? sortedMetrics[i - 1] : null;
                  recent30dViews += prev ? Math.max(0, m.views - prev.views) : m.views;
                }
              }

              evergreenIndex = calculateEvergreenIndex(recent30dViews, first7dViews);
            }

            // 判斷狀態
            const status =
              post.longtail_status ||
              getPostLongtailStatus(evergreenIndex, null, 0, daysSincePublish);

            // 處理標籤
            type TagRelation = {
              workspace_threads_account_tags: {
                id: string;
                name: string;
                color: string;
              } | null;
            };
            const tagRelations = post.workspace_threads_post_tags as unknown as TagRelation[] | null;
            const tags = (tagRelations || [])
              .map(rel => rel.workspace_threads_account_tags)
              .filter((tag): tag is NonNullable<typeof tag> => tag !== null);

            return {
              id: post.id,
              text: post.text || "",
              mediaType: post.media_type,
              publishedAt: post.published_at,
              currentViews: post.current_views,
              currentLikes: post.current_likes,
              currentReplies: post.current_replies,
              currentReposts: post.current_reposts,
              currentQuotes: post.current_quotes,
              daysSincePublish,
              first7dViews,
              longtailRatio,
              evergreenIndex,
              status,
              tags,
            };
          }
        );

        // 過濾掉沒有爆發期數據的貼文（沒有 first7dViews 無法準確計算長尾比例）
        const validPosts = processedPosts.filter((p) => p.first7dViews > 0);
        setPosts(validPosts);
      } catch (error) {
        console.error("Error loading longtail data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [selectedAccountId, isAccountLoading, supabase]);

  // 計算總覽數據
  const pageData = useMemo<LongtailPageData>(() => {
    if (posts.length === 0) {
      return {
        posts: [],
        contribution: {
          burstViews: 0,
          growthViews: 0,
          longtailViews: 0,
          deepLongtailViews: 0,
          totalViews: 0,
        },
        accountLongtailRatio: 0,
        evergreenPostCount: 0,
        avgHalfLifeDays: null,
        potentialScore: 0,
        isLoading,
      };
    }

    // 計算各階段曝光貢獻
    let totalBurst = 0;
    let totalGrowth = 0;
    let totalLongtail = 0;
    let totalDeepLongtail = 0;

    for (const post of posts) {
      const dailyViews = dailyMetricsMap.get(post.id) || [];
      const contribution = calculateLongtailContribution(
        new Date(post.publishedAt),
        dailyViews
      );
      totalBurst += contribution.burstViews;
      totalGrowth += contribution.growthViews;
      totalLongtail += contribution.longtailViews;
      totalDeepLongtail += contribution.deepLongtailViews;
    }

    const totalViews = totalBurst + totalGrowth + totalLongtail + totalDeepLongtail;

    // 計算帳號長尾比例
    const accountLongtailRatio =
      totalViews > 0 ? ((totalLongtail + totalDeepLongtail) / totalViews) * 100 : 0;

    // 計算常青貼文數量
    const evergreenPostCount = posts.filter(
      (p) => p.evergreenIndex > 0.3
    ).length;

    // 計算長尾潛力評分
    const potentialScore = calculateLongtailPotentialScore({
      avgLongtailRatio: accountLongtailRatio,
      evergreenPostCount,
      totalPostCount: posts.length,
      recent4wLongtailRatio: accountLongtailRatio,
      prev4wLongtailRatio: accountLongtailRatio * 0.9, // 假設上期略低
    });

    return {
      posts,
      contribution: {
        burstViews: totalBurst,
        growthViews: totalGrowth,
        longtailViews: totalLongtail,
        deepLongtailViews: totalDeepLongtail,
        totalViews,
      },
      accountLongtailRatio,
      evergreenPostCount,
      avgHalfLifeDays: null,
      potentialScore,
      isLoading,
    };
  }, [posts, dailyMetricsMap, isLoading]);

  // 空狀態處理
  if (!isAccountLoading && !selectedAccountId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">長尾分析</h1>
          <p className="text-muted-foreground">
            識別內容資產，優化長期流量策略
          </p>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            請先在左側選單選擇一個 Threads 帳號
          </CardContent>
        </Card>
      </div>
    );
  }

  // 數據不足狀態
  if (!isLoading && posts.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">長尾分析</h1>
          <p className="text-muted-foreground">
            識別內容資產，優化長期流量策略
          </p>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <TreeDeciduous className="mx-auto mb-4 size-12 text-muted-foreground/50" />
            <h3 className="mb-2 text-lg font-medium">需要更多歷史資料</h3>
            <p className="text-muted-foreground">
              長尾分析需要發布超過 7 天的貼文。
              <br />
              請稍後再回來查看。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">長尾分析</h1>
          <p className="text-muted-foreground">
            識別內容資產，優化長期流量策略（僅分析發布超過 7 天且有完整數據的貼文）
          </p>
        </div>
      </div>

      {/* Tab Navigation */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as LongtailTab)}
      >
        <TabsList className="h-10 border bg-muted/50 p-1">
          <TabsTrigger
            value="contribution"
            className="h-8 px-4 data-[state=active]:bg-background"
          >
            <BarChart3 className="mr-1.5 size-4" />
            貢獻總覽
          </TabsTrigger>
          <TabsTrigger
            value="evergreen"
            className="h-8 px-4 data-[state=active]:bg-background"
          >
            <TreeDeciduous className="mr-1.5 size-4" />
            常青內容
          </TabsTrigger>
          <TabsTrigger
            value="features"
            className="h-8 px-4 data-[state=active]:bg-background"
          >
            <Target className="mr-1.5 size-4" />
            特徵分析
          </TabsTrigger>
          <TabsTrigger
            value="insights"
            className="h-8 px-4 data-[state=active]:bg-background"
          >
            <Lightbulb className="mr-1.5 size-4" />
            深度洞察
          </TabsTrigger>
        </TabsList>

        <TabsContent value="contribution" className="mt-6">
          <ContributionOverviewTab data={pageData} />
        </TabsContent>
        <TabsContent value="evergreen" className="mt-6">
          <EvergreenContentTab data={pageData} />
        </TabsContent>
        <TabsContent value="features" className="mt-6">
          <FeatureAnalysisTab data={pageData} />
        </TabsContent>
        <TabsContent value="insights" className="mt-6">
          <DeepInsightsTab data={pageData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
