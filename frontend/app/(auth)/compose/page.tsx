"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Hash, Link2, Loader2, Send, Clock, X } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { MediaTypeSelector, type MediaType } from "@/components/compose/media-type-selector";
import { ComposeMediaSection } from "@/components/compose/compose-media-section";
import { ComposeScheduler } from "@/components/compose/compose-scheduler";

const TEXT_LIMIT = 500;
const TOPIC_TAG_LIMIT = 50;
const LINK_LIMIT = 5;

interface ThreadsAccount {
  id: string;
  username: string;
  profilePicUrl: string | null;
}

function ComposePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // 當前帳號
  const [currentAccount, setCurrentAccount] = useState<ThreadsAccount | null>(null);
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);

  // 貼文內容
  const [mediaType, setMediaType] = useState<MediaType>("TEXT");
  const [text, setText] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [topicTag, setTopicTag] = useState("");
  const [linkAttachment, setLinkAttachment] = useState("");
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);

  // 狀態
  const [isLoading, setIsLoading] = useState(false);

  // 從 URL 參數初始化內容（從快速發文傳遞過來）
  useEffect(() => {
    const textParam = searchParams.get("text");
    const topicParam = searchParams.get("topic");

    if (textParam) {
      setText(textParam);
    }
    if (topicParam) {
      setTopicTag(topicParam);
    }
  }, [searchParams]);

  // 載入當前帳號
  useEffect(() => {
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
  }, []);

  // 切換貼文類型時重置媒體
  const handleMediaTypeChange = useCallback((type: MediaType) => {
    setMediaType(type);
    setMediaUrls([]);
    // 連結附加只支援文字貼文
    if (type !== "TEXT") {
      setLinkAttachment("");
    }
  }, []);

  // 驗證表單
  const validateForm = (): string | null => {
    if (!currentAccount) {
      return "請先選擇發文帳號";
    }

    if (mediaType === "TEXT" && !text.trim()) {
      return "請輸入貼文內容";
    }

    if (text.length > TEXT_LIMIT) {
      return `貼文內容超過 ${TEXT_LIMIT} 字元限制`;
    }

    if ((mediaType === "IMAGE" || mediaType === "VIDEO") && mediaUrls.length !== 1) {
      return "請提供一個媒體 URL";
    }

    if (mediaType === "CAROUSEL" && mediaUrls.length < 2) {
      return "輪播貼文至少需要 2 個媒體項目";
    }

    if (topicTag && (topicTag.includes(".") || topicTag.includes("&"))) {
      return "主題標籤不能包含 . 或 &";
    }

    // 檢查連結數量
    if (mediaType === "TEXT" && text) {
      const urlRegex = /https?:\/\/[^\s]+/g;
      const urlsInText = text.match(urlRegex) || [];
      const uniqueUrls = new Set(urlsInText);
      if (linkAttachment && !uniqueUrls.has(linkAttachment)) {
        uniqueUrls.add(linkAttachment);
      }
      if (uniqueUrls.size > LINK_LIMIT) {
        return `貼文最多只能包含 ${LINK_LIMIT} 個不重複連結`;
      }
    }

    return null;
  };

  // 發布貼文
  const handlePublish = async () => {
    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createClient();
      const { data, error: fnError } = await supabase.functions.invoke("threads-compose", {
        body: {
          account_id: currentAccount!.id,
          text: text.trim() || undefined,
          media_type: mediaType,
          media_urls: mediaUrls.length > 0 ? mediaUrls : undefined,
          topic_tag: topicTag.trim() || undefined,
          link_attachment: linkAttachment.trim() || undefined,
          scheduled_at: scheduledAt || undefined,
        },
      });

      if (fnError) {
        throw new Error(fnError.message);
      }

      if (!data?.success) {
        throw new Error(data?.error || "發布失敗");
      }

      if (scheduledAt) {
        toast.success("貼文已排程！", {
          description: `將於 ${new Date(scheduledAt).toLocaleString("zh-TW")} 發布`,
        });
      } else {
        toast.success("貼文已發布！", {
          description: "貼文已成功發布到 Threads",
          action: data.permalink ? {
            label: "查看貼文",
            onClick: () => window.open(data.permalink, "_blank"),
          } : undefined,
        });
      }

      router.push("/posts");
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

  const canPublish =
    currentAccount &&
    !isLoading &&
    ((mediaType === "TEXT" && text.trim()) ||
      (mediaType === "IMAGE" && mediaUrls.length === 1) ||
      (mediaType === "VIDEO" && mediaUrls.length === 1) ||
      (mediaType === "CAROUSEL" && mediaUrls.length >= 2));

  return (
    <div className="container max-w-2xl py-8">
      {/* 標題 */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/posts">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">建立貼文</h1>
            <p className="text-sm text-muted-foreground">
              發布新貼文到 Threads
            </p>
          </div>
        </div>
        <Button onClick={handlePublish} disabled={!canPublish}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              {scheduledAt ? "排程中..." : "發布中..."}
            </>
          ) : (
            <>
              {scheduledAt ? (
                <>
                  <Clock className="mr-2 size-4" />
                  排程發布
                </>
              ) : (
                <>
                  <Send className="mr-2 size-4" />
                  立即發布
                </>
              )}
            </>
          )}
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>貼文內容</CardTitle>
          <CardDescription>
            設定貼文類型、內容和發布選項
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 當前帳號 */}
          {isLoadingAccount ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              載入帳號中...
            </div>
          ) : !currentAccount ? (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="text-sm text-destructive">
                尚未選擇 Threads 帳號，請先在側邊欄選擇帳號
              </p>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Avatar className="size-12">
                <AvatarImage src={currentAccount.profilePicUrl || undefined} />
                <AvatarFallback>
                  {currentAccount.username.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">@{currentAccount.username}</p>
                <p className="text-sm text-muted-foreground">發文帳號</p>
              </div>
            </div>
          )}

          <Separator />

          {/* 貼文類型 */}
          <div className="space-y-2">
            <Label>貼文類型</Label>
            <MediaTypeSelector
              value={mediaType}
              onChange={handleMediaTypeChange}
              disabled={isLoading}
            />
          </div>

          {/* 貼文內容 */}
          <div className="space-y-2">
            <Label htmlFor="text">
              貼文內容
              {mediaType !== "TEXT" && (
                <span className="ml-1 text-xs text-muted-foreground">（選填）</span>
              )}
            </Label>
            <Textarea
              id="text"
              placeholder="想說些什麼？"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="min-h-[150px] resize-none"
              disabled={isLoading}
            />
            <div className="flex justify-end">
              <span
                className={`text-xs ${
                  isOverLimit ? "text-destructive" : "text-muted-foreground"
                }`}
              >
                {charCount}/{TEXT_LIMIT}
              </span>
            </div>
          </div>

          {/* 媒體區域 */}
          <ComposeMediaSection
            mediaType={mediaType}
            mediaUrls={mediaUrls}
            onMediaUrlsChange={setMediaUrls}
            disabled={isLoading}
          />

          <Separator />

          {/* 主題標籤 */}
          <div className="space-y-2">
            <Label htmlFor="topic-tag" className="flex items-center gap-1">
              <Hash className="size-3" />
              主題標籤
              <span className="text-xs text-muted-foreground">（選填）</span>
            </Label>
            <div className="relative">
              <Input
                id="topic-tag"
                placeholder="輸入主題標籤（不含 #）"
                value={topicTag}
                onChange={(e) => setTopicTag(e.target.value.replace(/^#/, ""))}
                maxLength={TOPIC_TAG_LIMIT}
                disabled={isLoading}
              />
              {topicTag && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 size-6"
                  onClick={() => setTopicTag("")}
                >
                  <X className="size-3" />
                </Button>
              )}
            </div>
            {topicTag && (
              <p className="text-xs text-muted-foreground">預覽：#{topicTag}</p>
            )}
          </div>

          {/* 連結附加（僅文字貼文） */}
          {mediaType === "TEXT" && (
            <div className="space-y-2">
              <Label htmlFor="link-attachment" className="flex items-center gap-1">
                <Link2 className="size-3" />
                連結預覽
                <span className="text-xs text-muted-foreground">（選填）</span>
              </Label>
              <div className="relative">
                <Input
                  id="link-attachment"
                  placeholder="輸入要顯示預覽的連結 URL"
                  value={linkAttachment}
                  onChange={(e) => setLinkAttachment(e.target.value)}
                  disabled={isLoading}
                />
                {linkAttachment && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 size-6"
                    onClick={() => setLinkAttachment("")}
                  >
                    <X className="size-3" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                若不指定，將使用貼文內容中的第一個連結
              </p>
            </div>
          )}

          <Separator />

          {/* 排程 */}
          <ComposeScheduler
            scheduledAt={scheduledAt}
            onScheduledAtChange={setScheduledAt}
            disabled={isLoading}
          />
        </CardContent>
      </Card>
    </div>
  );
}

export default function ComposePage() {
  return (
    <Suspense fallback={
      <div className="container max-w-2xl py-8">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          載入中...
        </div>
      </div>
    }>
      <ComposePageContent />
    </Suspense>
  );
}
