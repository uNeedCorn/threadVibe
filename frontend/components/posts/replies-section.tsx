"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Loader2, MessageCircle, ExternalLink, RefreshCw, Reply, CheckCircle2, AlertTriangle, ChevronDown, ChevronRight, Heart, Repeat, Quote, Eye, ArrowUpDown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { ReplyForm } from "./reply-form";
import { cn } from "@/lib/utils";

interface ReplyInsights {
  likes?: number;
  reposts?: number;
  quotes?: number;
  views?: number;
}

export interface ThreadsReply {
  id: string;
  text?: string;
  username?: string;
  timestamp?: string;
  media_type?: string;
  media_url?: string;
  permalink?: string;
  is_reply_owned_by_me?: boolean;
  has_owner_reply?: boolean;
  children: ThreadsReply[];
  depth: number;
  insights?: ReplyInsights;
}

// 負面情緒檢測關鍵詞
const NEGATIVE_KEYWORDS = [
  // 不滿/抱怨
  "差", "爛", "垃圾", "浪費", "討厭", "失望", "無聊", "騙", "假",
  // 客訴相關
  "退費", "退款", "投訴", "客訴", "檢舉", "舉報",
  // 強烈負面
  "廢", "噁", "爛透", "超爛", "很差", "太差", "有夠爛",
  // 質疑
  "騙人", "詐騙", "黑心", "坑",
];

/**
 * 檢測留言是否含有負面情緒
 */
function detectNegativeSentiment(text?: string): boolean {
  if (!text) return false;
  const lowerText = text.toLowerCase();
  return NEGATIVE_KEYWORDS.some(keyword => lowerText.includes(keyword));
}

/**
 * 遞迴計算負面留言數量
 */
function countNegativeReplies(replies: ThreadsReply[]): number {
  let count = 0;
  for (const reply of replies) {
    if (detectNegativeSentiment(reply.text)) {
      count++;
    }
    count += countNegativeReplies(reply.children);
  }
  return count;
}

interface RepliesSectionProps {
  accountId: string;
  postId: string;
  threadsPostId: string;
  onRepliesLoaded?: (count: number, hasOwnerReply: boolean) => void;
  refreshTrigger?: number;
  activeReplyId?: string;
  onReplyToReply?: (replyId: string, username: string) => void;
  onCancelReplyTo?: () => void;
  onReplySuccess?: () => void;
}

