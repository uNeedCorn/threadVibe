"use client";

import { ArrowUpDown, ArrowUp, ArrowDown, FileText, PanelRightOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sparkline } from "@/components/ui/sparkline";

export interface PostTrend {
  views: number[];
  likes: number[];
  replies: number[];
  reposts: number[];
  quotes: number[];
  engagement_rate: number[];
  reply_rate: number[];
  repost_rate: number[];
  quote_rate: number[];
  virality_score: number[];
}

export interface PostTag {
  id: string;
  name: string;
  color: string;
}

export interface AiTagResult {
  tag: string;
  confidence: number;
}

export interface AiSuggestedTags {
  content_type?: AiTagResult[];
  tone?: AiTagResult[];
  intent?: AiTagResult[];
  emotion?: AiTagResult[];
  audience?: AiTagResult[];
}

export interface AiSelectedTags {
  content_type?: string[];
  tone?: string[];
  intent?: string[];
  emotion?: string[];
  audience?: string[];
}

export interface Post {
  id: string;
  text: string | null;
  media_type: "TEXT_POST" | "IMAGE" | "VIDEO" | "CAROUSEL_ALBUM";
  media_url: string | null;
  thumbnail_url: string | null;
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
  metrics_updated_at: string | null;
  trend?: PostTrend;
  tags?: PostTag[];
  ai_suggested_tags?: AiSuggestedTags | null;
  ai_selected_tags?: AiSelectedTags | null;
  account: {
    id: string;
    username: string;
    profile_picture_url: string | null;
  };
}

export type SortField = "published_at" | "current_views" | "current_likes" | "current_replies" | "current_reposts" | "current_quotes" | "engagement_rate" | "reply_rate" | "repost_rate" | "quote_rate" | "virality_score";
export type SortOrder = "asc" | "desc";

import type { AccountTag } from "@/hooks/use-account-tags";
import { PostTagPopover } from "./post-tag-popover";
import { AiTagPopover } from "./ai-tag-popover";

interface PostsTableProps {
  posts: Post[];
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  isLoading?: boolean;
  accountTags?: AccountTag[];
  onCreateTag?: (name: string, color: string) => Promise<AccountTag | null>;
  onPostTagsChange?: (postId: string, tags: PostTag[]) => void;
  onAiTagSelect?: (postId: string, dimension: string, tag: string, selected: boolean) => void;
  onSelectPost?: (postId: string) => void;
}

