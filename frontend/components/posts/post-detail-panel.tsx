"use client";

import { useState, useEffect, useCallback } from "react";
import { ExternalLink, Loader2, ArrowUpRight, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { createClient } from "@/lib/supabase/client";
import { formatNumber } from "@/lib/insights-utils";
import { RepliesSection } from "./replies-section";
import { ReplyForm } from "./reply-form";
import { PostMetricsChart } from "./post-metrics-chart";
import type { Post, PostTag } from "./posts-table";
import type { AccountTag } from "@/hooks/use-account-tags";
import { PostTagPopover } from "./post-tag-popover";

interface PostDetailPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  postId: string | null;
  selectedAccountId: string | null;
  accountTags?: AccountTag[];
  onTagsChange?: (postId: string, tags: PostTag[]) => void;
  onCreateTag?: (name: string, color: string) => Promise<AccountTag | null>;
}

interface PostDetail {
  id: string;
  threads_post_id: string;
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
  tags: PostTag[];
  account: {
    id: string;
    username: string;
    profile_pic_url: string | null;
  };
}

export function PostDetailPanel({
  open,
  onOpenChange,
  postId,
  selectedAccountId,
  accountTags = [],
  onTagsChange,
  onCreateTag,
}: PostDetailPanelProps) {
  const [post, setPost] = useState<PostDetail | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [replyToId, setReplyToId] = useState<string | undefined>(undefined);
  const [replyToUsername, setReplyToUsername] = useState<string | undefined>(undefined);
  const [hasOwnerReply, setHasOwnerReply] = useState(false);

  // 載入貼文詳情
  const fetchPost = useCallback(async () => {
    if (!postId) return;

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("workspace_threads_posts")
        .select(`
          id,
          threads_post_id,
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
        .eq("id", postId)
        .single();

      if (error) {
        console.error("Fetch post error:", error);
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

      const accountData = data.workspace_threads_accounts as unknown as AccountData;
      const tagRelations = data.workspace_threads_post_tags as unknown as TagRelation[];

      const tags: PostTag[] = (tagRelations || [])
        .map(rel => rel.workspace_threads_account_tags)
        .filter((tag): tag is NonNullable<typeof tag> => tag !== null)
        .map(tag => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
        }));

      setPost({
        id: data.id,
        threads_post_id: data.threads_post_id,
        text: data.text,
        media_type: data.media_type,
        media_url: data.media_url,
        permalink: data.permalink,
        published_at: data.published_at,
        current_views: data.current_views || 0,
        current_likes: data.current_likes || 0,
        current_replies: data.current_replies || 0,
        current_reposts: data.current_reposts || 0,
        current_quotes: data.current_quotes || 0,
        engagement_rate: data.engagement_rate || 0,
        reply_rate: data.reply_rate || 0,
        tags,
        account: {
          id: accountData?.id || "",
          username: accountData?.username || "",
          profile_pic_url: accountData?.profile_pic_url || null,
        },
      });
    } catch (err) {
      console.error("Fetch post error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [postId]);

  useEffect(() => {
    if (open && postId) {
      // 先清除舊資料，避免回覆區塊使用過期的 accountId/threadsPostId
      setPost(null);
      setReplyToId(undefined);
      setReplyToUsername(undefined);
      setHasOwnerReply(false);
      // 再載入新資料
      fetchPost();
    } else if (!open) {
      // 面板關閉時清除資料
      setPost(null);
      setReplyToId(undefined);
      setReplyToUsername(undefined);
      setHasOwnerReply(false);
    }
  }, [open, postId, fetchPost]);

  // 回覆成功後刷新
  const handleReplySuccess = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
    // 也更新貼文回覆數
    if (post) {
      setPost(prev => prev ? {
        ...prev,
        current_replies: prev.current_replies + 1,
      } : null);
    }
  }, [post]);

  // 點擊回覆列表中的「回覆」按鈕
  const handleReplyToReply = useCallback((replyId: string, username: string) => {
    setReplyToId(replyId);
    setReplyToUsername(username);
  }, []);

  // 取消回覆特定對象（改回回覆原始貼文）
  const handleCancelReplyTo = useCallback(() => {
    setReplyToId(undefined);
    setReplyToUsername(undefined);
  }, []);

  // 標籤變更
  const handleTagsChange = useCallback((tags: PostTag[]) => {
    if (!post) return;
    setPost(prev => prev ? { ...prev, tags } : null);
    onTagsChange?.(post.id, tags);
  }, [post, onTagsChange]);

  // 回覆載入完成
  const handleRepliesLoaded = useCallback((_count: number, ownerReplied: boolean) => {
    setHasOwnerReply(ownerReplied);
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-[500px] p-0 flex flex-col"
      >
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="flex items-center gap-1">
            {postId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href={`/posts/${postId}`}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowUpRight className="size-4" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent>開啟詳細頁面</TooltipContent>
              </Tooltip>
            )}
            貼文詳情
          </SheetTitle>
          <SheetDescription className="sr-only">
            查看貼文詳情和回覆
          </SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : post ? (
          <ScrollArea className="flex-1">
            <div className="space-y-6 px-6 pt-4 pb-6">
              {/* 貼文內容 */}
              <div className="space-y-3">
                {/* 訊息框 */}
                <div className="rounded-xl border bg-muted/30 p-4">
                  {/* 頭像與用戶名 */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="size-8">
                        <AvatarImage src={post.account.profile_pic_url || undefined} />
                        <AvatarFallback className="text-xs">
                          {post.account.username.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">@{post.account.username}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(post.published_at)}</span>
                      </div>
                    </div>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-muted-foreground hover:text-foreground"
                          asChild
                        >
                          <a
                            href={post.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="size-4" />
                          </a>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>在 Threads 開啟</TooltipContent>
                    </Tooltip>
                  </div>
                  {/* 文字內容 */}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">
                    {post.text || "（無文字內容）"}
                  </p>
                </div>

                {/* 標籤與狀態 */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">標籤：</span>
                    <PostTagPopover
                      postId={post.id}
                      postTags={post.tags}
                      accountTags={accountTags}
                      onTagsChange={handleTagsChange}
                      onCreateTag={onCreateTag}
                    />
                  </div>
                  {hasOwnerReply && (
                    <Badge variant="secondary" className="gap-1 text-xs">
                      <CheckCircle2 className="size-3" />
                      已回覆
                    </Badge>
                  )}
                </div>
              </div>

              <Separator />

              {/* 成效數據 */}
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">成效數據</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-lg font-bold">{formatNumber(post.current_views)}</p>
                    <p className="text-xs text-muted-foreground">觀看</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-lg font-bold">{formatNumber(post.current_likes)}</p>
                    <p className="text-xs text-muted-foreground">讚</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-lg font-bold">{formatNumber(post.current_replies)}</p>
                    <p className="text-xs text-muted-foreground">回覆</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-lg font-bold">{formatNumber(post.current_reposts)}</p>
                    <p className="text-xs text-muted-foreground">轉發</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-lg font-bold">{formatNumber(post.current_quotes)}</p>
                    <p className="text-xs text-muted-foreground">引用</p>
                  </div>
                  <div className="rounded-lg border p-3 text-center">
                    <p className="text-lg font-bold">{post.engagement_rate.toFixed(2)}%</p>
                    <p className="text-xs text-muted-foreground">互動率</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* 成效趨勢圖表 */}
              <PostMetricsChart postId={post.id} publishedAt={post.published_at} />

              <Separator />

              {/* 回覆列表（只有當貼文所屬帳號與當前選擇帳號一致時才顯示，避免帳號切換時的競態條件） */}
              {post.account.id === selectedAccountId && (
                <RepliesSection
                  accountId={post.account.id}
                  postId={post.id}
                  threadsPostId={post.threads_post_id}
                  refreshTrigger={refreshTrigger}
                  activeReplyId={replyToId}
                  onRepliesLoaded={handleRepliesLoaded}
                  onReplyToReply={handleReplyToReply}
                  onCancelReplyTo={handleCancelReplyTo}
                  onReplySuccess={handleReplySuccess}
                />
              )}

              {/* 回覆輸入（僅在未選擇特定回覆對象時顯示，且帳號需匹配） */}
              {!replyToId && post.account.id === selectedAccountId && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground">
                      回覆此貼文
                    </h3>
                    <ReplyForm
                      accountId={post.account.id}
                      threadsPostId={post.threads_post_id}
                      onReplySuccess={handleReplySuccess}
                    />
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        ) : (
          <div className="flex flex-1 items-center justify-center text-muted-foreground">
            找不到貼文
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
