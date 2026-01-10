"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { PostsFilters, PostsTable, type PostsFiltersValue, type Post, type PostTrend, type SortField, type SortOrder } from "@/components/posts";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { createClient } from "@/lib/supabase/client";

// 取得貼文的趨勢資料
// - 數量指標 (views, likes, replies)：使用 Delta 增量
// - 比率指標 (engagement_rate, reply_rate, virality_score)：使用 Snapshot 絕對值
async function fetchPostTrends(postIds: string[]): Promise<Map<string, PostTrend>> {
  if (postIds.length === 0) return new Map();

  const supabase = createClient();
  const trendMap = new Map<string, PostTrend>();

  // 為每篇貼文分別查詢（避免 Supabase 1000 筆限制）
  const promises = postIds.map(async (postId) => {
    // 1. 查詢 deltas（數量變化）- 最近 12 筆 ≈ 3 小時
    const { data: deltas } = await supabase
      .from("workspace_threads_post_metrics_deltas")
      .select("views_delta, likes_delta, replies_delta, reposts_delta, quotes_delta")
      .eq("workspace_threads_post_id", postId)
      .order("period_end", { ascending: false })
      .limit(12);

    // 2. 查詢 snapshots（比率趨勢）- 最近 12 筆 ≈ 3 小時
    const { data: snapshots } = await supabase
      .from("workspace_threads_post_metrics")
      .select("engagement_rate, reply_rate, virality_score")
      .eq("workspace_threads_post_id", postId)
      .order("captured_at", { ascending: false })
      .limit(12);

    const trend: PostTrend = {
      views: [],
      likes: [],
      replies: [],
      reposts: [],
      quotes: [],
      engagement_rate: [],
      reply_rate: [],
      virality_score: [],
    };

    // 填入 delta 數據
    if (deltas && deltas.length >= 2) {
      const reversed = deltas.reverse();
      trend.views = reversed.map(d => d.views_delta);
      trend.likes = reversed.map(d => d.likes_delta);
      trend.replies = reversed.map(d => d.replies_delta);
      trend.reposts = reversed.map(d => d.reposts_delta);
      trend.quotes = reversed.map(d => d.quotes_delta);
    }

    // 填入 snapshot 比率數據
    if (snapshots && snapshots.length >= 2) {
      const reversed = snapshots.reverse();
      trend.engagement_rate = reversed.map(s => Number(s.engagement_rate) || 0);
      trend.reply_rate = reversed.map(s => Number(s.reply_rate) || 0);
      trend.virality_score = reversed.map(s => Number(s.virality_score) || 0);
    }

    // 只要有任一數據就加入 map
    if (trend.views.length > 0 || trend.engagement_rate.length > 0) {
      trendMap.set(postId, trend);
    }
  });

  await Promise.all(promises);
  return trendMap;
}

const PAGE_SIZE = 20;

interface ThreadsAccount {
  id: string;
  username: string;
}