export function PostsTable({
  posts,
  sortField,
  sortOrder,
  onSort,
  isLoading,
  accountTags = [],
  onCreateTag,
  onPostTagsChange,
  onAiTagSelect,
  onSelectPost,
}: PostsTableProps) {
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 size-4 opacity-50" />;
    }
    return sortOrder === "asc"
      ? <ArrowUp className="ml-1 size-4" />
      : <ArrowDown className="ml-1 size-4" />;
  };

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <Button
      variant="ghost"
      className="-ml-3 h-8 px-3 font-medium hover:bg-transparent"
      onClick={() => onSort(field)}
    >
      {children}
      {renderSortIcon(field)}
    </Button>
  );

  const getMediaTypeInfo = (type: Post["media_type"]) => {
    switch (type) {
      case "IMAGE":
        return { label: "圖片", color: "bg-blue-100 text-blue-700 border-blue-200" };
      case "VIDEO":
        return { label: "影片", color: "bg-purple-100 text-purple-700 border-purple-200" };
      case "CAROUSEL_ALBUM":
        return { label: "輪播", color: "bg-green-100 text-green-700 border-green-200" };
      default:
        return { label: "文字", color: "bg-gray-100 text-gray-700 border-gray-200" };
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const truncateText = (text: string | null, maxLength: number = 20) => {
    if (!text) return "（無文字）";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "剛剛";
    if (diffMins < 60) return `${diffMins} 分鐘前`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} 小時前`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} 天前`;
    return formatDate(dateStr);
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border overflow-x-auto">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[400px]">內容</TableHead>
              <TableHead className="w-[100px]">發布時間</TableHead>
              <TableHead className="w-[120px]">標籤</TableHead>
              <TableHead className="w-[220px]">AI 標籤</TableHead>
              <TableHead className="w-[80px] text-right">觀看</TableHead>
              <TableHead className="w-[80px] text-right">讚</TableHead>
              <TableHead className="w-[80px] text-right">回覆</TableHead>
              <TableHead className="w-[80px] text-right">轉發</TableHead>
              <TableHead className="w-[80px] text-right">引用</TableHead>
              <TableHead className="w-[70px] text-right">互動率</TableHead>
              <TableHead className="w-[70px] text-right">回覆率</TableHead>
              <TableHead className="w-[70px] text-right">轉發率</TableHead>
              <TableHead className="w-[70px] text-right">引用率</TableHead>
              <TableHead className="w-[70px] text-right">傳播力</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {Array.from({ length: 14 }).map((_, j) => (
                  <TableCell key={j}>
                    <div className="h-5 animate-pulse rounded bg-muted" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border py-16">
        <FileText className="size-12 text-muted-foreground" />
        <p className="mt-4 text-lg font-medium">沒有找到貼文</p>
        <p className="text-sm text-muted-foreground">調整篩選條件或連結 Threads 帳號</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border overflow-x-auto">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-[400px]">內容</TableHead>
            <TableHead className="w-[100px]">
              <SortableHeader field="published_at">發布時間</SortableHeader>
            </TableHead>
            <TableHead className="w-[120px]">標籤</TableHead>
            <TableHead className="w-[220px]">AI 標籤</TableHead>
            <TableHead className="w-[80px] text-right">
              <SortableHeader field="current_views">觀看</SortableHeader>
            </TableHead>
            <TableHead className="w-[80px] text-right">
              <SortableHeader field="current_likes">讚</SortableHeader>
            </TableHead>
            <TableHead className="w-[80px] text-right">
              <SortableHeader field="current_replies">回覆</SortableHeader>
            </TableHead>
            <TableHead className="w-[80px] text-right">
              <SortableHeader field="current_reposts">轉發</SortableHeader>
            </TableHead>
            <TableHead className="w-[80px] text-right">
              <SortableHeader field="current_quotes">引用</SortableHeader>
            </TableHead>
            <TableHead className="w-[70px] text-right">
              <SortableHeader field="engagement_rate">互動率</SortableHeader>
            </TableHead>
            <TableHead className="w-[70px] text-right">
              <SortableHeader field="reply_rate">回覆率</SortableHeader>
            </TableHead>
            <TableHead className="w-[70px] text-right">
              <SortableHeader field="repost_rate">轉發率</SortableHeader>
            </TableHead>
            <TableHead className="w-[70px] text-right">
              <SortableHeader field="quote_rate">引用率</SortableHeader>
            </TableHead>
            <TableHead className="w-[70px] text-right">
              <SortableHeader field="virality_score">傳播力</SortableHeader>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {posts.map((post) => (
            <TableRow
              key={post.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onSelectPost?.(post.id)}
            >
              <TableCell>
                <div className="flex items-center gap-2">
                  {/* 類型標籤 */}
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-[10px] px-1.5 py-0 ${getMediaTypeInfo(post.media_type).color}`}
                  >
                    {getMediaTypeInfo(post.media_type).label}
                  </Badge>
                  {/* 文字內容 */}
                  <p className="min-w-0 flex-1 line-clamp-1 text-sm">
                    {truncateText(post.text, 40)}
                  </p>
                  {/* 展開 Panel 按鈕 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectPost?.(post.id);
                    }}
                    className="shrink-0 mr-2 text-muted-foreground hover:text-foreground transition-colors"
                    title="查看貼文詳情"
                  >
                    <PanelRightOpen className="size-4" />
                  </button>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatRelativeTime(post.published_at)}
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <PostTagPopover
                  postId={post.id}
                  postTags={post.tags || []}
                  accountTags={accountTags}
                  onTagsChange={(tags) => onPostTagsChange?.(post.id, tags)}
                  onCreateTag={onCreateTag}
                />
              </TableCell>
              <TableCell onClick={(e) => e.stopPropagation()}>
                <AiTagPopover
                  postId={post.id}
                  aiSuggestedTags={post.ai_suggested_tags ?? null}
                  aiSelectedTags={post.ai_selected_tags}
                  onTagSelect={onAiTagSelect}
                />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {post.trend?.views && <Sparkline data={post.trend.views} />}
                  <span className="font-medium">{post.current_views.toLocaleString()}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {post.trend?.likes && <Sparkline data={post.trend.likes} />}
                  <span className="font-medium">{post.current_likes.toLocaleString()}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {post.trend?.replies && <Sparkline data={post.trend.replies} />}
                  <span className="font-medium">{post.current_replies.toLocaleString()}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {post.trend?.reposts && <Sparkline data={post.trend.reposts} />}
                  <span className="font-medium">{post.current_reposts.toLocaleString()}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {post.trend?.quotes && <Sparkline data={post.trend.quotes} />}
                  <span className="font-medium">{post.current_quotes.toLocaleString()}</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {post.trend?.engagement_rate && <Sparkline data={post.trend.engagement_rate} />}
                  <span className="font-medium">{post.engagement_rate.toFixed(2)}%</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {post.trend?.reply_rate && <Sparkline data={post.trend.reply_rate} />}
                  <span className="font-medium">{post.reply_rate.toFixed(2)}%</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {post.trend?.repost_rate && <Sparkline data={post.trend.repost_rate} />}
                  <span className="font-medium">{post.repost_rate.toFixed(2)}%</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {post.trend?.quote_rate && <Sparkline data={post.trend.quote_rate} />}
                  <span className="font-medium">{post.quote_rate.toFixed(2)}%</span>
                </div>
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-1">
                  {post.trend?.virality_score && <Sparkline data={post.trend.virality_score} />}
                  <span className="font-medium">{post.virality_score.toFixed(2)}</span>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
