"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useAccountTags } from "@/hooks/use-account-tags";
import { type PostTag } from "@/components/posts";
import {
  PostHeader,
  PostMetricsCards,
  PostMetricsChart,
  TimeRangeTabs,
  type TimeRange,
} from "@/components/posts/post-detail";

interface PostDetail {
  id: string;
  text: string | null;
  media_type: "TEXT_POST" | "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string | null;
  permalink: string;
  published_at: string;
  current_views: number;
  current_likes: number;
  current_replies: number;
  current_reposts: number;
  current_quotes: number;
  engagement_rate: number;
  reply_rate: number;
  repost_rate: number;
  quote_rate: number;
  virality_score: number;
  last_metrics_sync_at: string | null;
  tags?: PostTag[];
  account: {
    id: string;
    username: string;
    profile_pic_url: string | null;
  };
}

interface MetricSnapshot {
  captured_at: string;
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  engagement_rate: number;
  reply_rate: number;
  repost_rate: number;
  quote_rate: number;
  virality_score: number;
}

interface AccountAverage {
  avgViews: number;
  avgLikes: number;
  avgReplies: number;
  avgReposts: number;
  avgQuotes: number;
  avgEngagementRate: number;
  avgReplyRate: number;
  avgRepostRate: number;
  avgQuoteRate: number;
  avgViralityScore: number;
  postCount: number;
}

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;

  const [post, setPost] = useState<PostDetail | null>(null);
  const [metrics, setMetrics] = useState<MetricSnapshot[]>([]);
  const [accountAverage, setAccountAverage] = useState<AccountAverage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>("7d");

  // 標籤相關
  const { tags: accountTags, createTag } = useAccountTags();

  // 取得貼文基本資料
  useEffect(() => {
    async function fetchPost() {
      const supabase = createClient();
      const workspaceId = localStorage.getItem("currentWorkspaceId");
      if (!workspaceId) return;

      const { data, error } = await supabase
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
          ),
          workspace_threads_post_tags (
            workspace_threads_account_tags (
              id,
              name,
              color
            )
          )
        `)
        .eq("id", postId)
        .eq("workspace_threads_accounts.workspace_id", workspaceId)
        .single();

      if (error || !data) {
        console.error("Error fetching post:", error);
        setIsLoading(false);
        return;
      }

      const accountData = data.workspace_threads_accounts as unknown as {
        id: string;
        username: string;
        profile_pic_url: string | null;
      };

      // 提取標籤
      type TagRelation = {
        workspace_threads_account_tags: {
          id: string;
          name: string;
          color: string;
        } | null;
      };
      const tagRelations = data.workspace_threads_post_tags as unknown as TagRelation[] | null;
      const tags: PostTag[] = (tagRelations || [])
        .map(rel => rel.workspace_threads_account_tags)
        .filter((tag): tag is NonNullable<typeof tag> => tag !== null)
        .map(tag => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
        }));

      setPost({
        ...data,
        tags,
        account: {
          id: accountData.id,
          username: accountData.username,
          profile_pic_url: accountData.profile_pic_url,
        },
      });
      setIsLoading(false);
    }

    fetchPost();
  }, [postId]);

  // 取得歷史成效資料
  useEffect(() => {
    async function fetchMetrics() {
      if (!post) return;

      const supabase = createClient();
      const sinceDate = getSinceDate(timeRange);

      const { data, error } = await supabase
        .from("workspace_threads_post_metrics")
        .select("captured_at, views, likes, replies, reposts, quotes, engagement_rate, reply_rate, repost_rate, quote_rate, virality_score")
        .eq("workspace_threads_post_id", postId)
        .gte("captured_at", sinceDate)
        .order("captured_at", { ascending: true });

      if (error) {
        console.error("Error fetching metrics:", error);
        return;
      }

      setMetrics(data || []);
    }

    fetchMetrics();
  }, [post, postId, timeRange]);

  // 取得帳號平均值
  useEffect(() => {
    async function fetchAccountAverage() {
      if (!post?.account.id) return;

      const supabase = createClient();
      const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("workspace_threads_posts")
        .select("current_views, current_likes, current_replies, current_reposts, current_quotes, engagement_rate, reply_rate, repost_rate, quote_rate, virality_score")
        .eq("workspace_threads_account_id", post.account.id)
        .gte("published_at", last30Days);

      if (error || !data || data.length === 0) {
        console.error("Error fetching account average:", error);
        return;
      }

      const count = data.length;
      setAccountAverage({
        avgViews: data.reduce((sum, p) => sum + (p.current_views || 0), 0) / count,
        avgLikes: data.reduce((sum, p) => sum + (p.current_likes || 0), 0) / count,
        avgReplies: data.reduce((sum, p) => sum + (p.current_replies || 0), 0) / count,
        avgReposts: data.reduce((sum, p) => sum + (p.current_reposts || 0), 0) / count,
        avgQuotes: data.reduce((sum, p) => sum + (p.current_quotes || 0), 0) / count,
        avgEngagementRate: data.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / count,
        avgReplyRate: data.reduce((sum, p) => sum + (p.reply_rate || 0), 0) / count,
        avgRepostRate: data.reduce((sum, p) => sum + (p.repost_rate || 0), 0) / count,
        avgQuoteRate: data.reduce((sum, p) => sum + (p.quote_rate || 0), 0) / count,
        avgViralityScore: data.reduce((sum, p) => sum + (p.virality_score || 0), 0) / count,
        postCount: count,
      });
    }

    fetchAccountAverage();
  }, [post?.account.id]);

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 size-4" />
          返回
        </Button>
        <div className="flex h-64 items-center justify-center">
          <p className="text-muted-foreground">找不到此貼文</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 返回按鈕 */}
      <Button variant="ghost" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 size-4" />
        返回貼文列表
      </Button>

      {/* 貼文內容 */}
      <PostHeader
        post={post}
        accountTags={accountTags}
        onTagsChange={(tags) => setPost(prev => prev ? { ...prev, tags } : null)}
        onCreateTag={createTag}
      />

      {/* 時間範圍切換 */}
      <TimeRangeTabs value={timeRange} onValueChange={setTimeRange} />

      {/* 指標卡片 */}
      <PostMetricsCards post={post} accountAverage={accountAverage} />

      {/* 趨勢圖表 */}
      <PostMetricsChart
        metrics={metrics}
        accountAverage={accountAverage}
        timeRange={timeRange}
      />
    </div>
  );
}

function getSinceDate(timeRange: TimeRange): string {
  const now = new Date();
  switch (timeRange) {
    case "24h":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case "7d":
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "30d":
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    case "all":
      return new Date(0).toISOString();
    default:
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  }
}
