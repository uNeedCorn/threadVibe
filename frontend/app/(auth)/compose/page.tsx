"use client";

import { useState, useEffect, useCallback, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  Hash,
  Link2,
  Loader2,
  Send,
  Clock,
  X,
  Tag,
  Check,
  ImageIcon,
  Sparkles,
  ChevronRight,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createClient } from "@/lib/supabase/client";
import { useAccountTags } from "@/hooks/use-account-tags";
import { useSelectedAccountContext } from "@/contexts/selected-account-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { MediaTypeSelector, type MediaType } from "@/components/compose/media-type-selector";
import { ComposeMediaSection } from "@/components/compose/compose-media-section";
import { ComposeScheduler } from "@/components/compose/compose-scheduler";
import { ComposeInsightsPanel } from "@/components/compose/compose-insights-panel";

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

  // 帳號 context
  const {
    selectedAccount: contextAccount,
    selectedAccountId,
    isLoading: isLoadingAccount,
  } = useSelectedAccountContext();

  // 轉換為本地格式
  const currentAccount: ThreadsAccount | null = contextAccount
    ? {
        id: contextAccount.id,
        username: contextAccount.username,
        profilePicUrl: contextAccount.profilePicUrl,
      }
    : null;

  // 追蹤上一個帳號 ID，用於偵測帳號切換
  const prevAccountIdRef = useRef<string | null>(null);

  // 帳號切換確認對話框
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);

  // 決策輔助面板狀態
  const [isInsightsPanelCollapsed, setIsInsightsPanelCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("composeInsightsPanelCollapsed") === "true";
    }
    return false;
  });

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

  // 目標日期排程貼文
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [scheduleDateLabel, setScheduleDateLabel] = useState<string>("今日");
  const [isLoadingScheduled, setIsLoadingScheduled] = useState(false);

  // 狀態
  const [isLoading, setIsLoading] = useState(false);

  // 檢查是否有未儲存的內容
  const hasUnsavedContent = useCallback(() => {
    return (
      text.trim().length > 0 ||
      mediaUrls.length > 0 ||
      topicTag.trim().length > 0 ||
      linkAttachment.trim().length > 0 ||
      selectedTagIds.length > 0
    );
  }, [text, mediaUrls, topicTag, linkAttachment, selectedTagIds]);

  // 重置表單
  const resetForm = useCallback(() => {
    setMediaType("TEXT");
    setText("");
    setMediaUrls([]);
    setTopicTag("");
    setLinkAttachment("");
    setScheduledAt(null);
    setSelectedTagIds([]);
  }, []);

  // 偵測帳號切換
  useEffect(() => {
    // 首次載入時只記錄帳號 ID
    if (prevAccountIdRef.current === null) {
      prevAccountIdRef.current = selectedAccountId;
      return;
    }

    // 帳號沒變，不做任何事
    if (selectedAccountId === prevAccountIdRef.current) {
      return;
    }

    // 帳號變了，檢查是否有未儲存內容
    if (hasUnsavedContent()) {
      // 有未儲存內容，顯示確認對話框
      setPendingAccountId(selectedAccountId);
      setShowSwitchConfirm(true);
    } else {
      // 沒有未儲存內容，直接切換
      prevAccountIdRef.current = selectedAccountId;
      resetForm();
    }
  }, [selectedAccountId, hasUnsavedContent, resetForm]);

  // 確認切換帳號
  const handleConfirmSwitch = useCallback(() => {
    prevAccountIdRef.current = pendingAccountId;
    resetForm();
    setShowSwitchConfirm(false);
    setPendingAccountId(null);
    toast.success("已切換帳號，編輯內容已清除");
  }, [pendingAccountId, resetForm]);

  // 取消切換帳號（需要還原到之前的帳號）
  const handleCancelSwitch = useCallback(() => {
    // 還原到之前的帳號
    if (prevAccountIdRef.current) {
      localStorage.setItem("currentThreadsAccountId", prevAccountIdRef.current);
      // 觸發頁面重新整理來還原 context 狀態
      window.location.reload();
    }
    setShowSwitchConfirm(false);
    setPendingAccountId(null);
  }, []);

  // 保存決策輔助面板狀態
  useEffect(() => {
    localStorage.setItem(
      "composeInsightsPanelCollapsed",
      String(isInsightsPanelCollapsed)
    );
  }, [isInsightsPanelCollapsed]);

  // 從 URL 參數初始化內容
  useEffect(() => {
    const textParam = searchParams.get("text");
    const topicParam = searchParams.get("topic");
    const tagsParam = searchParams.get("tags");

    if (textParam) setText(textParam);
    if (topicParam) setTopicTag(topicParam);
    if (tagsParam) setSelectedTagIds(tagsParam.split(",").filter(Boolean));
  }, [searchParams]);

  // 計算目標日期與標籤
  const getTargetDateInfo = useCallback(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    if (!scheduledAt) {
      return { date: today, label: "今日" };
    }

    const scheduledDate = new Date(scheduledAt);
    const scheduledDay = new Date(
      scheduledDate.getFullYear(),
      scheduledDate.getMonth(),
      scheduledDate.getDate()
    );

    if (scheduledDay.getTime() === today.getTime()) {
      return { date: scheduledDay, label: "今日" };
    } else if (scheduledDay.getTime() === tomorrow.getTime()) {
      return { date: scheduledDay, label: "明日" };
    } else {
      const label = `${scheduledDay.getMonth() + 1}/${scheduledDay.getDate()}`;
      return { date: scheduledDay, label };
    }
  }, [scheduledAt]);

  // 載入目標日期排程貼文
  useEffect(() => {
    if (!currentAccount) {
      setScheduledPosts([]);
      return;
    }

    const accountId = currentAccount.id;
    const { date: targetDate, label } = getTargetDateInfo();
    setScheduleDateLabel(label);

    async function fetchScheduledPosts() {
      setIsLoadingScheduled(true);
      const supabase = createClient();
      const startOfDay = targetDate.toISOString();
      const endOfDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const { data } = await supabase
        .from("workspace_threads_outbound_posts")
        .select("id, text, scheduled_at, publish_status")
        .eq("workspace_threads_account_id", accountId)
        .gte("scheduled_at", startOfDay)
        .lt("scheduled_at", endOfDay)
        .in("publish_status", ["scheduled", "publishing"])
        .order("scheduled_at", { ascending: true });

      if (data) setScheduledPosts(data);
      setIsLoadingScheduled(false);
    }

    fetchScheduledPosts();
  }, [currentAccount, getTargetDateInfo]);

  // 切換貼文類型時重置媒體
  const handleMediaTypeChange = useCallback((type: MediaType) => {
    setMediaType(type);
    setMediaUrls([]);
    if (type !== "TEXT") setLinkAttachment("");
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
    if (!currentAccount) return "請先選擇發文帳號";
    if (mediaType === "TEXT" && !text.trim()) return "請輸入貼文內容";
    if (text.length > TEXT_LIMIT) return `貼文內容超過 ${TEXT_LIMIT} 字元限制`;
    if ((mediaType === "IMAGE" || mediaType === "VIDEO") && mediaUrls.length !== 1)
      return "請提供一個媒體 URL";
    if (mediaType === "CAROUSEL" && mediaUrls.length < 2)
      return "輪播貼文至少需要 2 個媒體項目";
    if (topicTag && (topicTag.includes(".") || topicTag.includes("&")))
      return "主題標籤不能包含 . 或 &";

    if (mediaType === "TEXT" && text) {
      const urlRegex = /https?:\/\/[^\s]+/g;
      const urlsInText = text.match(urlRegex) || [];
      const uniqueUrls = new Set(urlsInText);
      if (linkAttachment && !uniqueUrls.has(linkAttachment)) uniqueUrls.add(linkAttachment);
      if (uniqueUrls.size > LINK_LIMIT) return `貼文最多只能包含 ${LINK_LIMIT} 個不重複連結`;
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

      if (fnError) throw new Error(fnError.message);
      if (!data?.success) throw new Error(data?.error || "發布失敗");

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
          action: data.permalink
            ? { label: "查看貼文", onClick: () => window.open(data.permalink, "_blank") }
            : undefined,
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
  const charPercentage = Math.min((charCount / TEXT_LIMIT) * 100, 100);

  const canPublish =
    currentAccount &&
    !isLoading &&
    ((mediaType === "TEXT" && text.trim()) ||
      (mediaType === "IMAGE" && mediaUrls.length === 1) ||
      (mediaType === "VIDEO" && mediaUrls.length === 1) ||
      (mediaType === "CAROUSEL" && mediaUrls.length >= 2));

  return (
    <div className="flex h-[calc(100vh-48px)] overflow-hidden">
      {/* 主要編輯區域 */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-8">
          {/* Header */}
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0" asChild>
                    <Link href="/posts">
                      <ArrowLeft className="size-5" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>返回貼文列表</TooltipContent>
              </Tooltip>

              <div>
                <h1 className="text-2xl font-bold tracking-tight">建立貼文</h1>
                <p className="text-sm text-muted-foreground">
                  撰寫內容並選擇發布時間
                </p>
              </div>
            </div>

            {/* 發布按鈕 */}
            <Button
              onClick={handlePublish}
              disabled={!canPublish}
              size="lg"
              className={cn(
                "gap-2 px-6 font-semibold transition-all",
                canPublish
                  ? "bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
                  : ""
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  {scheduledAt ? "排程中..." : "發布中..."}
                </>
              ) : scheduledAt ? (
                <>
                  <Clock className="size-4" />
                  排程發布
                </>
              ) : (
                <>
                  <Send className="size-4" />
                  立即發布
                </>
              )}
            </Button>
          </div>

          {/* 當前帳號卡片 */}
          <div className="mb-6">
            {isLoadingAccount ? (
              <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
                <div className="size-12 animate-pulse rounded-full bg-muted" />
                <div className="space-y-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-16 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ) : !currentAccount ? (
              <div className="rounded-xl border-2 border-dashed border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm text-destructive">
                  尚未選擇 Threads 帳號，請先在側邊欄選擇帳號
                </p>
              </div>
            ) : (
              <div className="flex items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
                <Avatar className="size-12 ring-2 ring-primary/20">
                  <AvatarImage src={currentAccount.profilePicUrl || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {currentAccount.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">@{currentAccount.username}</p>
                  <p className="text-sm text-muted-foreground">發文帳號</p>
                </div>
                <Badge variant="secondary" className="ml-auto">
                  <Check className="mr-1 size-3" />
                  已連接
                </Badge>
              </div>
            )}
          </div>

          {/* 編輯區域 */}
          <div className="space-y-6 rounded-2xl border bg-card p-6 shadow-sm">
            {/* 貼文內容 */}
            <div className="space-y-2">
              <div className="relative">
                <Textarea
                  id="text"
                  placeholder="想說些什麼？"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  className={cn(
                    "min-h-[160px] resize-none border-0 p-0 pb-8 text-base leading-relaxed transition-all",
                    "focus-visible:ring-0 focus-visible:ring-offset-0",
                    isOverLimit && "text-destructive"
                  )}
                  disabled={isLoading}
                />

                {/* 字數進度（文字框內右下角） */}
                <div className="absolute bottom-0 right-0 flex items-center gap-1.5">
                  <div className="relative size-5">
                    <svg className="size-5 -rotate-90" viewBox="0 0 36 36">
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        className="text-muted/30"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeDasharray={`${charPercentage * 0.88} 88`}
                        strokeLinecap="round"
                        className={cn(
                          "transition-all duration-300",
                          isOverLimit
                            ? "text-destructive"
                            : charCount > TEXT_LIMIT * 0.8
                            ? "text-warning"
                            : "text-primary"
                        )}
                      />
                    </svg>
                  </div>
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      isOverLimit
                        ? "text-destructive font-medium"
                        : charCount > TEXT_LIMIT * 0.8
                        ? "text-warning font-medium"
                        : "text-muted-foreground"
                    )}
                  >
                    剩餘 {TEXT_LIMIT - charCount}
                  </span>
                </div>
              </div>

              {/* 工具列：貼文類型 */}
              <div className="border-t pt-3">
                <MediaTypeSelector
                  value={mediaType}
                  onChange={handleMediaTypeChange}
                  disabled={isLoading}
                  compact
                />
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

            {/* 貼文標籤 */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5 text-sm font-medium">
                  <Tag className="size-3.5" />
                  貼文標籤
                  <span className="text-xs font-normal text-muted-foreground">
                    （選填，用於分類與成效分析）
                  </span>
                </Label>
                {selectedTagIds.length > 0 && (
                  <span className="text-xs text-primary font-medium">
                    已選 {selectedTagIds.length} 個
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Popover open={isTagPopoverOpen} onOpenChange={setIsTagPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 gap-2 border-dashed"
                      disabled={isLoading || isLoadingTags}
                    >
                      <Tag className="size-3.5" />
                      選擇標籤
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start">
                    <div className="space-y-1">
                      {accountTags.length === 0 ? (
                        <div className="py-6 text-center">
                          <Tag className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                          <p className="text-sm text-muted-foreground">尚無標籤</p>
                          <Button variant="link" size="sm" asChild className="mt-1">
                            <Link href="/tags">建立標籤</Link>
                          </Button>
                        </div>
                      ) : (
                        accountTags.map((tag) => (
                          <button
                            key={tag.id}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
                              "hover:bg-accent",
                              selectedTagIds.includes(tag.id) && "bg-accent"
                            )}
                            onClick={() => handleToggleTag(tag.id)}
                          >
                            <div
                              className="size-3.5 shrink-0 rounded-full ring-1 ring-inset ring-black/10"
                              style={{ backgroundColor: tag.color }}
                            />
                            <span className="flex-1 truncate text-left font-medium">
                              {tag.name}
                            </span>
                            {selectedTagIds.includes(tag.id) && (
                              <Check className="size-4 text-primary" />
                            )}
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* 已選標籤 */}
                {selectedTags.map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className="h-9 gap-1.5 pl-2.5 pr-2 font-medium"
                    style={{
                      backgroundColor: `${tag.color}15`,
                      color: tag.color,
                      borderColor: `${tag.color}30`,
                    }}
                  >
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                    <button
                      onClick={() => handleToggleTag(tag.id)}
                      className="ml-1 rounded-full p-0.5 hover:bg-black/10 transition-colors"
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}

                {/* 選擇標籤後的提示 */}
                {selectedTagIds.length > 0 && !isInsightsPanelCollapsed && (
                  <div className="flex items-center gap-1.5 text-xs text-primary">
                    <Sparkles className="size-3" />
                    <span>查看右側面板的成效參考</span>
                    <ChevronRight className="size-3" />
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* 主題標籤 */}
            <div className="space-y-3">
              <Label htmlFor="topic-tag" className="flex items-center gap-1.5 text-sm font-medium">
                <Hash className="size-3.5" />
                主題標籤
                <span className="text-xs font-normal text-muted-foreground">
                  （選填，Threads 原生標籤）
                </span>
              </Label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <span className="text-muted-foreground">#</span>
                </div>
                <Input
                  id="topic-tag"
                  placeholder="輸入主題標籤"
                  value={topicTag}
                  onChange={(e) => setTopicTag(e.target.value.replace(/^#/, ""))}
                  maxLength={TOPIC_TAG_LIMIT}
                  className="pl-7"
                  disabled={isLoading}
                />
                {topicTag && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 size-7"
                    onClick={() => setTopicTag("")}
                  >
                    <X className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* 連結附加（僅文字貼文） */}
            {mediaType === "TEXT" && (
              <div className="space-y-3">
                <Label htmlFor="link-attachment" className="flex items-center gap-1.5 text-sm font-medium">
                  <Link2 className="size-3.5" />
                  連結預覽
                  <span className="text-xs font-normal text-muted-foreground">
                    （選填）
                  </span>
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
                      className="absolute right-1 top-1/2 -translate-y-1/2 size-7"
                      onClick={() => setLinkAttachment("")}
                    >
                      <X className="size-3.5" />
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

            {/* 目標日期排程狀態 */}
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="mb-3 text-sm font-medium text-muted-foreground">
                {scheduleDateLabel}排程
                {scheduledPosts.length > 0 && `（${scheduledPosts.length} 篇）`}
              </p>
              {isLoadingScheduled ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              ) : scheduledPosts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-4 text-center">
                  <Clock className="size-6 text-muted-foreground/40 mb-2" />
                  <p className="text-xs text-muted-foreground">
                    {scheduleDateLabel}尚無排程貼文
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {scheduledPosts.map((post) => (
                    <div
                      key={post.id}
                      className="flex items-center gap-3 text-sm rounded-lg bg-background px-3 py-2"
                    >
                      <Clock className="size-4 shrink-0 text-muted-foreground" />
                      <span className="font-medium tabular-nums text-primary">
                        {new Date(post.scheduled_at).toLocaleTimeString("zh-TW", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="truncate flex-1 text-muted-foreground">
                        {post.text?.slice(0, 30) || "(無文字)"}
                        {post.text && post.text.length > 30 ? "..." : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 決策輔助面板 */}
      <ComposeInsightsPanel
        selectedTagIds={selectedTagIds}
        accountTags={accountTags}
        isCollapsed={isInsightsPanelCollapsed}
        onToggleCollapse={() => setIsInsightsPanelCollapsed(!isInsightsPanelCollapsed)}
      />

      {/* 帳號切換確認對話框 */}
      <AlertDialog open={showSwitchConfirm} onOpenChange={setShowSwitchConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-amber-500" />
              確認切換帳號？
            </AlertDialogTitle>
            <AlertDialogDescription>
              您目前有尚未發布的編輯內容。切換帳號後，這些內容將會被清除，且無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelSwitch}>
              取消切換
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmSwitch}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              確認切換
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function ComposePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[calc(100vh-48px)] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">載入中...</p>
          </div>
        </div>
      }
    >
      <ComposePageContent />
    </Suspense>
  );
}
