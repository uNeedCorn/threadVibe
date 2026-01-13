"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, Clock } from "lucide-react";
import { PostsFilters, PostsTable, PostDetailPanel, ColumnSettings, type PostsFiltersValue, type Post, type PostTag, type PostTrend, type SortField, type SortOrder } from "@/components/posts";
import { useInfiniteScroll } from "@/hooks/use-infinite-scroll";
import { useSelectedAccount } from "@/hooks/use-selected-account";
import { useAccountTags } from "@/hooks/use-account-tags";
import { useColumnConfig } from "@/hooks/use-column-config";
import { createClient } from "@/lib/supabase/client";

// 計算增量值（delta）：將絕對值陣列轉換為相鄰差值
function calculateDeltas(values: number[]): number[] {
  if (values.length < 2) return [];
  const deltas: number[] = [];
  for (let i = 1; i < values.length; i++) {
    deltas.push(Math.max(0, values[i] - values[i - 1])); // 確保非負
  }
  return deltas;
}

// 取得貼文的趨勢資料（從 hourly 表抓取近 6 小時）
// - 計數類（views, likes 等）顯示增量值
// - 比率類（engagement_rate 等）顯示原始比率
async function fetchPostTrends(postIds: string[]): Promise<Map<string, PostTrend>> {
  if (postIds.length === 0) return new Map();

  const supabase = createClient();
  const trendMap = new Map<string, PostTrend>();

  // 計算 6 小時前的時間
  const sixHoursAgo = new Date();
  sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);

  const promises = postIds.map(async (postId) => {
    // 從 hourly 表取得近 6 小時的資料（含 rate/score 欄位）
    const { data: hourlyData } = await supabase
      .from("workspace_threads_post_metrics_hourly")
      .select("bucket_ts, views, likes, replies, reposts, quotes, shares, engagement_rate, reply_rate, repost_rate, quote_rate, virality_score")
      .eq("workspace_threads_post_id", postId)
      .gte("bucket_ts", sixHoursAgo.toISOString())
      .order("bucket_ts", { ascending: true })
      .limit(7); // 多取一筆用於計算 6 個增量

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

    if (hourlyData && hourlyData.length >= 2) {
      // 計數類：計算增量
      const rawViews = hourlyData.map(d => d.views || 0);
      const rawLikes = hourlyData.map(d => d.likes || 0);
      const rawReplies = hourlyData.map(d => d.replies || 0);
      const rawReposts = hourlyData.map(d => d.reposts || 0);
      const rawQuotes = hourlyData.map(d => d.quotes || 0);

      trend.views = calculateDeltas(rawViews);
      trend.likes = calculateDeltas(rawLikes);
      trend.replies = calculateDeltas(rawReplies);
      trend.reposts = calculateDeltas(rawReposts);
      trend.quotes = calculateDeltas(rawQuotes);

      // 比率類：直接使用原始值（跳過第一筆，對齊增量的時間點）
      trend.engagement_rate = hourlyData.slice(1).map(d => d.engagement_rate || 0);
      trend.reply_rate = hourlyData.slice(1).map(d => d.reply_rate || 0);
      trend.repost_rate = hourlyData.slice(1).map(d => d.repost_rate || 0);
      trend.quote_rate = hourlyData.slice(1).map(d => d.quote_rate || 0);
      trend.virality_score = hourlyData.slice(1).map(d => d.virality_score || 0);
    }

    if (trend.views.length > 0) {
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
  const {
    columns: columnConfig,
    visibleColumns,
    toggleColumn,
    updateWidth,
    reorderColumns,
    resetToDefault,
  } = useColumnConfig();
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
    aiTags: {
      content_type: [],
      tone: [],
      intent: [],
    },
  });

  const [sortField, setSortField] = useState<SortField>("published_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

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
        ai_suggested_tags,
        ai_selected_tags,
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
        ai_suggested_tags: post.ai_suggested_tags,
        ai_selected_tags: post.ai_selected_tags,
        account: {
          id: accountData?.id || "",
          username: accountData?.username || "",
          profile_picture_url: accountData?.profile_pic_url || null,
        },
      };
    });

    // AI 標籤篩選（客戶端篩選）
    const hasAiTagFilter =
      (filters.aiTags?.content_type?.length || 0) > 0 ||
      (filters.aiTags?.tone?.length || 0) > 0 ||
      (filters.aiTags?.intent?.length || 0) > 0;

    const filteredPosts = hasAiTagFilter
      ? formattedPosts.filter((post) => {
          const selectedTags = post.ai_selected_tags || {};

          // 檢查每個維度：如果有選擇篩選條件，貼文必須包含至少一個符合的標籤
          const checkDimension = (dimension: keyof typeof filters.aiTags) => {
            const filterTags = filters.aiTags?.[dimension] || [];
            if (filterTags.length === 0) return true; // 沒有篩選條件則通過
            const postTags = (selectedTags as Record<string, string[]>)[dimension] || [];
            return filterTags.some(tag => postTags.includes(tag));
          };

          return (
            checkDimension("content_type") &&
            checkDimension("tone") &&
            checkDimension("intent")
          );
        })
      : formattedPosts;

    if (reset) {
      setPosts(filteredPosts);
      setPage(1);
    } else {
      setPosts((prev) => {
        const existingIds = new Set(prev.map(p => p.id));
        const newPosts = filteredPosts.filter(p => !existingIds.has(p.id));
        return [...prev, ...newPosts];
      });
      setPage((prev) => prev + 1);
    }

    // 注意：hasMore 判斷仍使用原始資料量，避免因篩選導致提早結束載入
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

  // 處理選擇貼文（開啟側邊 Panel）
  const handleSelectPost = useCallback((postId: string) => {
    setSelectedPostId(postId);
    setIsPanelOpen(true);
  }, []);

  // 處理關閉 Panel
  const handlePanelOpenChange = useCallback((open: boolean) => {
    setIsPanelOpen(open);
    if (!open) {
      setSelectedPostId(null);
    }
  }, []);

  // 計算最近更新時間
  const latestUpdateTime = useMemo(() => {
    if (posts.length === 0) return null;
    const times = posts
      .map(p => p.metrics_updated_at)
      .filter((t): t is string => t !== null)
      .map(t => new Date(t).getTime());
    if (times.length === 0) return null;
    return new Date(Math.max(...times));
  }, [posts]);

  // 格式化相對時間
  const formatRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "剛剛";
    if (diffMins < 60) return `${diffMins} 分鐘前`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} 小時前`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} 天前`;
  };

  // 處理 AI 標籤選擇
  const handleAiTagSelect = async (postId: string, dimension: string, tag: string, selected: boolean) => {
    const supabase = createClient();

    // 取得目前貼文的 ai_selected_tags
    const post = posts.find(p => p.id === postId);
    if (!post) return;

    const currentSelected = post.ai_selected_tags || {};
    const dimTags = currentSelected[dimension as keyof typeof currentSelected] || [];

    // 更新標籤
    let newDimTags: string[];
    if (selected) {
      newDimTags = [...dimTags, tag];
    } else {
      newDimTags = dimTags.filter(t => t !== tag);
    }

    const newSelectedTags = {
      ...currentSelected,
      [dimension]: newDimTags,
    };

    // 更新資料庫
    const { error } = await supabase
      .from("workspace_threads_posts")
      .update({ ai_selected_tags: newSelectedTags })
      .eq("id", postId);

    if (error) {
      console.error("Error updating ai_selected_tags:", error);
      return;
    }

    // 更新本地狀態
    setPosts(prev =>
      prev.map(p =>
        p.id === postId ? { ...p, ai_selected_tags: newSelectedTags } : p
      )
    );
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
        <div className="flex items-center justify-between gap-4">
          <PostsFilters
            filters={filters}
            onFiltersChange={setFilters}
            tags={accountTags}
          />
          <div className="flex items-center gap-4 shrink-0">
            {latestUpdateTime && (
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Clock className="size-4" />
                <span>最近更新：{formatRelativeTime(latestUpdateTime)}</span>
              </div>
            )}
            <ColumnSettings
              columns={columnConfig}
              onToggle={toggleColumn}
              onReorder={reorderColumns}
              onReset={resetToDefault}
            />
          </div>
        </div>
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
          onAiTagSelect={handleAiTagSelect}
          onSelectPost={handleSelectPost}
          columnConfig={visibleColumns}
          onColumnResize={updateWidth}
        />
      )}

      {/* 貼文詳情側邊 Panel */}
      <PostDetailPanel
        open={isPanelOpen}
        onOpenChange={handlePanelOpenChange}
        postId={selectedPostId}
        accountTags={accountTags}
        onTagsChange={handlePostTagsChange}
        onCreateTag={handleCreateTag}
      />

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
