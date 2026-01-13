"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2, X, AtSign, Shield } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

const TEXT_LIMIT = 500;
const TOPIC_TAG_LIMIT = 50;

// TODO: 之後從用戶設定載入
const QUICK_TAGS = [
  "日常",
  "工作",
  "學習",
  "閱讀",
  "旅遊",
  "美食",
  "科技",
  "設計",
];

interface ThreadsAccount {
  id: string;
  username: string;
  profilePicUrl: string | null;
}

interface QuickComposeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickComposeSheet({ open, onOpenChange }: QuickComposeSheetProps) {
  const [currentAccount, setCurrentAccount] = useState<ThreadsAccount | null>(null);
  const [text, setText] = useState("");
  const [topicTag, setTopicTag] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);
  const [showTopicInput, setShowTopicInput] = useState(false);

  // 載入當前帳號
  useEffect(() => {
    if (!open) return;

    async function fetchCurrentAccount() {
      setIsLoadingAccount(true);
      const supabase = createClient();
      const accountId = localStorage.getItem("currentThreadsAccountId");

      if (!accountId) {
        setIsLoadingAccount(false);
        return;
      }

      const { data } = await supabase
        .from("workspace_threads_accounts")
        .select("id, username, profile_pic_url")
        .eq("id", accountId)
        .eq("is_active", true)
        .single();

      if (data) {
        setCurrentAccount({
          id: data.id,
          username: data.username,
          profilePicUrl: data.profile_pic_url,
        });
      }

      setIsLoadingAccount(false);
    }

    fetchCurrentAccount();
  }, [open]);

  // 重置表單
  const resetForm = useCallback(() => {
    setText("");
    setTopicTag("");
    setShowTopicInput(false);
  }, []);

  // 發布貼文
  const handlePublish = async () => {
    if (!currentAccount) {
      toast.error("請先選擇帳號");
      return;
    }

    if (!text.trim()) {
      toast.error("請輸入貼文內容");
      return;
    }

    if (text.length > TEXT_LIMIT) {
      toast.error(`貼文內容超過 ${TEXT_LIMIT} 字元限制`);
      return;
    }

    if (topicTag && (topicTag.includes(".") || topicTag.includes("&"))) {
      toast.error("主題標籤不能包含 . 或 &");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.functions.invoke("threads-compose", {
        body: {
          account_id: currentAccount.id,
          text: text.trim(),
          media_type: "TEXT",
          topic_tag: topicTag.trim() || undefined,
        },
      });

      if (error) {
        throw new Error(error.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || "發布失敗");
      }

      toast.success("貼文已發布！", {
        description: "貼文已成功發布到 Threads",
        action: data.permalink ? {
          label: "查看貼文",
          onClick: () => window.open(data.permalink, "_blank"),
        } : undefined,
      });

      resetForm();
      onOpenChange(false);
    } catch (err) {
      console.error("Publish error:", err);
      toast.error("發布失敗", {
        description: err instanceof Error ? err.message : "請稍後再試",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const charCount = text.length;
  const isOverLimit = charCount > TEXT_LIMIT;
  const canPublish = currentAccount && text.trim().length > 0 && !isOverLimit && !isLoading;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              取消
            </Button>
            <div className="flex items-center gap-1.5">
              <Shield className="size-4 text-orange-500" />
              <SheetTitle className="text-base font-semibold text-orange-600">新串文</SheetTitle>
            </div>
            <div className="w-[52px]" /> {/* 佔位，保持標題居中 */}
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoadingAccount ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : !currentAccount ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <AtSign className="size-12 text-muted-foreground/50 mb-3" />
              <p className="text-muted-foreground">尚未選擇 Threads 帳號</p>
              <p className="text-sm text-muted-foreground/70 mt-1">
                請在側邊欄選擇帳號後再發文
              </p>
            </div>
          ) : (
            <div className="flex gap-3 p-4">
              {/* Avatar 連接線 */}
              <div className="flex flex-col items-center">
                <Avatar className="size-10 ring-2 ring-background">
                  <AvatarImage src={currentAccount.profilePicUrl || undefined} />
                  <AvatarFallback className="text-sm font-medium">
                    {currentAccount.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="w-0.5 flex-1 bg-border mt-2 min-h-[40px]" />
              </div>

              {/* 內容區 */}
              <div className="flex-1 min-w-0">
                {/* 使用者名稱 + 主題標籤（同一行） */}
                <div className="flex items-center gap-1 mb-1">
                  <span className="font-semibold text-sm">{currentAccount.username}</span>
                  {showTopicInput ? (
                    <>
                      <span className="text-muted-foreground">›</span>
                      <Input
                        placeholder="新增主題"
                        value={topicTag}
                        onChange={(e) => setTopicTag(e.target.value.replace(/^#/, ""))}
                        maxLength={TOPIC_TAG_LIMIT}
                        disabled={isLoading}
                        className="border-0 bg-transparent p-0 h-auto text-sm text-muted-foreground focus-visible:ring-0 w-20 flex-shrink"
                        autoFocus
                        onBlur={() => {
                          if (!topicTag.trim()) setShowTopicInput(false);
                        }}
                      />
                      {topicTag && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-5 shrink-0"
                          onClick={() => {
                            setTopicTag("");
                            setShowTopicInput(false);
                          }}
                        >
                          <X className="size-3" />
                        </Button>
                      )}
                    </>
                  ) : topicTag ? (
                    <>
                      <span className="text-muted-foreground">›</span>
                      <span className="text-sm text-muted-foreground">{topicTag}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-5 shrink-0"
                        onClick={() => setTopicTag("")}
                      >
                        <X className="size-3" />
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowTopicInput(true)}
                      className="h-auto px-1 py-0 text-sm text-muted-foreground hover:text-foreground"
                      disabled={isLoading}
                    >
                      › 新增主題
                    </Button>
                  )}
                </div>

                <Textarea
                  placeholder="有什麼新鮮事？"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className="min-h-[100px] resize-none border-0 p-0 text-[15px] leading-relaxed placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0"
                  disabled={isLoading}
                  autoFocus
                />
              </div>
            </div>
          )}

          {/* 快速標籤 */}
          {currentAccount && !isLoadingAccount && (
            <div className="px-4 pb-4">
              <div className="flex flex-wrap gap-2">
                {QUICK_TAGS.map((tag) => (
                  <Button
                    key={tag}
                    variant={topicTag === tag ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs rounded-full"
                    onClick={() => setTopicTag(topicTag === tag ? "" : tag)}
                    disabled={isLoading}
                  >
                    #{tag}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {currentAccount && (
          <div className="border-t px-4 py-3">
            {/* 發布列 */}
            <div className="flex items-center justify-between">
              <span
                className={`text-xs tabular-nums ${
                  isOverLimit
                    ? "text-destructive font-medium"
                    : charCount > TEXT_LIMIT * 0.8
                    ? "text-amber-500"
                    : "text-muted-foreground"
                }`}
              >
                {charCount}/{TEXT_LIMIT}
              </span>
              <Button
                onClick={handlePublish}
                disabled={!canPublish || isLoadingAccount}
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                    發佈中
                  </>
                ) : (
                  "發佈"
                )}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
