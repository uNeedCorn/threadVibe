"use client";

import { useRouter } from "next/navigation";
import { ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Image as ImageIcon, Video, FileText, Images, Tag } from "lucide-react";
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

interface PostsTableProps {
  posts: Post[];
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  isLoading?: boolean;
  accountTags?: AccountTag[];
  onCreateTag?: (name: string, color: string) => Promise<AccountTag | null>;
  onPostTagsChange?: (postId: string, tags: PostTag[]) => void;
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
}: PostsTableProps) {
  const router = useRouter();

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

  const getMediaIcon = (type: Post["media_type"]) => {
    switch (type) {
      case "IMAGE":
        return <ImageIcon className="size-4 text-muted-foreground" />;
      case "VIDEO":
        return <Video className="size-4 text-muted-foreground" />;
      case "CAROUSEL_ALBUM":
        return <Images className="size-4 text-muted-foreground" />;
      default:
        return <FileText className="size-4 text-muted-foreground" />;
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
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">內容</TableHead>
              <TableHead className="w-[100px]">發布時間</TableHead>
              <TableHead className="w-[120px]">標籤</TableHead>
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
              <TableHead className="w-[100px]">更新時間</TableHead>
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
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[200px]">內容</TableHead>
            <TableHead className="w-[100px]">
              <SortableHeader field="published_at">發布時間</SortableHeader>
            </TableHead>
            <TableHead className="w-[120px]">標籤</TableHead>
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
            <TableHead className="w-[100px]">更新時間</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {posts.map((post) => (
            <TableRow key={post.id} className="hover:bg-muted/50">
              <TableCell>
                <div className="flex items-start gap-3">
                  {/* 媒體縮圖 */}
                  {post.thumbnail_url || post.media_url ? (
                    <div className="relative size-12 shrink-0 overflow-hidden rounded bg-muted">
                      <img
                        src={post.thumbnail_url || post.media_url || ""}
                        alt=""
                        className="size-full object-cover"
                      />
                      <div className="absolute bottom-0.5 right-0.5">
                        {getMediaIcon(post.media_type)}
                      </div>
                    </div>
                  ) : (
                    <div className="flex size-12 shrink-0 items-center justify-center rounded bg-muted">
                      {getMediaIcon(post.media_type)}
                    </div>
                  )}
                  {/* 文字內容 */}
                  <div className="min-w-0 flex-1">
                    <p
                      className="line-clamp-2 cursor-pointer text-sm hover:text-primary hover:underline"
                      onClick={() => router.push(`/posts/${post.id}`)}
                    >
                      {truncateText(post.text)}
                    </p>
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="size-3" />
                      開啟貼文
                    </a>
                  </div>
                </div>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {formatRelativeTime(post.published_at)}
              </TableCell>
              <TableCell>
                <PostTagPopover
                  postId={post.id}
                  postTags={post.tags || []}
                  accountTags={accountTags}
                  onTagsChange={(tags) => onPostTagsChange?.(post.id, tags)}
                  onCreateTag={onCreateTag}
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
              <TableCell className="text-sm text-muted-foreground">
                {formatRelativeTime(post.metrics_updated_at)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
