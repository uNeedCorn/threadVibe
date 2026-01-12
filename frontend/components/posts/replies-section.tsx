"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, MessageCircle, ExternalLink, RefreshCw, Reply } from "lucide-react";
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
}

interface RepliesSectionProps {
  accountId: string;
  postId: string;
  threadsPostId: string;
  onRepliesLoaded?: (count: number) => void;
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

  const fetchReplies = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke<{
        replies: ThreadsReply[];
      }>("threads-replies", {
        body: {
          account_id: accountId,
          post_id: threadsPostId,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data) {
        throw new Error("No data returned");
      }

      setReplies(data.replies || []);
      onRepliesLoaded?.(data.replies?.length || 0);
    } catch (err) {
      console.error("Fetch replies error:", err);
      setError(err instanceof Error ? err.message : "載入回覆失敗");
    } finally {
      setIsLoading(false);
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
        <h3 className="text-sm font-medium text-muted-foreground">
          回覆 ({replies.length})
        </h3>
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
        {replies.map((reply) => {
          const isActive = activeReplyId === reply.id;
          return (
            <div key={reply.id} className="space-y-2">
              <div
                className={`rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50 ${
                  isActive ? "border-primary/50 bg-primary/5" : ""
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
