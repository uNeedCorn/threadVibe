"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Loader2, MessageCircle, ExternalLink, RefreshCw, Reply, CheckCircle2, AlertTriangle } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { ReplyForm } from "./reply-form";

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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 用於追蹤請求是否應該被忽略（元件卸載或 props 變化）
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(true);

  // 追蹤元件掛載狀態
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchReplies = useCallback(async () => {
    // 遞增請求 ID，用於忽略過時的響應
    const currentRequestId = ++requestIdRef.current;

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<{
        replies: ThreadsReply[];
        hasOwnerReply?: boolean;
      }>("threads-replies", {
        body: {
          account_id: accountId,
          post_id: threadsPostId,
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
      setReplies(repliesList);

      // 使用 API 回傳的 hasOwnerReply（已包含下鑽一層的檢查）
      onRepliesLoaded?.(repliesList.length, data.hasOwnerReply ?? false);
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
      }
    }
  }, [accountId, threadsPostId, onRepliesLoaded]);

  useEffect(() => {
    fetchReplies();
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

  // 統計負面留言數量
  const negativeCount = useMemo(() => {
    return replies.filter(r => detectNegativeSentiment(r.text)).length;
  }, [replies]);

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
          onClick={fetchReplies}
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
            回覆 ({replies.length})
          </h3>
          {negativeCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 dark:bg-orange-950/30 px-2 py-0.5 rounded-full">
              <AlertTriangle className="size-3" />
              {negativeCount} 則需關注
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchReplies}
          className="h-7 px-2"
        >
          <RefreshCw className="size-3" />
        </Button>
      </div>

      <div className="space-y-2">
        {sortedReplies.map((reply) => {
          const isActive = activeReplyId === reply.id;
          const isNegative = detectNegativeSentiment(reply.text);
          return (
            <div key={reply.id} className="space-y-2">
              <div
                className={`rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50 ${
                  isActive ? "border-primary/50 bg-primary/5" : ""
                } ${
                  isNegative ? "border-orange-300 dark:border-orange-700 bg-orange-50/50 dark:bg-orange-950/20" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">
                      {reply.username?.slice(0, 2).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">
                        @{reply.username || "unknown"}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        · {formatTime(reply.timestamp)}
                      </span>
                      {isNegative && (
                        <span className="flex items-center gap-0.5 text-xs text-orange-600">
                          <AlertTriangle className="size-3" />
                          需關注
                        </span>
                      )}
                      {reply.has_owner_reply && (
                        <span className="flex items-center gap-0.5 text-xs text-green-600">
                          <CheckCircle2 className="size-3" />
                          已回覆
                        </span>
                      )}
                      <div className="ml-auto flex items-center gap-1">
                        {onReplyToReply && reply.username && (
                          <Button
                            variant={isActive ? "secondary" : "ghost"}
                            size="sm"
                            className={`h-6 px-2 ${
                              isActive
                                ? "text-primary"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
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
                            className="text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="size-3" />
                          </a>
                        )}
                      </div>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">
                      {reply.text || "（無文字內容）"}
                    </p>
                    {reply.media_url && (
                      <div className="mt-2">
                        <img
                          src={reply.media_url}
                          alt=""
                          className="max-h-32 rounded-md object-cover"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {/* 回覆輸入框（在被選中的回覆下方顯示） */}
              {isActive && (
                <div className="ml-6 border-l-2 border-primary/30 pl-4">
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
            </div>
          );
        })}
      </div>
    </div>
  );
}
