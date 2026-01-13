"use client";

import { useState, useCallback, useRef } from "react";
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
import type { ColumnConfig } from "@/hooks/use-column-config";

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
  columnConfig?: ColumnConfig[];
  onColumnResize?: (columnId: string, width: number) => void;
}

// 欄位寬度調整器組件
function ColumnResizer({
  columnId,
  onResize,
}: {
  columnId: string;
  onResize: (columnId: string, delta: number) => void;
}) {
  const startXRef = useRef(0);
  const isDraggingRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startXRef.current = e.clientX;
    isDraggingRef.current = true;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const delta = moveEvent.clientX - startXRef.current;
      if (Math.abs(delta) > 5) {
        onResize(columnId, delta);
        startXRef.current = moveEvent.clientX;
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      className="absolute right-0 top-0 h-full w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary"
      onMouseDown={handleMouseDown}
    />
  );
}

// 欄位 ID 到排序字段的映射
const COLUMN_TO_SORT_FIELD: Record<string, SortField | null> = {
  content: null,
  published_at: "published_at",
  tags: null,
  ai_tags: null,
  views: "current_views",
  likes: "current_likes",
  replies: "current_replies",
  reposts: "current_reposts",
  quotes: "current_quotes",
  engagement_rate: "engagement_rate",
  reply_rate: "reply_rate",
  repost_rate: "repost_rate",
  quote_rate: "quote_rate",
  virality_score: "virality_score",
};

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
  columnConfig,
  onColumnResize,
}: PostsTableProps) {
  // 本地寬度狀態（用於即時更新 UI）
  const [localWidths, setLocalWidths] = useState<Record<string, number>>({});

  // 處理欄位寬度調整
  const handleResize = useCallback((columnId: string, delta: number) => {
    const currentConfig = columnConfig?.find(c => c.id === columnId);
    const currentWidth = localWidths[columnId] ?? currentConfig?.width ?? 100;
    const newWidth = Math.max(50, currentWidth + delta);

    setLocalWidths(prev => ({ ...prev, [columnId]: newWidth }));
    onColumnResize?.(columnId, newWidth);
  }, [columnConfig, localWidths, onColumnResize]);

  // 取得欄位實際寬度
  const getColumnWidth = (column: ColumnConfig) => {
    return localWidths[column.id] ?? column.width;
  };
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

  const truncateText = (text: string | null, maxLength: number = 40) => {
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

  const formatRelativeTime = (dateStr: string | null): { text: string; isFullDate: boolean } => {
    if (!dateStr) return { text: "-", isFullDate: false };
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return { text: "剛剛", isFullDate: false };
    if (diffMins < 60) return { text: `${diffMins} 分鐘前`, isFullDate: false };
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return { text: `${diffHours} 小時前`, isFullDate: false };
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return { text: `${diffDays} 天前`, isFullDate: false };
    return { text: formatDate(dateStr), isFullDate: true };
  };

  const formatDateParts = (dateStr: string) => {
    const date = new Date(dateStr);
    const datePart = date.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const timePart = date.toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return { datePart, timePart };
  };

  // 取得可見欄位配置
  const visibleColumns = columnConfig
    ? columnConfig.filter(c => c.visible).sort((a, b) => a.order - b.order)
    : null;

  // 渲染表頭
  const renderHeader = (column: ColumnConfig) => {
    const width = getColumnWidth(column);
    const resizer = onColumnResize ? (
      <ColumnResizer columnId={column.id} onResize={handleResize} />
    ) : null;

    switch (column.id) {
      case "content":
        return (
          <TableHead key={column.id} style={{ width }} className="relative">
            內容
            {resizer}
          </TableHead>
        );
      case "published_at":
        return (
          <TableHead key={column.id} style={{ width }} className="relative">
            <SortableHeader field="published_at">發布時間</SortableHeader>
            {resizer}
          </TableHead>
        );
      case "tags":
        return (
          <TableHead key={column.id} style={{ width }} className="relative">
            標籤
            {resizer}
          </TableHead>
        );
      case "ai_tags":
        return (
          <TableHead key={column.id} style={{ width }} className="relative">
            AI 標籤
            {resizer}
          </TableHead>
        );
      case "views":
        return (
          <TableHead key={column.id} style={{ width }} className="text-right relative">
            <SortableHeader field="current_views">觀看</SortableHeader>
            {resizer}
          </TableHead>
        );
      case "likes":
        return (
          <TableHead key={column.id} style={{ width }} className="text-right relative">
            <SortableHeader field="current_likes">讚</SortableHeader>
            {resizer}
          </TableHead>
        );
      case "replies":
        return (
          <TableHead key={column.id} style={{ width }} className="text-right relative">
            <SortableHeader field="current_replies">回覆</SortableHeader>
            {resizer}
          </TableHead>
        );
      case "reposts":
        return (
          <TableHead key={column.id} style={{ width }} className="text-right relative">
            <SortableHeader field="current_reposts">轉發</SortableHeader>
            {resizer}
          </TableHead>
        );
      case "quotes":
        return (
          <TableHead key={column.id} style={{ width }} className="text-right relative">
            <SortableHeader field="current_quotes">引用</SortableHeader>
            {resizer}
          </TableHead>
        );
      case "engagement_rate":
        return (
          <TableHead key={column.id} style={{ width }} className="text-right relative">
            <SortableHeader field="engagement_rate">互動率</SortableHeader>
            {resizer}
          </TableHead>
        );
      case "reply_rate":
        return (
          <TableHead key={column.id} style={{ width }} className="text-right relative">
            <SortableHeader field="reply_rate">回覆率</SortableHeader>
            {resizer}
          </TableHead>
        );
      case "repost_rate":
        return (
          <TableHead key={column.id} style={{ width }} className="text-right relative">
            <SortableHeader field="repost_rate">轉發率</SortableHeader>
            {resizer}
          </TableHead>
        );
      case "quote_rate":
        return (
          <TableHead key={column.id} style={{ width }} className="text-right relative">
            <SortableHeader field="quote_rate">引用率</SortableHeader>
            {resizer}
          </TableHead>
        );
      case "virality_score":
        return (
          <TableHead key={column.id} style={{ width }} className="text-right relative">
            <SortableHeader field="virality_score">傳播力</SortableHeader>
            {resizer}
          </TableHead>
        );
      default:
        return null;
    }
  };

  // 渲染單元格
  const renderCell = (column: ColumnConfig, post: Post) => {
    switch (column.id) {
      case "content":
        return (
          <TableCell key={column.id}>
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className={`shrink-0 text-[10px] px-1.5 py-0 ${getMediaTypeInfo(post.media_type).color}`}
              >
                {getMediaTypeInfo(post.media_type).label}
              </Badge>
              <p className="min-w-0 flex-1 line-clamp-1 text-sm">
                {truncateText(post.text, 40)}
              </p>
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
        );
      case "published_at": {
        const timeInfo = formatRelativeTime(post.published_at);
        if (timeInfo.isFullDate) {
          const { datePart, timePart } = formatDateParts(post.published_at);
          return (
            <TableCell key={column.id} className="text-sm text-muted-foreground">
              <div className="flex flex-col">
                <span>{datePart}</span>
                <span className="text-xs">{timePart}</span>
              </div>
            </TableCell>
          );
        }
        return (
          <TableCell key={column.id} className="text-sm text-muted-foreground">
            {timeInfo.text}
          </TableCell>
        );
      }
      case "tags":
        return (
          <TableCell key={column.id} onClick={(e) => e.stopPropagation()}>
            <PostTagPopover
              postId={post.id}
              postTags={post.tags || []}
              accountTags={accountTags}
              onTagsChange={(tags) => onPostTagsChange?.(post.id, tags)}
              onCreateTag={onCreateTag}
            />
          </TableCell>
        );
      case "ai_tags":
        return (
          <TableCell key={column.id} onClick={(e) => e.stopPropagation()}>
            <AiTagPopover
              postId={post.id}
              aiSuggestedTags={post.ai_suggested_tags ?? null}
              aiSelectedTags={post.ai_selected_tags}
              onTagSelect={onAiTagSelect}
            />
          </TableCell>
        );
      case "views":
        return (
          <TableCell key={column.id} className="text-right">
            <div className="flex items-center justify-end gap-1">
              {post.trend?.views && <Sparkline data={post.trend.views} />}
              <span className="font-medium">{post.current_views.toLocaleString()}</span>
            </div>
          </TableCell>
        );
      case "likes":
        return (
          <TableCell key={column.id} className="text-right">
            <div className="flex items-center justify-end gap-1">
              {post.trend?.likes && <Sparkline data={post.trend.likes} />}
              <span className="font-medium">{post.current_likes.toLocaleString()}</span>
            </div>
          </TableCell>
        );
      case "replies":
        return (
          <TableCell key={column.id} className="text-right">
            <div className="flex items-center justify-end gap-1">
              {post.trend?.replies && <Sparkline data={post.trend.replies} />}
              <span className="font-medium">{post.current_replies.toLocaleString()}</span>
            </div>
          </TableCell>
        );
      case "reposts":
        return (
          <TableCell key={column.id} className="text-right">
            <div className="flex items-center justify-end gap-1">
              {post.trend?.reposts && <Sparkline data={post.trend.reposts} />}
              <span className="font-medium">{post.current_reposts.toLocaleString()}</span>
            </div>
          </TableCell>
        );
      case "quotes":
        return (
          <TableCell key={column.id} className="text-right">
            <div className="flex items-center justify-end gap-1">
              {post.trend?.quotes && <Sparkline data={post.trend.quotes} />}
              <span className="font-medium">{post.current_quotes.toLocaleString()}</span>
            </div>
          </TableCell>
        );
      case "engagement_rate":
        return (
          <TableCell key={column.id} className="text-right">
            <div className="flex items-center justify-end gap-1">
              {post.trend?.engagement_rate && <Sparkline data={post.trend.engagement_rate} />}
              <span className="font-medium">{post.engagement_rate.toFixed(2)}%</span>
            </div>
          </TableCell>
        );
      case "reply_rate":
        return (
          <TableCell key={column.id} className="text-right">
            <div className="flex items-center justify-end gap-1">
              {post.trend?.reply_rate && <Sparkline data={post.trend.reply_rate} />}
              <span className="font-medium">{post.reply_rate.toFixed(2)}%</span>
            </div>
          </TableCell>
        );
      case "repost_rate":
        return (
          <TableCell key={column.id} className="text-right">
            <div className="flex items-center justify-end gap-1">
              {post.trend?.repost_rate && <Sparkline data={post.trend.repost_rate} />}
              <span className="font-medium">{post.repost_rate.toFixed(2)}%</span>
            </div>
          </TableCell>
        );
      case "quote_rate":
        return (
          <TableCell key={column.id} className="text-right">
            <div className="flex items-center justify-end gap-1">
              {post.trend?.quote_rate && <Sparkline data={post.trend.quote_rate} />}
              <span className="font-medium">{post.quote_rate.toFixed(2)}%</span>
            </div>
          </TableCell>
        );
      case "virality_score":
        return (
          <TableCell key={column.id} className="text-right">
            <div className="flex items-center justify-end gap-1">
              {post.trend?.virality_score && <Sparkline data={post.trend.virality_score} />}
              <span className="font-medium">{post.virality_score.toFixed(2)}</span>
            </div>
          </TableCell>
        );
      default:
        return null;
    }
  };

  // 如果沒有欄位配置，使用預設配置
  const defaultColumns: ColumnConfig[] = [
    { id: "content", label: "內容", visible: true, width: 400, order: 0 },
    { id: "published_at", label: "發布時間", visible: true, width: 100, order: 1 },
    { id: "tags", label: "標籤", visible: true, width: 120, order: 2 },
    { id: "ai_tags", label: "AI 標籤", visible: true, width: 220, order: 3 },
    { id: "views", label: "觀看", visible: true, width: 80, order: 4 },
    { id: "likes", label: "讚", visible: true, width: 80, order: 5 },
    { id: "replies", label: "回覆", visible: true, width: 80, order: 6 },
    { id: "reposts", label: "轉發", visible: true, width: 80, order: 7 },
    { id: "quotes", label: "引用", visible: true, width: 80, order: 8 },
    { id: "engagement_rate", label: "互動率", visible: true, width: 70, order: 9 },
  ];

  const columnsToRender = visibleColumns || defaultColumns;

  if (isLoading) {
    return (
      <div className="rounded-lg border overflow-x-auto">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              {columnsToRender.map((col) => (
                <TableHead key={col.id} style={{ width: col.width }}>{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                {columnsToRender.map((_, j) => (
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
            {columnsToRender.map((col) => renderHeader(col))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {posts.map((post) => (
            <TableRow
              key={post.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => onSelectPost?.(post.id)}
            >
              {columnsToRender.map((col) => renderCell(col, post))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
