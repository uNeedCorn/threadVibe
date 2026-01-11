"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { PostsFilters, PostsTable, type PostsFiltersValue, type Post, type PostTag, type PostTrend, type SortField, type SortOrder } from "@/components/posts";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useSelectedAccount } from "@/hooks/use-selected-account";
import { useAccountTags } from "@/hooks/use-account-tags";
import { createClient } from "@/lib/supabase/client";

// 取得貼文的趨勢資料
async function fetchPostTrends(postIds: string[]): Promise<Map<string, PostTrend>> {
  if (postIds.length === 0) return new Map();

  const supabase = createClient();
  const trendMap = new Map<string, PostTrend>();

  const promises = postIds.map(async (postId) => {
    const { data: deltas } = await supabase
      .from("workspace_threads_post_metrics_deltas")
      .select("views_delta, likes_delta, replies_delta, reposts_delta, quotes_delta")
      .eq("workspace_threads_post_id", postId)
      .order("period_end", { ascending: false })
      .limit(12);

    const { data: snapshots } = await supabase
      .from("workspace_threads_post_metrics")
      .select("engagement_rate, reply_rate, repost_rate, quote_rate, virality_score")
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
      repost_rate: [],
      quote_rate: [],
      virality_score: [],
    };

    if (deltas && deltas.length >= 2) {
      const reversed = deltas.reverse();
      trend.views = reversed.map(d => d.views_delta);
      trend.likes = reversed.map(d => d.likes_delta);
      trend.replies = reversed.map(d => d.replies_delta);
      trend.reposts = reversed.map(d => d.reposts_delta);
      trend.quotes = reversed.map(d => d.quotes_delta);
    }

    if (snapshots && snapshots.length >= 2) {
      const reversed = snapshots.reverse();
      trend.engagement_rate = reversed.map(s => Number(s.engagement_rate) || 0);
      trend.reply_rate = reversed.map(s => Number(s.reply_rate) || 0);
      trend.repost_rate = reversed.map(s => Number(s.repost_rate) || 0);
      trend.quote_rate = reversed.map(s => Number(s.quote_rate) || 0);
      trend.virality_score = reversed.map(s => Number(s.virality_score) || 0);
    }

    if (trend.views.length > 0 || trend.engagement_rate.length > 0) {
      trendMap.set(postId, trend);
    }
  });

  await Promise.all(promises);
  return trendMap;
}

const PAGE_SIZE = 20;

