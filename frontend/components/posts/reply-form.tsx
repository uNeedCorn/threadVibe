"use client";

import { useState, useCallback } from "react";
import { Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const THREADS_TEXT_LIMIT = 500;

interface ReplyFormProps {
  accountId: string;
  threadsPostId: string;
  replyToId?: string;
  replyToUsername?: string;
  onReplySuccess?: () => void;
  onCancelReplyTo?: () => void;
}

export function ReplyForm({
  accountId,
  threadsPostId,
  replyToId,
  replyToUsername,
  onReplySuccess,
  onCancelReplyTo,
}: ReplyFormProps) {
  // 決定實際要回覆的目標 ID（特定回覆 or 原始貼文）
  const actualReplyToId = replyToId || threadsPostId;
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const charCount = text.length;
  const isOverLimit = charCount > THREADS_TEXT_LIMIT;
  const isEmpty = text.trim().length === 0;

  const handleSubmit = useCallback(async () => {
    if (isEmpty || isOverLimit || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke<{
        success: boolean;
        reply: {
          id: string;
          text: string;
          username?: string;
          timestamp?: string;
          permalink?: string;
        };
      }>("threads-reply", {
        body: {
          account_id: accountId,
          reply_to_id: actualReplyToId,
          text: text.trim(),
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.success) {
        throw new Error("回覆發送失敗");
      }

      const successMsg = replyToUsername
        ? `已回覆 @${replyToUsername}`
        : "回覆已發送";

      toast.success(successMsg, {
        description: data.reply.permalink ? (
          <a
            href={data.reply.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            在 Threads 查看
          </a>
        ) : undefined,
      });

      setText("");
      onCancelReplyTo?.(); // 清除回覆對象
      onReplySuccess?.();
    } catch (err) {
      console.error("Send reply error:", err);
      toast.error("發送失敗", {
        description: err instanceof Error ? err.message : "請稍後再試",
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [accountId, actualReplyToId, replyToUsername, text, isEmpty, isOverLimit, isSubmitting, onReplySuccess, onCancelReplyTo]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="space-y-2 rounded-lg border bg-card p-3">
      {/* 回覆對象提示 */}
      {replyToUsername && (
        <div className="flex items-center justify-between rounded bg-muted/50 px-2 py-1">
          <span className="text-xs text-muted-foreground">
            回覆 <span className="font-medium text-foreground">@{replyToUsername}</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
            onClick={onCancelReplyTo}
          >
            <X className="size-3" />
          </Button>
        </div>
      )}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={replyToUsername ? `回覆 @${replyToUsername}...` : "輸入回覆內容..."}
        className="min-h-[80px] resize-none border-0 p-0 shadow-none focus-visible:ring-0"
        disabled={isSubmitting}
      />
      <div className="flex items-center justify-between">
        <span
          className={`text-xs ${
            isOverLimit ? "text-destructive" : "text-muted-foreground"
          }`}
        >
          {charCount}/{THREADS_TEXT_LIMIT}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            ⌘+Enter 發送
          </span>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isEmpty || isOverLimit || isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                發送中...
              </>
            ) : (
              <>
                <Send className="mr-2 size-4" />
                發送回覆
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