export default function PostsPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<ThreadsAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);

  const [filters, setFilters] = useState<PostsFiltersValue>({
    timeRange: "30d",
    accountId: "all",
    mediaType: "all",
  });

  const [sortField, setSortField] = useState<SortField>("published_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // 取得帳號列表
  useEffect(() => {
    async function fetchAccounts() {
      const supabase = createClient();
      const workspaceId = localStorage.getItem("currentWorkspaceId");
      if (!workspaceId) return;

      const { data } = await supabase
        .from("workspace_threads_accounts")
        .select("id, username")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });

      if (data) {
        setAccounts(data);
      }
    }

    fetchAccounts();
  }, []);

  // 取得貼文
  const fetchPosts = useCallback(async (reset: boolean = false) => {
    // 防止重複請求
    if (!reset && (isLoading || isLoadingMore)) {
      return;
    }

    const supabase = createClient();
    const workspaceId = localStorage.getItem("currentWorkspaceId");
    if (!workspaceId) {
      setIsLoading(false);
      return;
    }

    if (reset) {
      setIsLoading(true);
      setPosts([]);
      setPage(0);
    } else {
      setIsLoadingMore(true);
    }

    const currentPage = reset ? 0 : page;
    const from = currentPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // 建立查詢 - 透過 accounts 的 workspace_id 過濾
    let query = supabase
      .from("workspace_threads_posts")
      .select(`
        id,
        text,
        media_type,
        media_url,
        permalink,
        published_at,
        current_views,
        current_likes,
        current_replies,
        current_reposts,
        current_quotes,
        engagement_rate,
        reply_rate,
        repost_rate,
        quote_rate,
        virality_score,
        last_metrics_sync_at,
        workspace_threads_accounts!inner (
          id,
          username,
          profile_pic_url,
          workspace_id
        )
      `)
      .eq("workspace_threads_accounts.workspace_id", workspaceId);

    // 時間範圍篩選
    if (filters.timeRange !== "all") {
      const days = parseInt(filters.timeRange);
      const since = new Date();
      since.setDate(since.getDate() - days);
      query = query.gte("published_at", since.toISOString());
    }

    // 帳號篩選
    if (filters.accountId !== "all") {
      query = query.eq("workspace_threads_account_id", filters.accountId);
    }

    // 媒體類型篩選
    if (filters.mediaType !== "all") {
      query = query.eq("media_type", filters.mediaType);
    }

    // 排序
    query = query
      .order(sortField, { ascending: sortOrder === "asc" })
      .range(from, to);

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching posts:", error);
      setIsLoading(false);
      setIsLoadingMore(false);
      return;
    }

    // 轉換資料格式
    type AccountData = {
      id: string;
      username: string;
      profile_pic_url: string | null;
    };

    // 取得趨勢資料
    const postIds = (data || []).map(p => p.id);
    const trendMap = await fetchPostTrends(postIds);

    const formattedPosts: Post[] = (data || []).map((post) => {
      // Supabase 回傳單一關聯為物件
      const accountData = post.workspace_threads_accounts as unknown as AccountData | null;

      return {
        id: post.id,
        text: post.text,
        media_type: post.media_type,
        media_url: post.media_url,
        thumbnail_url: null,
        permalink: post.permalink,
        published_at: post.published_at,
        current_views: post.current_views || 0,
        current_likes: post.current_likes || 0,
        current_replies: post.current_replies || 0,
        current_reposts: post.current_reposts || 0,
        current_quotes: post.current_quotes || 0,
        engagement_rate: post.engagement_rate || 0,
        reply_rate: post.reply_rate || 0,
        repost_rate: post.repost_rate || 0,
        quote_rate: post.quote_rate || 0,
        virality_score: post.virality_score || 0,
        metrics_updated_at: post.last_metrics_sync_at,
        trend: trendMap.get(post.id),
        account: {
          id: accountData?.id || "",
          username: accountData?.username || "",
          profile_picture_url: accountData?.profile_pic_url || null,
        },
      };
    });

    if (reset) {
      setPosts(formattedPosts);
      setPage(1);
    } else {
      // 去除重複的貼文
      setPosts((prev) => {
        const existingIds = new Set(prev.map(p => p.id));
        const newPosts = formattedPosts.filter(p => !existingIds.has(p.id));
        return [...prev, ...newPosts];
      });
      setPage((prev) => prev + 1);
    }

    setHasMore(formattedPosts.length === PAGE_SIZE);
    setIsLoading(false);
    setIsLoadingMore(false);
  }, [filters, sortField, sortOrder, page]);

  // 初始載入 & 篩選/排序變更時重新載入
  useEffect(() => {
    fetchPosts(true);
  }, [filters, sortField, sortOrder]);

  // 載入更多
  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      fetchPosts(false);
    }
  }, [fetchPosts, isLoadingMore, hasMore]);

  // 無限滾動
  const { sentinelRef } = useInfiniteScroll({
    onLoadMore: loadMore,
    hasMore,
    isLoading: isLoadingMore,
  });

  // 排序處理
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortOrder("desc");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">貼文列表</h1>
        <p className="text-muted-foreground">查看和分析你的 Threads 貼文成效</p>
      </div>

      {/* 篩選器 */}
      <PostsFilters
        filters={filters}
        onFiltersChange={setFilters}
        accounts={accounts}
      />

      {/* 貼文表格 */}
      <PostsTable
        posts={posts}
        sortField={sortField}
        sortOrder={sortOrder}
        onSort={handleSort}
        isLoading={isLoading}
      />

      {/* 無限滾動哨兵 */}
      <div ref={sentinelRef} className="flex justify-center py-4">
        {isLoadingMore && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            <span>載入更多...</span>
          </div>
        )}
        {!hasMore && posts.length > 0 && (
          <span className="text-sm text-muted-foreground">已顯示全部貼文</span>
        )}
      </div>
    </div>
  );
}