export default function PostsPage() {
  const { selectedAccountId, isLoading: isAccountLoading } = useSelectedAccount();
  const { tags: accountTags, createTag, refetch: refetchTags } = useAccountTags();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(0);
  const [hasNoAccount, setHasNoAccount] = useState(false);

  const [filters, setFilters] = useState<PostsFiltersValue>({
    timeRange: "30d",
    mediaType: "all",
    tagIds: [],
  });

  const [sortField, setSortField] = useState<SortField>("published_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // 取得貼文
  const fetchPosts = useCallback(async (reset: boolean = false) => {
    if (!selectedAccountId) return;
    if (!reset && (isLoading || isLoadingMore)) return;

    const supabase = createClient();

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

    // 如果有標籤篩選，先取得符合標籤的貼文 ID
    let filteredPostIds: string[] | null = null;
    if (filters.tagIds.length > 0) {
      const { data: taggedPosts } = await supabase
        .from("workspace_threads_post_tags")
        .select("post_id")
        .in("tag_id", filters.tagIds);

      if (taggedPosts) {
        filteredPostIds = [...new Set(taggedPosts.map(t => t.post_id))];
        if (filteredPostIds.length === 0) {
          // 沒有符合標籤的貼文
          setPosts([]);
          setHasMore(false);
          setIsLoading(false);
          setIsLoadingMore(false);
          return;
        }
      }
    }

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
          profile_pic_url
        ),
        workspace_threads_post_tags (
          workspace_threads_account_tags (
            id,
            name,
            color
          )
        )
      `)
      .eq("workspace_threads_account_id", selectedAccountId);

    // 標籤篩選
    if (filteredPostIds) {
      query = query.in("id", filteredPostIds);
    }

    // 時間範圍篩選
    if (filters.timeRange !== "all") {
      const days = parseInt(filters.timeRange);
      const since = new Date();
      since.setDate(since.getDate() - days);
      query = query.gte("published_at", since.toISOString());
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

    type AccountData = {
      id: string;
      username: string;
      profile_pic_url: string | null;
    };

    type TagRelation = {
      workspace_threads_account_tags: {
        id: string;
        name: string;
        color: string;
      } | null;
    };

    const postIds = (data || []).map(p => p.id);
    const trendMap = await fetchPostTrends(postIds);

    const formattedPosts: Post[] = (data || []).map((post) => {
      const accountData = post.workspace_threads_accounts as unknown as AccountData | null;
      const tagRelations = post.workspace_threads_post_tags as unknown as TagRelation[] | null;

      // 提取標籤
      const tags: PostTag[] = (tagRelations || [])
        .map(rel => rel.workspace_threads_account_tags)
        .filter((tag): tag is NonNullable<typeof tag> => tag !== null)
        .map(tag => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
        }));

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
        tags,
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
  }, [selectedAccountId, filters, sortField, sortOrder, page, isLoading, isLoadingMore]);

  // 當帳號或篩選變更時重新載入
  useEffect(() => {
    if (isAccountLoading) return;

    if (!selectedAccountId) {
      // 嘗試取得第一個帳號
      const workspaceId = localStorage.getItem("currentWorkspaceId");
      if (!workspaceId) {
        setIsLoading(false);
        setHasNoAccount(true);
        return;
      }

      const supabase = createClient();
      supabase
        .from("workspace_threads_accounts")
        .select("id")
        .eq("workspace_id", workspaceId)
        .eq("is_active", true)
        .limit(1)
        .then(({ data }) => {
          if (!data || data.length === 0) {
            setIsLoading(false);
            setHasNoAccount(true);
            return;
          }
          localStorage.setItem("currentThreadsAccountId", data[0].id);
          window.dispatchEvent(new Event("storage"));
        });
      return;
    }

    fetchPosts(true);
  }, [selectedAccountId, isAccountLoading, filters, sortField, sortOrder]);

  // 載入更多
  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && selectedAccountId) {
      fetchPosts(false);
    }
  }, [fetchPosts, isLoadingMore, hasMore, selectedAccountId]);

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

  // 處理貼文標籤變更
  const handlePostTagsChange = (postId: string, tags: PostTag[]) => {
    setPosts((prev) =>
      prev.map((post) =>
        post.id === postId ? { ...post, tags } : post
      )
    );
    // 重新載入標籤列表以更新貼文數量
    refetchTags();
  };

  // 處理新增標籤
  const handleCreateTag = async (name: string, color: string) => {
    const newTag = await createTag(name, color);
    return newTag;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">貼文列表</h1>
        <p className="text-muted-foreground">查看和分析你的 Threads 貼文成效</p>
      </div>

      {/* 無帳號提示 */}
      {hasNoAccount && !isLoading && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-muted-foreground">
            尚未連結任何 Threads 帳號，請先至設定頁面連結帳號。
          </p>
        </div>
      )}

      {/* 篩選器 */}
      {!hasNoAccount && (
        <PostsFilters
          filters={filters}
          onFiltersChange={setFilters}
          tags={accountTags}
        />
      )}

      {/* 貼文表格 */}
      {!hasNoAccount && (
        <PostsTable
          posts={posts}
          sortField={sortField}
          sortOrder={sortOrder}
          onSort={handleSort}
          isLoading={isLoading}
          accountTags={accountTags}
          onCreateTag={handleCreateTag}
          onPostTagsChange={handlePostTagsChange}
        />
      )}

      {/* 無限滾動哨兵 */}
      {!hasNoAccount && (
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
      )}
    </div>
  );
}
