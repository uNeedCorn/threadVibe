"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Tag, TrendingUp, TrendingDown, Minus, ExternalLink, PanelRightOpen } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { createClient } from "@/lib/supabase/client";
import type { PostTag } from "@/components/posts";

interface TagComparisonProps {
  postId: string;
  accountId: string;
  postTags: PostTag[];
  currentMetrics: {
    views: number;
    likes: number;
    replies: number;
    reposts: number;
    quotes: number;
    engagement_rate: number;
  };
  onOpenPost?: (postId: string) => void;
}

interface TagPostData {
  id: string;
  text: string | null;
  permalink: string;
  published_at: string;
  current_views: number;
  current_likes: number;
  current_replies: number;
  current_reposts: number;
  current_quotes: number;
  engagement_rate: number;
}

interface TagData {
  tagId: string;
  tagName: string;
  tagColor: string;
  posts: TagPostData[];
  avgViews: number;
  avgLikes: number;
  avgReplies: number;
  avgReposts: number;
  avgQuotes: number;
  avgEngagementRate: number;
}

function ComparisonBadge({ current, average, label }: { current: number; average: number; label: string }) {
  if (average === 0) return null;

  const diff = ((current - average) / average) * 100;
  const isUp = diff > 5;
  const isDown = diff < -5;

  return (
    <div className="flex items-center gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`flex items-center gap-0.5 font-medium ${
        isUp ? "text-green-600" : isDown ? "text-orange-600" : "text-gray-500"
      }`}>
        {isUp ? <TrendingUp className="size-3" /> : isDown ? <TrendingDown className="size-3" /> : <Minus className="size-3" />}
        {isUp ? "+" : ""}{diff.toFixed(0)}%
      </span>
    </div>
  );
}

function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toLocaleString();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("zh-TW", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncateText(text: string | null, maxLength: number = 30): string {
  if (!text) return "（無文字內容）";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

function TagBlock({ tagData, currentMetrics, onOpenPost }: { tagData: TagData; currentMetrics: TagComparisonProps["currentMetrics"]; onOpenPost?: (postId: string) => void }) {
  const [isPostsOpen, setIsPostsOpen] = useState(false);

  return (
    <Collapsible open={isPostsOpen} onOpenChange={setIsPostsOpen}>
      <div className="rounded-lg border p-3 space-y-2">
        {/* 標題列：標籤名稱 + 展開按鈕 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="size-3 rounded-full"
              style={{ backgroundColor: tagData.tagColor }}
            />
            <span className="text-sm font-medium">{tagData.tagName}</span>
            <span className="text-xs text-muted-foreground">
              ({tagData.posts.length} 篇)
            </span>
          </div>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <ChevronDown className={`size-3 transition-transform ${isPostsOpen ? "rotate-180" : ""}`} />
              {isPostsOpen ? "收起" : "展開"}
            </button>
          </CollapsibleTrigger>
        </div>

        {/* 平均值比較 */}
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          <ComparisonBadge current={currentMetrics.views} average={tagData.avgViews} label="觀看" />
          <ComparisonBadge current={currentMetrics.likes} average={tagData.avgLikes} label="讚" />
          <ComparisonBadge current={currentMetrics.replies} average={tagData.avgReplies} label="回覆" />
          <ComparisonBadge current={currentMetrics.reposts} average={tagData.avgReposts} label="轉發" />
          <ComparisonBadge current={currentMetrics.quotes} average={tagData.avgQuotes} label="引用" />
          <ComparisonBadge current={currentMetrics.engagement_rate} average={tagData.avgEngagementRate} label="互動率" />
        </div>

        {/* 貼文列表展開 */}
        <CollapsibleContent className="pt-1">
          <div className="space-y-2">
            {tagData.posts.map((post) => (
              <div
                key={post.id}
                className="rounded border bg-muted/30 p-2.5 flex items-center"
              >
                {/* 左側：貼文內容與時間（1/3 寬度） */}
                <div className="flex items-center gap-2 w-1/3 pr-3">
                  <a
                    href={post.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title="在 Threads 開啟"
                  >
                    <ExternalLink className="size-3" />
                  </a>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs truncate">{truncateText(post.text)}</p>
                    <p className="text-[10px] text-muted-foreground">{formatDate(post.published_at)}</p>
                  </div>
                  <button
                    onClick={() => onOpenPost?.(post.id)}
                    className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                    title="查看貼文詳情"
                  >
                    <PanelRightOpen className="size-4" />
                  </button>
                </div>

                {/* 右側：成效數字（2/3 寬度，均分） */}
                <div className="w-2/3 grid grid-cols-4">
                  <div className="text-center">
                    <p className="font-semibold text-sm">{formatNumber(post.current_views)}</p>
                    <p className="text-[10px] text-muted-foreground">觀看</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-sm">{formatNumber(post.current_likes)}</p>
                    <p className="text-[10px] text-muted-foreground">讚</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-sm">{formatNumber(post.current_replies)}</p>
                    <p className="text-[10px] text-muted-foreground">回覆</p>
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-sm">{formatNumber(post.current_reposts)}</p>
                    <p className="text-[10px] text-muted-foreground">轉發</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

export function TagComparison({ postId, accountId, postTags, currentMetrics, onOpenPost }: TagComparisonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tagDataList, setTagDataList] = useState<TagData[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function fetchTagData() {
      if (postTags.length === 0) return;
      setIsLoading(true);

      const supabase = createClient();
      const dataList: TagData[] = [];

      for (const tag of postTags) {
        // 查詢同標籤的所有貼文（排除當前貼文）
        const { data, error } = await supabase
          .from("workspace_threads_post_tags")
          .select(`
            post_id,
            workspace_threads_posts!inner (
              id,
              text,
              permalink,
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
          .eq("tag_id", tag.id)
          .neq("post_id", postId);

        if (error) {
          console.error("Error fetching tag posts:", error);
          continue;
        }

        if (!data || data.length === 0) continue;

        // 只計算同帳號的貼文
        type RawPostData = {
          id: string;
          text: string | null;
          permalink: string;
          published_at: string;
          current_views: number;
          current_likes: number;
          current_replies: number;
          current_reposts: number;
          current_quotes: number;
          engagement_rate: number;
          workspace_threads_account_id: string;
        };

        const posts = data
          .map(d => d.workspace_threads_posts as unknown as RawPostData)
          .filter(p => p.workspace_threads_account_id === accountId)
          .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime());

        if (posts.length === 0) continue;

        const count = posts.length;
        dataList.push({
          tagId: tag.id,
          tagName: tag.name,
          tagColor: tag.color,
          posts: posts.map(p => ({
            id: p.id,
            text: p.text,
            permalink: p.permalink,
            published_at: p.published_at,
            current_views: p.current_views,
            current_likes: p.current_likes,
            current_replies: p.current_replies,
            current_reposts: p.current_reposts,
            current_quotes: p.current_quotes,
            engagement_rate: p.engagement_rate,
          })),
          avgViews: posts.reduce((sum, p) => sum + (p.current_views || 0), 0) / count,
          avgLikes: posts.reduce((sum, p) => sum + (p.current_likes || 0), 0) / count,
          avgReplies: posts.reduce((sum, p) => sum + (p.current_replies || 0), 0) / count,
          avgReposts: posts.reduce((sum, p) => sum + (p.current_reposts || 0), 0) / count,
          avgQuotes: posts.reduce((sum, p) => sum + (p.current_quotes || 0), 0) / count,
          avgEngagementRate: posts.reduce((sum, p) => sum + (p.engagement_rate || 0), 0) / count,
        });
      }

      setTagDataList(dataList);
      setIsLoading(false);
    }

    if (isOpen && tagDataList.length === 0) {
      fetchTagData();
    }
  }, [isOpen, postId, accountId, postTags, tagDataList.length]);

  if (postTags.length === 0) return null;

  return (
    <Card>
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              <Tag className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">同標籤貼文比較</span>
              <Badge variant="outline" className="text-xs">
                {postTags.length} 個標籤
              </Badge>
            </div>
            <ChevronDown className={`size-4 text-muted-foreground transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4">
            {isLoading ? (
              <div className="text-sm text-muted-foreground py-2">載入中...</div>
            ) : tagDataList.length === 0 ? (
              <div className="text-sm text-muted-foreground py-2">
                目前沒有其他貼文使用相同標籤，無法進行比較
              </div>
            ) : (
              <div className="space-y-3">
                {tagDataList.map((tagData) => (
                  <TagBlock
                    key={tagData.tagId}
                    tagData={tagData}
                    currentMetrics={currentMetrics}
                    onOpenPost={onOpenPost}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
