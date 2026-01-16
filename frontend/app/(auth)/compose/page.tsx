"use client";

import { useState, useEffect, useCallback, Suspense, useRef, useMemo } from "react";
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
  ChevronDown,
  AlertTriangle,
  Settings2,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { createClient } from "@/lib/supabase/client";
import { useAccountTags } from "@/hooks/use-account-tags";
import { useSelectedAccountContext } from "@/contexts/selected-account-context";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  MediaTypeSelector,
  type MediaType,
  ComposeMediaSection,
  ComposeInsightsPanel,
  ScheduleTimeline,
} from "@/components/compose";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 帳號 context
  const {
    selectedAccount: contextAccount,
    selectedAccountId,
    isLoading: isLoadingAccount,
  } = useSelectedAccountContext();

  // 轉換為本地格式（使用 useMemo 避免重複創建對象）
  const currentAccount: ThreadsAccount | null = useMemo(() => {
    if (!contextAccount) return null;
    return {
      id: contextAccount.id,
      username: contextAccount.username,
      profilePicUrl: contextAccount.profilePicUrl,
    };
  }, [contextAccount?.id, contextAccount?.username, contextAccount?.profilePicUrl]);

  // 追蹤上一個帳號 ID
  const prevAccountIdRef = useRef<string | null>(null);
  // 追蹤是否已完成初始 focus
  const hasInitialFocusRef = useRef(false);

  // 帳號切換確認
  const [showSwitchConfirm, setShowSwitchConfirm] = useState(false);
  const [pendingAccountId, setPendingAccountId] = useState<string | null>(null);

  // 決策輔助面板狀態
  const [isInsightsPanelCollapsed, setIsInsightsPanelCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("composeInsightsPanelCollapsed") === "true";
    }
    return false;
  });

  // 進階設定區塊狀態
  const [isSettingsOpen, setIsSettingsOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("composeSettingsOpen") !== "false";
    }
    return true;
  });

  // 貼文內容
  const [mediaType, setMediaType] = useState<MediaType>("TEXT");
  const [text, setText] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [topicTag, setTopicTag] = useState("");
  const [topicTagInput, setTopicTagInput] = useState(""); // 輸入中的主題標籤
  const [isEditingTopicTag, setIsEditingTopicTag] = useState(false); // 是否在編輯主題標籤
  const isComposingRef = useRef(false); // IME 輸入法狀態
  const [linkAttachment, setLinkAttachment] = useState("");
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);
  const [suggestedHour, setSuggestedHour] = useState<number>(20); // 預設 20:00

  // 帳號標籤
  const { tags: accountTags, isLoading: isLoadingTags } = useAccountTags();

  // 狀態
  const [isLoading, setIsLoading] = useState(false);

  // Auto-focus textarea on mount (只執行一次)
  useEffect(() => {
    if (
      textareaRef.current &&
      !isLoadingAccount &&
      currentAccount &&
      !hasInitialFocusRef.current
    ) {
      textareaRef.current.focus();
      hasInitialFocusRef.current = true;
    }
  }, [isLoadingAccount, currentAccount]);

  // 保存進階設定區塊狀態
  useEffect(() => {
    localStorage.setItem("composeSettingsOpen", String(isSettingsOpen));
  }, [isSettingsOpen]);

  // 檢查是否有未儲存的內容
  const hasUnsavedContent = useCallback(() => {
    return (
      text.trim().length > 0 ||
      mediaUrls.length > 0 ||
      topicTag.trim().length > 0 ||
      topicTagInput.trim().length > 0 ||
      linkAttachment.trim().length > 0 ||
      selectedTagIds.length > 0
    );
  }, [text, mediaUrls, topicTag, topicTagInput, linkAttachment, selectedTagIds]);

  // 重置表單
  const resetForm = useCallback(() => {
    setMediaType("TEXT");
    setText("");
    setMediaUrls([]);
    setTopicTag("");
    setTopicTagInput("");
    setIsEditingTopicTag(false);
    setLinkAttachment("");
    setScheduledAt(null);
    setSelectedTagIds([]);
  }, []);

  // 偵測帳號切換
  useEffect(() => {
    if (prevAccountIdRef.current === null) {
      prevAccountIdRef.current = selectedAccountId;
      return;
    }

    if (selectedAccountId === prevAccountIdRef.current) return;

    if (hasUnsavedContent()) {
      setPendingAccountId(selectedAccountId);
      setShowSwitchConfirm(true);
    } else {
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

  // 取消切換帳號
  const handleCancelSwitch = useCallback(() => {
    if (prevAccountIdRef.current) {
      localStorage.setItem("currentThreadsAccountId", prevAccountIdRef.current);
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

  // 從 URL 參數初始化
  useEffect(() => {
    const textParam = searchParams.get("text");
    const topicParam = searchParams.get("topic");
    const tagsParam = searchParams.get("tags");

    if (textParam) setText(textParam);
    if (topicParam) setTopicTag(topicParam);
    if (tagsParam) setSelectedTagIds(tagsParam.split(",").filter(Boolean));
  }, [searchParams]);

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

      // 重置表單
      resetForm();

      // 顯示成功訊息
      if (scheduledAt) {
        toast.success("貼文已排程！", {
          description: `將於 ${new Date(scheduledAt).toLocaleString("zh-TW")} 發布`,
          action: {
            label: "查看排程",
            onClick: () => router.push("/scheduled"),
          },
        });
      } else {
        toast.success("貼文已發布！", {
          description: "貼文已成功發布到 Threads",
          action: data.permalink
            ? { label: "查看貼文", onClick: () => window.open(data.permalink, "_blank") }
            : undefined,
        });
      }
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

  // 計算進階設定的填寫數量（用於顯示 badge）
  const settingsCount = [
    selectedTagIds.length > 0,
    topicTag.trim().length > 0,
    linkAttachment.trim().length > 0,
  ].filter(Boolean).length;

  return (
    <div className="flex h-[calc(100vh-var(--header-height))] overflow-hidden">
      {/* 主要編輯區域 */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-6 py-6">
          {/* Compact Header */}
          <div className="mb-6 flex items-center gap-4">
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

            <div className="flex-1">
              <h1 className="text-xl font-bold tracking-tight">建立貼文</h1>
            </div>

            {/* 帳號顯示（inline） */}
            {!isLoadingAccount && currentAccount && (
              <div className="flex items-center gap-2 rounded-full bg-muted/50 px-3 py-1.5">
                <Avatar className="size-6">
                  <AvatarImage src={currentAccount.profilePicUrl || undefined} />
                  <AvatarFallback className="text-xs">
                    {currentAccount.username.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">@{currentAccount.username}</span>
              </div>
            )}
          </div>

          {/* 無帳號警告 */}
          {!isLoadingAccount && !currentAccount && (
            <div className="mb-6 rounded-xl border-2 border-dashed border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm text-destructive">
                尚未選擇 Threads 帳號，請先在側邊欄選擇帳號
              </p>
            </div>
          )}

          {/* ===== 區塊 1：內容區（核心）===== */}
          <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            {/* 內容編輯 */}
            <div className="relative">
              <Textarea
                ref={textareaRef}
                placeholder="想說些什麼？"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className={cn(
                  "min-h-[140px] resize-none border-0 p-0 text-base leading-relaxed",
                  "focus-visible:ring-0 focus-visible:ring-offset-0",
                  "placeholder:text-muted-foreground/60",
                  isOverLimit && "text-destructive"
                )}
                disabled={isLoading || !currentAccount}
              />

              {/* 字數進度 */}
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
                  {TEXT_LIMIT - charCount}
                </span>
              </div>
            </div>

            {/* 工具列 */}
            <div className="flex items-center gap-2 border-t pt-3">
              <MediaTypeSelector
                value={mediaType}
                onChange={handleMediaTypeChange}
                disabled={isLoading || !currentAccount}
                compact
              />

              {/* 快速標籤按鈕 */}
              <Popover open={isTagPopoverOpen} onOpenChange={setIsTagPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 gap-1.5",
                      selectedTagIds.length > 0 && "text-primary"
                    )}
                    disabled={isLoading || isLoadingTags || !currentAccount}
                  >
                    <Tag className="size-4" />
                    {selectedTagIds.length > 0 && (
                      <span className="text-xs">{selectedTagIds.length}</span>
                    )}
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

              {/* 主題標籤快捷 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-8", topicTag && "text-primary")}
                    onClick={() => {
                      setIsSettingsOpen(true);
                      // Focus topic input after expanding
                      setTimeout(() => {
                        document.getElementById("topic-tag")?.focus();
                      }, 100);
                    }}
                    disabled={isLoading || !currentAccount}
                  >
                    <Hash className="size-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>主題標籤</TooltipContent>
              </Tooltip>

              {/* 連結快捷（僅文字貼文） */}
              {mediaType === "TEXT" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn("h-8", linkAttachment && "text-primary")}
                      onClick={() => {
                        setIsSettingsOpen(true);
                        setTimeout(() => {
                          document.getElementById("link-attachment")?.focus();
                        }, 100);
                      }}
                      disabled={isLoading || !currentAccount}
                    >
                      <Link2 className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>連結預覽</TooltipContent>
                </Tooltip>
              )}

              {/* 已選標籤預覽 */}
              <div className="flex-1 flex items-center gap-1.5 overflow-hidden">
                {selectedTags.slice(0, 3).map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className="h-6 gap-1 px-2 text-xs"
                    style={{
                      backgroundColor: `${tag.color}15`,
                      color: tag.color,
                    }}
                  >
                    <span
                      className="size-1.5 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </Badge>
                ))}
                {selectedTags.length > 3 && (
                  <span className="text-xs text-muted-foreground">
                    +{selectedTags.length - 3}
                  </span>
                )}
              </div>
            </div>

            {/* 媒體區域 */}
            <ComposeMediaSection
              mediaType={mediaType}
              mediaUrls={mediaUrls}
              onMediaUrlsChange={setMediaUrls}
              disabled={isLoading || !currentAccount}
            />
          </div>

          {/* ===== 區塊 2：進階設定（可收合）===== */}
          <Collapsible open={isSettingsOpen} onOpenChange={setIsSettingsOpen} className="mt-4">
            <CollapsibleTrigger asChild>
              <button className="group flex w-full items-center justify-between rounded-xl border bg-card px-5 py-3 text-sm font-medium transition-all duration-200 hover:bg-accent/50 hover:shadow-sm">
                <div className="flex items-center gap-2">
                  <Settings2 className="size-4 text-muted-foreground transition-transform duration-200 group-hover:rotate-45" />
                  進階設定
                  {settingsCount > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-xs animate-in fade-in duration-200">
                      {settingsCount}
                    </Badge>
                  )}
                </div>
                <ChevronDown className={cn(
                  "size-4 text-muted-foreground transition-transform duration-200",
                  isSettingsOpen && "rotate-180"
                )} />
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 space-y-4 rounded-xl border bg-card p-5">
                {/* 貼文標籤 */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5 text-sm font-medium">
                    <Tag className="size-3.5" />
                    貼文標籤
                    <span className="text-xs font-normal text-muted-foreground">
                      （用於分類與成效分析）
                    </span>
                  </Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* 選擇標籤按鈕 */}
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-2 border-dashed"
                          disabled={isLoading || isLoadingTags || !currentAccount}
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
                        className="h-8 gap-1.5 pl-2.5 pr-2 font-medium"
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
                  </div>
                </div>

                {/* 主題標籤 */}
                <div className="space-y-2">
                  <Label htmlFor="topic-tag" className="flex items-center gap-1.5 text-sm font-medium">
                    <Hash className="size-3.5" />
                    主題標籤
                    <span className="text-xs font-normal text-muted-foreground">
                      （Threads 原生標籤，按 Enter 確認）
                    </span>
                  </Label>

                  {/* 已確認的主題標籤顯示為 Badge，否則顯示輸入框 */}
                  {topicTag && !isEditingTopicTag ? (
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="h-8 gap-1.5 pl-2.5 pr-2 font-medium bg-primary/10 text-primary border-primary/20"
                      >
                        <Hash className="size-3" />
                        {topicTag}
                        <button
                          onClick={() => {
                            setTopicTag("");
                            setTopicTagInput("");
                          }}
                          className="ml-1 rounded-full p-0.5 hover:bg-primary/20 transition-colors"
                          disabled={isLoading || !currentAccount}
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-muted-foreground"
                        onClick={() => {
                          setTopicTagInput(topicTag);
                          setIsEditingTopicTag(true);
                          setTimeout(() => document.getElementById("topic-tag")?.focus(), 50);
                        }}
                        disabled={isLoading || !currentAccount}
                      >
                        變更
                      </Button>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <span className="text-muted-foreground">#</span>
                      </div>
                      <Input
                        id="topic-tag"
                        placeholder="輸入主題標籤後按 Enter"
                        value={topicTagInput}
                        onChange={(e) => setTopicTagInput(e.target.value.replace(/^#/, ""))}
                        onCompositionStart={() => { isComposingRef.current = true; }}
                        onCompositionEnd={() => { isComposingRef.current = false; }}
                        onKeyDown={(e) => {
                          // 只在非 IME 組合狀態時處理 Enter
                          if (e.key === "Enter" && !isComposingRef.current) {
                            e.preventDefault();
                            if (topicTagInput.trim()) {
                              setTopicTag(topicTagInput.trim());
                              setIsEditingTopicTag(false);
                            }
                          }
                          // ESC 取消編輯
                          if (e.key === "Escape") {
                            setTopicTagInput(topicTag);
                            setIsEditingTopicTag(false);
                          }
                        }}
                        onBlur={() => {
                          // 失去焦點時，如果有輸入值則確認
                          if (topicTagInput.trim()) {
                            setTopicTag(topicTagInput.trim());
                          }
                          setIsEditingTopicTag(false);
                        }}
                        maxLength={TOPIC_TAG_LIMIT}
                        className="pl-7"
                        disabled={isLoading || !currentAccount}
                      />
                    </div>
                  )}
                </div>

                {/* 連結預覽（僅文字貼文） */}
                {mediaType === "TEXT" && (
                  <div className="space-y-2">
                    <Label htmlFor="link-attachment" className="flex items-center gap-1.5 text-sm font-medium">
                      <Link2 className="size-3.5" />
                      連結預覽
                    </Label>
                    <div className="relative">
                      <Input
                        id="link-attachment"
                        placeholder="輸入要顯示預覽的連結 URL"
                        value={linkAttachment}
                        onChange={(e) => setLinkAttachment(e.target.value)}
                        disabled={isLoading || !currentAccount}
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
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* ===== 區塊 3：發布區（排程時間軸）===== */}
          <div className="mt-4 rounded-2xl border bg-card p-5 shadow-sm">
            <ScheduleTimeline
              accountId={currentAccount?.id || null}
              scheduledAt={scheduledAt}
              onScheduledAtChange={setScheduledAt}
              suggestedHour={suggestedHour}
              disabled={isLoading || !currentAccount}
            />

            {/* 發布按鈕 */}
            <div className="mt-5 pt-4 border-t">
              <Button
                onClick={handlePublish}
                disabled={!canPublish}
                size="lg"
                className={cn(
                  "w-full gap-2 font-semibold transition-all duration-300",
                  canPublish
                    ? "bg-primary hover:bg-primary/90 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.01] active:scale-[0.99]"
                    : "opacity-60"
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
          </div>
        </div>
      </div>

      {/* 決策輔助面板 */}
      <ComposeInsightsPanel
        selectedTagIds={selectedTagIds}
        accountTags={accountTags}
        accountId={currentAccount?.id || null}
        isCollapsed={isInsightsPanelCollapsed}
        onToggleCollapse={() => setIsInsightsPanelCollapsed(!isInsightsPanelCollapsed)}
        onSuggestedHourChange={(hour) => setSuggestedHour(hour ?? 20)}
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
        <div className="flex h-[calc(100vh-var(--header-height))] items-center justify-center">
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