export function RepliesSection({
  accountId,
  postId,
  threadsPostId,
  onRepliesLoaded,
  refreshTrigger,
  activeReplyId,
  onReplyToReply,
  onCancelReplyTo,
  onReplySuccess,
}: RepliesSectionProps) {
  const [replies, setReplies] = useState<ThreadsReply[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');

  // 用於追蹤請求是否應該被忽略（元件卸載或 props 變化）
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);
  const sortOrderRef = useRef(sortOrder);

  // 同步 ref
  useEffect(() => {
    sortOrderRef.current = sortOrder;
  }, [sortOrder]);

  // 追蹤元件掛載狀態
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchReplies = useCallback(async (cursor?: string, append = false, order?: 'newest' | 'oldest') => {
    const effectiveOrder = order ?? sortOrderRef.current;
    // 遞增請求 ID，用於忽略過時的響應
    const currentRequestId = ++requestIdRef.current;

    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
      setNextCursor(null);
    }
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<{
        replies: ThreadsReply[];
        hasOwnerReply?: boolean;
        totalCount?: number;
        paging?: {
          cursors?: {
            after?: string;
          };
          next?: string;
        };
      }>("threads-replies", {
        body: {
          account_id: accountId,
          post_id: threadsPostId,
          cursor,
          limit: 50,
          reverse: effectiveOrder === 'newest', // newest = reverse true, oldest = reverse false
        },
      });

      // 檢查：如果元件已卸載或這不是最新的請求，忽略響應
      if (!isMountedRef.current || currentRequestId !== requestIdRef.current) {
        return;
      }

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data) {
        throw new Error("No data returned");
      }

      const repliesList = data.replies || [];
      const count = data.totalCount ?? repliesList.length;

      if (append) {
        // 合併新舊回覆（需要處理樹狀結構的合併）
        setReplies(prev => mergeReplyTrees(prev, repliesList));
        setTotalCount(prev => prev + count);
      } else {
        setReplies(repliesList);
        setTotalCount(count);
      }

      // 設置下一頁游標
      setNextCursor(data.paging?.cursors?.after || null);

      // 使用 API 回傳的 hasOwnerReply
      if (!append) {
        onRepliesLoaded?.(count, data.hasOwnerReply ?? false);
      }
    } catch (err) {
      // 檢查：如果元件已卸載或這不是最新的請求，忽略錯誤
      if (!isMountedRef.current || currentRequestId !== requestIdRef.current) {
        return;
      }
      console.error("Fetch replies error:", err);
      setError(err instanceof Error ? err.message : "載入回覆失敗");
    } finally {
      // 檢查：只有最新的請求才更新 loading 狀態
      if (isMountedRef.current && currentRequestId === requestIdRef.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  }, [accountId, threadsPostId, onRepliesLoaded]);

  // 合併回覆樹（簡單追加，因為 API 返回的是扁平化後重建的樹）
  const mergeReplyTrees = (existing: ThreadsReply[], newReplies: ThreadsReply[]): ThreadsReply[] => {
    const existingIds = new Set<string>();
    const collectIds = (replies: ThreadsReply[]) => {
      for (const reply of replies) {
        existingIds.add(reply.id);
        if (reply.children) collectIds(reply.children);
      }
    };
    collectIds(existing);

    // 過濾掉重複的回覆
    const filterNew = (replies: ThreadsReply[]): ThreadsReply[] => {
      return replies
        .filter(r => !existingIds.has(r.id))
        .map(r => ({
          ...r,
          children: r.children ? filterNew(r.children) : [],
        }));
    };

    return [...existing, ...filterNew(newReplies)];
  };

  const loadMore = useCallback(() => {
    if (nextCursor && !isLoadingMore) {
      fetchReplies(nextCursor, true);
    }
  }, [nextCursor, isLoadingMore, fetchReplies]);

  // 切換排序
  const toggleSortOrder = useCallback(() => {
    const newOrder = sortOrder === 'newest' ? 'oldest' : 'newest';
    setSortOrder(newOrder);
    // 重新載入回覆
    fetchReplies(undefined, false, newOrder);
  }, [sortOrder, fetchReplies]);

  useEffect(() => {
    fetchReplies(undefined, false);
  }, [fetchReplies, refreshTrigger]);

  const formatTime = (timestamp?: string) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return "剛剛";
    if (diffMins < 60) return `${diffMins} 分鐘前`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} 小時前`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays} 天前`;
    return date.toLocaleDateString("zh-TW");
  };

  // 排序留言：負面留言置頂（必須在所有條件式 return 之前）
  const sortedReplies = useMemo(() => {
    return [...replies].sort((a, b) => {
      const aIsNegative = detectNegativeSentiment(a.text);
      const bIsNegative = detectNegativeSentiment(b.text);
      if (aIsNegative && !bIsNegative) return -1;
      if (!aIsNegative && bIsNegative) return 1;
      return 0;
    });
  }, [replies]);

  // 統計負面留言數量（包含巢狀）
  const negativeCount = useMemo(() => {
    return countNegativeReplies(replies);
  }, [replies]);

  const toggleCollapse = useCallback((replyId: string) => {
    setCollapsedIds(prev => {
      const next = new Set(prev);
      if (next.has(replyId)) {
        next.delete(replyId);
      } else {
        next.add(replyId);
      }
      return next;
    });
  }, []);

  // 遞迴渲染回覆
  const renderReply = useCallback((reply: ThreadsReply) => {
    const isActive = activeReplyId === reply.id;
    const isNegative = detectNegativeSentiment(reply.text);
    const isOwner = reply.is_reply_owned_by_me === true;
    const hasChildren = reply.children && reply.children.length > 0;
    const isCollapsed = collapsedIds.has(reply.id);

    return (
      <div key={reply.id} className="relative">
        {/* 留言卡片 */}
        <div
          className={cn(
            "rounded-lg border p-3 transition-colors",
            isOwner && "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800",
            isNegative && !isOwner && "bg-orange-50/50 dark:bg-orange-950/20 border-orange-300 dark:border-orange-700",
            !isOwner && !isNegative && "bg-card hover:bg-muted/50",
            isActive && "ring-2 ring-primary ring-offset-2"
          )}
        >
          {/* 標題列：頭像 + 用戶名 + 標籤 + 操作 */}
          <div className="flex items-center gap-2">
            <Avatar className={cn(
              "size-6 shrink-0",
              isOwner && "ring-2 ring-blue-500"
            )}>
              <AvatarFallback className={cn(
                "text-[10px]",
                isOwner && "bg-blue-500 text-white"
              )}>
                {reply.username?.slice(0, 2).toUpperCase() || "?"}
              </AvatarFallback>
            </Avatar>

            <span className={cn(
              "text-sm font-medium",
              isOwner && "text-blue-700 dark:text-blue-300"
            )}>
              @{reply.username || "unknown"}
            </span>

            {isOwner && (
              <span className="text-[10px] font-medium bg-blue-500 text-white px-1.5 py-0.5 rounded">
                官方
              </span>
            )}

            <span className="text-xs text-muted-foreground">
              · {formatTime(reply.timestamp)}
            </span>

            {isNegative && (
              <span className="flex items-center gap-0.5 text-xs text-orange-600">
                <AlertTriangle className="size-3" />
                需關注
              </span>
            )}

            {!isOwner && reply.has_owner_reply && (
              <span className="flex items-center gap-0.5 text-xs text-green-600">
                <CheckCircle2 className="size-3" />
                已回覆
              </span>
            )}

            {/* 操作按鈕 */}
            <div className="ml-auto flex items-center gap-1">
              {hasChildren && (
                <button
                  onClick={() => toggleCollapse(reply.id)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-1.5 py-0.5 hover:bg-muted rounded"
                >
                  {isCollapsed ? (
                    <>
                      <ChevronRight className="size-3" />
                      <span>{reply.children.length}</span>
                    </>
                  ) : (
                    <ChevronDown className="size-3" />
                  )}
                </button>
              )}
              {onReplyToReply && reply.username && (
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className={cn(
                    "h-6 px-2",
                    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => {
                    if (isActive) {
                      onCancelReplyTo?.();
                    } else {
                      onReplyToReply(reply.id, reply.username!);
                    }
                  }}
                >
                  <Reply className="size-3" />
                </Button>
              )}
              {reply.permalink && (
                <a
                  href={reply.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground p-1"
                >
                  <ExternalLink className="size-3" />
                </a>
              )}
            </div>
          </div>

          {/* 內容（對齊左側） */}
          <p className="mt-2 whitespace-pre-wrap text-sm">
            {reply.text || "（無文字內容）"}
          </p>

          {/* 媒體 */}
          {reply.media_url && (
            <div className="mt-2">
              <img
                src={reply.media_url}
                alt=""
                className="max-h-32 rounded-md object-cover"
              />
            </div>
          )}

          {/* 經營者回覆的互動數據 */}
          {isOwner && reply.insights && (
            <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
              {reply.insights.views !== undefined && (
                <span className="flex items-center gap-1">
                  <Eye className="size-3" />
                  {reply.insights.views.toLocaleString()}
                </span>
              )}
              {reply.insights.likes !== undefined && (
                <span className="flex items-center gap-1">
                  <Heart className="size-3" />
                  {reply.insights.likes.toLocaleString()}
                </span>
              )}
              {reply.insights.reposts !== undefined && reply.insights.reposts > 0 && (
                <span className="flex items-center gap-1">
                  <Repeat className="size-3" />
                  {reply.insights.reposts.toLocaleString()}
                </span>
              )}
              {reply.insights.quotes !== undefined && reply.insights.quotes > 0 && (
                <span className="flex items-center gap-1">
                  <Quote className="size-3" />
                  {reply.insights.quotes.toLocaleString()}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 回覆輸入框 */}
        {isActive && (
          <div className="mt-2">
            <ReplyForm
              accountId={accountId}
              threadsPostId={threadsPostId}
              replyToId={reply.id}
              replyToUsername={reply.username}
              onReplySuccess={onReplySuccess}
              onCancelReplyTo={onCancelReplyTo}
            />
          </div>
        )}

        {/* 子回覆區塊 */}
        {hasChildren && !isCollapsed && (
          <div className="mt-2 ml-4 pl-3 border-l-2 border-muted-foreground/20 space-y-2">
            {reply.children.map(child => renderReply(child))}
          </div>
        )}
      </div>
    );
  }, [activeReplyId, collapsedIds, toggleCollapse, onReplyToReply, onCancelReplyTo, accountId, threadsPostId, onReplySuccess]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">載入回覆中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">{error}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-2"
          onClick={() => fetchReplies(undefined, false)}
        >
          <RefreshCw className="mr-2 size-4" />
          重試
        </Button>
      </div>
    );
  }

  if (replies.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
        <MessageCircle className="size-8" />
        <p className="mt-2 text-sm">還沒有回覆</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            回覆 ({totalCount})
          </h3>
          {negativeCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 dark:bg-orange-950/30 px-2 py-0.5 rounded-full">
              <AlertTriangle className="size-3" />
              {negativeCount} 則需關注
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* 排序切換 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleSortOrder}
            className="h-7 px-2 text-xs text-muted-foreground"
          >
            <ArrowUpDown className="size-3 mr-1" />
            {sortOrder === 'newest' ? '最新' : '最舊'}
          </Button>
          {/* 重新整理 */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchReplies(undefined, false)}
            className="h-7 px-2"
          >
            <RefreshCw className="size-3" />
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {sortedReplies.map(reply => renderReply(reply))}
      </div>

      {/* 載入更多按鈕 */}
      {nextCursor && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMore}
            disabled={isLoadingMore}
          >
            {isLoadingMore ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                載入中...
              </>
            ) : (
              "載入更多回覆"
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
