"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Hash, Link2, Loader2, Send, Clock, X, Tag, Check } from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { createClient } from "@/lib/supabase/client";
import { useAccountTags } from "@/hooks/use-account-tags";
import { cn } from "@/lib/utils";
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

interface ScheduledPost {
  id: string;
  text: string | null;
  scheduled_at: string;
  publish_status: string;
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
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);

  // 帳號標籤
  const { tags: accountTags, isLoading: isLoadingTags } = useAccountTags();

  // 當天排程貼文
  const [todayScheduledPosts, setTodayScheduledPosts] = useState<ScheduledPost[]>([]);

  // 狀態
  const [isLoading, setIsLoading] = useState(false);

  // 從 URL 參數初始化內容（從快速發文傳遞過來）
  useEffect(() => {
    const textParam = searchParams.get("text");
    const topicParam = searchParams.get("topic");
    const tagsParam = searchParams.get("tags");

    if (textParam) {
      setText(textParam);
    }
    if (topicParam) {
      setTopicTag(topicParam);
    }
    if (tagsParam) {
      setSelectedTagIds(tagsParam.split(",").filter(Boolean));
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

  // 載入當天排程貼文
  useEffect(() => {
    if (!currentAccount) {
      setTodayScheduledPosts([]);
      return;
    }

    const accountId = currentAccount.id;

    async function fetchTodayScheduled() {
      const supabase = createClient();

      // 取得今天的開始和結束時間
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const { data } = await supabase
        .from("workspace_threads_outbound_posts")
        .select("id, text, scheduled_at, publish_status")
        .eq("workspace_threads_account_id", accountId)
        .gte("scheduled_at", startOfDay)
        .lt("scheduled_at", endOfDay)
        .in("publish_status", ["scheduled", "publishing"])
        .order("scheduled_at", { ascending: true });

      if (data) {
        setTodayScheduledPosts(data);
      }
    }

    fetchTodayScheduled();
  }, [currentAccount]);

  // 切換貼文類型時重置媒體
  const handleMediaTypeChange = useCallback((type: MediaType) => {
    setMediaType(type);
    setMediaUrls([]);
    // 連結附加只支援文字貼文
    if (type !== "TEXT") {
      setLinkAttachment("");
    }
  }, []);

  // 切換標籤
  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  // 取得已選標籤物件
  const selectedTags = accountTags.filter((t) => selectedTagIds.includes(t.id));

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

      // 發文成功後，關聯預選的帳號標籤
      if (selectedTagIds.length > 0 && data.post_id) {
        const tagInserts = selectedTagIds.map((tagId) => ({
          post_id: data.post_id,
          tag_id: tagId,
        }));
        await supabase.from("workspace_threads_post_tags").insert(tagInserts);
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
            <h1 className="text-2xl font-bold text-orange-600">建立貼文</h1>
            <p className="text-sm text-muted-foreground">
              發布新貼文到 Threads
            </p>
          </div>
        </div>
        <Button
          onClick={handlePublish}
          disabled={!canPublish}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
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
            <div className="relative">
              <Textarea
                id="text"
                placeholder="想說些什麼？"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="min-h-[150px] resize-none pr-16 pb-6"
                disabled={isLoading}
              />
              <span
                className={cn(
                  "absolute bottom-2 right-3 text-xs tabular-nums",
                  isOverLimit
                    ? "text-destructive font-medium"
                    : charCount > TEXT_LIMIT * 0.8
                    ? "text-amber-500"
                    : "text-muted-foreground"
                )}
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

          {/* 帳號標籤 */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1">
              <Tag className="size-3" />
              帳號標籤
              <span className="text-xs text-muted-foreground">（選填）</span>
            </Label>
            <div className="flex items-center gap-2 flex-wrap">
              <Popover open={isTagPopoverOpen} onOpenChange={setIsTagPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5"
                    disabled={isLoading || isLoadingTags}
                  >
                    <Tag className="size-3.5" />
                    選擇標籤
                    {selectedTags.length > 0 && (
                      <span className="ml-1 bg-primary/10 text-primary px-1.5 rounded-full text-xs">
                        {selectedTags.length}
                      </span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <div className="space-y-1">
                    {accountTags.length === 0 ? (
                      <p className="py-2 text-center text-sm text-muted-foreground">
                        尚無標籤
                      </p>
                    ) : (
                      accountTags.map((tag) => (
                        <button
                          key={tag.id}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                            selectedTagIds.includes(tag.id) && "bg-accent"
                          )}
                          onClick={() => handleToggleTag(tag.id)}
                        >
                          <div
                            className="size-3 shrink-0 rounded-full"
                            style={{ backgroundColor: tag.color }}
                          />
                          <span className="flex-1 truncate text-left">{tag.name}</span>
                          {selectedTagIds.includes(tag.id) && (
                            <Check className="size-4 text-primary" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              {/* 已選標籤顯示 */}
              {selectedTags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: tag.color }}
                >
                  {tag.name}
                  <button
                    onClick={() => handleToggleTag(tag.id)}
                    className="hover:bg-white/20 rounded-full p-0.5"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              選擇標籤以便日後分類管理貼文
            </p>
          </div>

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

          {/* 當天其他排程貼文 */}
          {todayScheduledPosts.length > 0 && (
            <div className="mt-4 pt-4 border-t border-dashed">
              <p className="text-sm font-medium text-muted-foreground mb-3">
                今日其他排程（{todayScheduledPosts.length} 篇）
              </p>
              <div className="space-y-2 max-h-32 overflow-y-auto">
                {todayScheduledPosts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center gap-3 text-sm text-muted-foreground bg-muted/30 rounded-lg px-3 py-2"
                  >
                    <Clock className="size-4 shrink-0" />
                    <span className="font-medium tabular-nums">
                      {new Date(post.scheduled_at).toLocaleTimeString("zh-TW", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="truncate flex-1">
                      {post.text?.slice(0, 30) || "(無文字)"}
                      {post.text && post.text.length > 30 ? "..." : ""}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
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
