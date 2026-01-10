"use client";

import { useState, useEffect } from "react";
import { Users, TrendingUp, FileText, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  KPICard,
  TrendChart,
  TopPosts,
  RecentPosts,
  type TopPost,
  type RecentPost,
  type TrendDataPoint,
} from "@/components/dashboard";

interface ThreadsAccount {
  id: string;
  username: string;
  profilePicUrl: string | null;
  currentFollowers: number;
}

interface KPIData {
  totalFollowers: number;
  previousFollowers: number;
  totalViews: number;
  previousViews: number;
  totalPosts: number;
  previousPosts: number;
  totalInteractions: number;
  previousInteractions: number;
}

export default function DashboardPage() {
  const [accounts, setAccounts] = useState<ThreadsAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [kpiData, setKpiData] = useState<KPIData>({
    totalFollowers: 0,
    previousFollowers: 0,
    totalViews: 0,
    previousViews: 0,
    totalPosts: 0,
    previousPosts: 0,
    totalInteractions: 0,
    previousInteractions: 0,
  });
  const [trendData, setTrendData] = useState<TrendDataPoint[]>([]);
  const [topPosts, setTopPosts] = useState<TopPost[]>([]);
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasNoAccounts, setHasNoAccounts] = useState(false);

  // 取得帳號列表 & 載入所有資料
  useEffect(() => {
    async function loadDashboardData() {
      const supabase = createClient();
      const workspaceId = localStorage.getItem("currentWorkspaceId");

      if (!workspaceId) {
        setIsLoading(false);
        setHasNoAccounts(true);
        return;
      }

      // 1. 取得帳號列表
      const { data: accountsData, error: accountsError } = await supabase
        .from("workspace_threads_accounts")
        .select("id, username, profile_pic_url, current_followers_count")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });

      const accountsList: ThreadsAccount[] = (accountsData || []).map((a) => ({
        id: a.id,
        username: a.username,
        profilePicUrl: a.profile_pic_url,
        currentFollowers: a.current_followers_count || 0,
      }));

      setAccounts(accountsList);

      if (accountsList.length === 0) {
        setIsLoading(false);
        setHasNoAccounts(true);
        return;
      }

      // 2. 並行載入所有資料
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      // KPI 資料
      const totalFollowers = accountsList.reduce((sum, a) => sum + a.currentFollowers, 0);

      try {
      const [currentPostsRes, previousPostsRes, topPostsRes, recentPostsRes] = await Promise.all([
        // 當週貼文
        supabase
          .from("workspace_threads_posts")
          .select(`
            id,
            current_views,
            current_likes,
            current_replies,
            current_reposts,
            current_quotes,
            workspace_threads_accounts!inner (workspace_id)
          `)
          .eq("workspace_threads_accounts.workspace_id", workspaceId)
          .gte("published_at", sevenDaysAgo.toISOString()),

        // 上週貼文
        supabase
          .from("workspace_threads_posts")
          .select(`
            id,
            current_views,
            current_likes,
            current_replies,
            current_reposts,
            current_quotes,
            workspace_threads_accounts!inner (workspace_id)
          `)
          .eq("workspace_threads_accounts.workspace_id", workspaceId)
          .gte("published_at", fourteenDaysAgo.toISOString())
          .lt("published_at", sevenDaysAgo.toISOString()),

        // 熱門貼文
        supabase
          .from("workspace_threads_posts")
          .select(`
            id,
            text,
            permalink,
            published_at,
            current_views,
            current_likes,
            current_replies,
            workspace_threads_accounts!inner (
              id,
              username,
              profile_pic_url,
              workspace_id
            )
          `)
          .eq("workspace_threads_accounts.workspace_id", workspaceId)
          .order("current_views", { ascending: false })
          .limit(5),

        // 最新貼文
        supabase
          .from("workspace_threads_posts")
          .select(`
            id,
            text,
            media_type,
            permalink,
            published_at,
            workspace_threads_accounts!inner (
              id,
              username,
              profile_pic_url,
              workspace_id
            )
          `)
          .eq("workspace_threads_accounts.workspace_id", workspaceId)
          .order("published_at", { ascending: false })
          .limit(5),
      ]);

      // 計算 KPI
      const currentPosts = currentPostsRes.data || [];
      const previousPosts = previousPostsRes.data || [];

      const currentViews = currentPosts.reduce((sum, p) => sum + (p.current_views || 0), 0);
      const previousViews = previousPosts.reduce((sum, p) => sum + (p.current_views || 0), 0);

      const currentInteractions = currentPosts.reduce(
        (sum, p) =>
          sum +
          (p.current_likes || 0) +
          (p.current_replies || 0) +
          (p.current_reposts || 0) +
          (p.current_quotes || 0),
        0
      );
      const previousInteractions = previousPosts.reduce(
        (sum, p) =>
          sum +
          (p.current_likes || 0) +
          (p.current_replies || 0) +
          (p.current_reposts || 0) +
          (p.current_quotes || 0),
        0
      );

      setKpiData({
        totalFollowers,
        previousFollowers: totalFollowers,
        totalViews: currentViews,
        previousViews,
        totalPosts: currentPosts.length,
        previousPosts: previousPosts.length,
        totalInteractions: currentInteractions,
        previousInteractions,
      });

      // 處理熱門貼文
      type AccountData = {
        id: string;
        username: string;
        profile_pic_url: string | null;
      };

      if (topPostsRes.data) {
        setTopPosts(
          topPostsRes.data.map((p) => {
            const accountData = p.workspace_threads_accounts as unknown as AccountData;
            return {
              id: p.id,
              text: p.text,
              permalink: p.permalink,
              publishedAt: p.published_at,
              views: p.current_views || 0,
              likes: p.current_likes || 0,
              replies: p.current_replies || 0,
              account: {
                id: accountData?.id || "",
                username: accountData?.username || "",
                profilePicUrl: accountData?.profile_pic_url || null,
              },
            };
          })
        );
      }

      // 處理最新貼文
      if (recentPostsRes.data) {
        setRecentPosts(
          recentPostsRes.data.map((p) => {
            const accountData = p.workspace_threads_accounts as unknown as AccountData;
            return {
              id: p.id,
              text: p.text,
              mediaType: p.media_type,
              permalink: p.permalink,
              publishedAt: p.published_at,
              account: {
                id: accountData?.id || "",
                username: accountData?.username || "",
                profilePicUrl: accountData?.profile_pic_url || null,
              },
            };
          })
        );
      }

      // 趨勢資料（過去 7 天，每日匯總）
      const trendPromises = accountsList.map(async (account) => {
        const { data } = await supabase
          .from("workspace_threads_posts")
          .select("published_at, current_views")
          .eq("workspace_threads_account_id", account.id)
          .gte("published_at", sevenDaysAgo.toISOString())
          .order("published_at", { ascending: true });

        return { accountId: account.id, posts: data || [] };
      });

      const trendResults = await Promise.all(trendPromises);

      // 建立日期對應表
      const dateMap = new Map<string, Record<string, number>>();
      for (let i = 0; i < 7; i++) {
        const date = new Date();
        date.setDate(date.getDate() - (6 - i));
        const dateStr = date.toISOString().split("T")[0];
        dateMap.set(dateStr, {});
      }

      // 填入各帳號數據
      trendResults.forEach(({ accountId, posts }) => {
        posts.forEach((post) => {
          const dateStr = post.published_at.split("T")[0];
          const dayData = dateMap.get(dateStr);
          if (dayData) {
            dayData[accountId] = (dayData[accountId] || 0) + (post.current_views || 0);
          }
        });
      });

      // 轉換為陣列
      const trendArray: TrendDataPoint[] = [];
      dateMap.forEach((values, date) => {
        const point: TrendDataPoint = { date };
        accountsList.forEach((account) => {
          point[account.id] = values[account.id] || 0;
        });
        trendArray.push(point);
      });

      setTrendData(trendArray);
      } catch (error) {
        console.error("[Dashboard] Error loading data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, []);

  const handleTabChange = (value: string) => {
    setSelectedAccountId(value);
  };

  // 根據選擇的帳號篩選資料
  const filteredTopPosts = selectedAccountId === "all"
    ? topPosts
    : topPosts.filter((p) => p.account.id === selectedAccountId);

  const filteredTrendData = trendData;
  const displayAccounts = selectedAccountId === "all"
    ? accounts
    : accounts.filter((a) => a.id === selectedAccountId);

  return (
    <div className="space-y-6">
      {/* 標題 */}
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          快速掌握 Threads 帳號的整體表現
        </p>
      </div>

      {/* 無帳號提示 */}
      {hasNoAccounts && !isLoading && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            尚未連結任何 Threads 帳號，請先至設定頁面連結帳號。
          </p>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <KPICard
          title="總粉絲數"
          value={kpiData.totalFollowers}
          icon={<Users className="size-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="本週觀看數"
          value={kpiData.totalViews}
          previousValue={kpiData.previousViews}
          icon={<Eye className="size-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="本週互動數"
          value={kpiData.totalInteractions}
          previousValue={kpiData.previousInteractions}
          icon={<TrendingUp className="size-4" />}
          isLoading={isLoading}
        />
        <KPICard
          title="本週貼文數"
          value={kpiData.totalPosts}
          previousValue={kpiData.previousPosts}
          icon={<FileText className="size-4" />}
          isLoading={isLoading}
        />
      </div>

      {/* 帳號切換 Tabs */}
      {accounts.length > 0 && (
        <Tabs value={selectedAccountId} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="all">全部帳號</TabsTrigger>
            {accounts.map((account) => (
              <TabsTrigger key={account.id} value={account.id}>
                @{account.username}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={selectedAccountId} className="mt-6 space-y-6">
            {/* 趨勢圖表（全寬） */}
            <TrendChart
              title="觀看數趨勢"
              data={filteredTrendData}
              accounts={displayAccounts}
              selectedAccountId={
                selectedAccountId === "all" ? null : selectedAccountId
              }
              isLoading={isLoading}
            />

            {/* 熱門貼文 */}
            <TopPosts
              posts={filteredTopPosts}
              showAccount={selectedAccountId === "all"}
              isLoading={isLoading}
            />
          </TabsContent>
        </Tabs>
      )}

      {/* 最新貼文 */}
      {accounts.length > 0 && (
        <RecentPosts posts={recentPosts} isLoading={isLoading} />
      )}
    </div>
  );
}
