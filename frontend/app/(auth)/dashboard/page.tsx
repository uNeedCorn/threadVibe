"use client";

import { useState, useEffect } from "react";
import { Users, TrendingUp, FileText, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useSelectedAccount } from "@/hooks/use-selected-account";
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
  const { selectedAccountId, isLoading: isAccountLoading } = useSelectedAccount();
  const [account, setAccount] = useState<ThreadsAccount | null>(null);
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

  useEffect(() => {
    if (isAccountLoading) return;

    async function loadDashboardData() {
      setIsLoading(true);
      const supabase = createClient();

      if (!selectedAccountId) {
        // 沒有選擇帳號，嘗試取得第一個帳號
        const workspaceId = localStorage.getItem("currentWorkspaceId");
        if (!workspaceId) {
          setIsLoading(false);
          setHasNoAccounts(true);
          return;
        }

        const { data: accounts } = await supabase
          .from("workspace_threads_accounts")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("is_active", true)
          .limit(1);

        if (!accounts || accounts.length === 0) {
          setIsLoading(false);
          setHasNoAccounts(true);
          return;
        }

        // 設定第一個帳號並存入 localStorage
        localStorage.setItem("currentThreadsAccountId", accounts[0].id);
        window.dispatchEvent(new Event("storage"));
        return;
      }

      // 1. 取得帳號資料
      const { data: accountData } = await supabase
        .from("workspace_threads_accounts")
        .select("id, username, profile_pic_url, current_followers_count")
        .eq("id", selectedAccountId)
        .single();

      if (!accountData) {
        setIsLoading(false);
        setHasNoAccounts(true);
        return;
      }

      const currentAccount: ThreadsAccount = {
        id: accountData.id,
        username: accountData.username,
        profilePicUrl: accountData.profile_pic_url,
        currentFollowers: accountData.current_followers_count || 0,
      };
      setAccount(currentAccount);

      // 2. 並行載入所有資料
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

      try {
        const [currentPostsRes, previousPostsRes, topPostsRes, recentPostsRes] = await Promise.all([
          // 當週貼文
          supabase
            .from("workspace_threads_posts")
            .select("id, current_views, current_likes, current_replies, current_reposts, current_quotes")
            .eq("workspace_threads_account_id", selectedAccountId)
            .gte("published_at", sevenDaysAgo.toISOString()),

          // 上週貼文
          supabase
            .from("workspace_threads_posts")
            .select("id, current_views, current_likes, current_replies, current_reposts, current_quotes")
            .eq("workspace_threads_account_id", selectedAccountId)
            .gte("published_at", fourteenDaysAgo.toISOString())
            .lt("published_at", sevenDaysAgo.toISOString()),

          // 熱門貼文
          supabase
            .from("workspace_threads_posts")
            .select("id, text, permalink, published_at, current_views, current_likes, current_replies")
            .eq("workspace_threads_account_id", selectedAccountId)
            .order("current_views", { ascending: false })
            .limit(5),

          // 最新貼文
          supabase
            .from("workspace_threads_posts")
            .select("id, text, media_type, permalink, published_at")
            .eq("workspace_threads_account_id", selectedAccountId)
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
          totalFollowers: currentAccount.currentFollowers,
          previousFollowers: currentAccount.currentFollowers,
          totalViews: currentViews,
          previousViews,
          totalPosts: currentPosts.length,
          previousPosts: previousPosts.length,
          totalInteractions: currentInteractions,
          previousInteractions,
        });

        // 處理熱門貼文
        if (topPostsRes.data) {
          setTopPosts(
            topPostsRes.data.map((p) => ({
              id: p.id,
              text: p.text,
              permalink: p.permalink,
              publishedAt: p.published_at,
              views: p.current_views || 0,
              likes: p.current_likes || 0,
              replies: p.current_replies || 0,
              account: {
                id: currentAccount.id,
                username: currentAccount.username,
                profilePicUrl: currentAccount.profilePicUrl,
              },
            }))
          );
        }

        // 處理最新貼文
        if (recentPostsRes.data) {
          setRecentPosts(
            recentPostsRes.data.map((p) => ({
              id: p.id,
              text: p.text,
              mediaType: p.media_type,
              permalink: p.permalink,
              publishedAt: p.published_at,
              account: {
                id: currentAccount.id,
                username: currentAccount.username,
                profilePicUrl: currentAccount.profilePicUrl,
              },
            }))
          );
        }

        // 趨勢資料（過去 7 天，每日匯總）
        const { data: trendPosts } = await supabase
          .from("workspace_threads_posts")
          .select("published_at, current_views")
          .eq("workspace_threads_account_id", selectedAccountId)
          .gte("published_at", sevenDaysAgo.toISOString())
          .order("published_at", { ascending: true });

        // 建立日期對應表
        const dateMap = new Map<string, number>();
        for (let i = 0; i < 7; i++) {
          const date = new Date();
          date.setDate(date.getDate() - (6 - i));
          const dateStr = date.toISOString().split("T")[0];
          dateMap.set(dateStr, 0);
        }

        // 填入數據
        (trendPosts || []).forEach((post) => {
          const dateStr = post.published_at.split("T")[0];
          if (dateMap.has(dateStr)) {
            dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + (post.current_views || 0));
          }
        });

        // 轉換為陣列
        const trendArray: TrendDataPoint[] = [];
        dateMap.forEach((views, date) => {
          trendArray.push({
            date,
            [selectedAccountId]: views,
          });
        });

        setTrendData(trendArray);
      } catch (error) {
        console.error("[Dashboard] Error loading data:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadDashboardData();
  }, [selectedAccountId, isAccountLoading]);

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

      {/* 趨勢圖表 */}
      {account && (
        <TrendChart
          title="觀看數趨勢"
          data={trendData}
          accounts={[account]}
          selectedAccountId={selectedAccountId}
          isLoading={isLoading}
        />
      )}

      {/* 熱門貼文 */}
      {account && (
        <TopPosts
          posts={topPosts}
          showAccount={false}
          isLoading={isLoading}
        />
      )}

      {/* 最新貼文 */}
      {account && (
        <RecentPosts posts={recentPosts} isLoading={isLoading} />
      )}
    </div>
  );
}
