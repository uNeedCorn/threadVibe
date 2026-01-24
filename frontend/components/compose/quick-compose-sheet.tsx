"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2,
  X,
  AtSign,
  Shield,
  ExternalLink,
  Clock,
  Check,
  Tag,
  CheckCircle2,
  CircleDashed,
  Smartphone,
  Monitor,
  User,
  Trash2,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useAccountTags, type AccountTag } from "@/hooks/use-account-tags";
import { cn } from "@/lib/utils";

const TEXT_LIMIT = 500;
const DRAFT_KEY = "quick-compose-draft";

// 排程選項
type ScheduleOption = "now" | "later" | "tomorrow" | "custom";

interface ThreadsAccount {
  id: string;
  username: string;
  profilePicUrl: string | null;
}

// 時間軸項目類型
type TimelineItemType = "published" | "scheduled";
type PublishSource = "platform" | "threads";

interface TimelineTag {
  id: string;
  name: string;
  color: string;
}

interface TimelineItem {
  id: string;
  type: TimelineItemType;
  text: string | null;
  time: string; // ISO string
  source?: PublishSource; // 只有 published 類型有
  createdByName?: string; // 透過平台發送時顯示發送者
  tags?: TimelineTag[]; // 貼文標籤
  status?: string; // scheduled 類型的狀態
  isDeleted?: boolean; // 是否已刪除（軟刪除或在 Threads 刪除）
}

interface DraftData {
  text: string;
  selectedTagIds: string[];
  scheduleOption: ScheduleOption;
  customScheduleTime: string | null;
  savedAt: number;
}

interface QuickComposeSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuickComposeSheet({ open, onOpenChange }: QuickComposeSheetProps) {
  const router = useRouter();
  const [currentAccount, setCurrentAccount] = useState<ThreadsAccount | null>(null);
  const [text, setText] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [scheduleOption, setScheduleOption] = useState<ScheduleOption>("now");
  const [customScheduleTime, setCustomScheduleTime] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingAccount, setIsLoadingAccount] = useState(true);
  const [showDraftRestore, setShowDraftRestore] = useState(false);
  const [isTagPopoverOpen, setIsTagPopoverOpen] = useState(false);
  const [timelineItems, setTimelineItems] = useState<TimelineItem[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(false);
  const [timelineDateLabel, setTimelineDateLabel] = useState<string>("今日");

  // 草稿儲存計時器
  const draftTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // 取得帳號標籤
  const { tags: accountTags, isLoading: isLoadingTags, createTag } = useAccountTags();

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

  // 檢查草稿
  useEffect(() => {
    if (!open) return;

    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const draft: DraftData = JSON.parse(savedDraft);
        // 草稿 24 小時內有效
        const isValid = Date.now() - draft.savedAt < 24 * 60 * 60 * 1000;
        if (isValid && (draft.text || draft.selectedTagIds.length > 0)) {
          setShowDraftRestore(true);
        }
      }
    } catch {
      // 忽略解析錯誤
    }
  }, [open]);

  // 根據排程選項計算目標日期
  const getTargetDate = useCallback((): { date: Date; label: string } => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    if (scheduleOption === "now") {
      return { date: today, label: "今日" };
    }

    if (scheduleOption === "later") {
      // 1 小時後，檢查是否跨日
      const laterTime = new Date(now.getTime() + 60 * 60 * 1000);
      const laterDate = new Date(laterTime.getFullYear(), laterTime.getMonth(), laterTime.getDate());
      if (laterDate.getTime() === today.getTime()) {
        return { date: today, label: "今日" };
      } else {
        return { date: tomorrow, label: "明日" };
      }
    }

    if (scheduleOption === "tomorrow") {
      return { date: tomorrow, label: "明日" };
    }

    if (scheduleOption === "custom" && customScheduleTime) {
      const customDate = new Date(customScheduleTime);
      const customDay = new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate());

      if (customDay.getTime() === today.getTime()) {
        return { date: customDay, label: "今日" };
      } else if (customDay.getTime() === tomorrow.getTime()) {
        return { date: customDay, label: "明日" };
      } else {
        // 顯示日期格式 M/D
        const label = `${customDay.getMonth() + 1}/${customDay.getDate()}`;
        return { date: customDay, label };
      }
    }

    return { date: today, label: "今日" };
  }, [scheduleOption, customScheduleTime]);

  // 載入時間軸（根據排程選項動態切換日期）
  useEffect(() => {
    if (!open || !currentAccount) {
      setTimelineItems([]);
      return;
    }

    const accountId = currentAccount.id;
    const { date: targetDate, label } = getTargetDate();
    setTimelineDateLabel(label);

    async function fetchTimeline() {
      setIsLoadingTimeline(true);
      const supabase = createClient();

      // 計算目標日期的開始和結束時間
      const startOfDay = targetDate.toISOString();
      const endOfDay = new Date(targetDate.getTime() + 24 * 60 * 60 * 1000).toISOString();

      const items: TimelineItem[] = [];

      // 1. 取得當天已發布的貼文
      const { data: publishedPosts } = await supabase
        .from("workspace_threads_posts")
        .select(`
          id,
          threads_post_id,
          text,
          published_at,
          workspace_threads_post_tags (
            workspace_threads_account_tags (
              id,
              name,
              color
            )
          )
        `)
        .eq("workspace_threads_account_id", accountId)
        .gte("published_at", startOfDay)
        .lt("published_at", endOfDay)
        .order("published_at", { ascending: true });

      // 2. 取得當天外發貼文 - 排程發布（用 scheduled_at 篩選）
      const { data: scheduledOutbound } = await supabase
        .from("workspace_threads_outbound_posts")
        .select(`
          id,
          text,
          scheduled_at,
          published_at,
          publish_type,
          publish_status,
          threads_post_id,
          created_by,
          deleted_at
        `)
        .eq("workspace_threads_account_id", accountId)
        .eq("publish_type", "scheduled")
        .gte("scheduled_at", startOfDay)
        .lt("scheduled_at", endOfDay)
        .order("scheduled_at", { ascending: true });

      // 3. 取得當天外發貼文 - 即時發布（用 published_at 篩選）
      const { data: immediateOutbound } = await supabase
        .from("workspace_threads_outbound_posts")
        .select(`
          id,
          text,
          scheduled_at,
          published_at,
          publish_type,
          publish_status,
          threads_post_id,
          created_by,
          deleted_at
        `)
        .eq("workspace_threads_account_id", accountId)
        .eq("publish_type", "immediate")
        .gte("published_at", startOfDay)
        .lt("published_at", endOfDay)
        .order("published_at", { ascending: true });

      // 合併外發貼文
      const scheduledPosts = [...(scheduledOutbound || []), ...(immediateOutbound || [])];

      // 3. 查詢發布者名稱
      const creatorIds = [...new Set(scheduledPosts?.map((sp) => sp.created_by).filter(Boolean) || [])];
      const profilesMap = new Map<string, string>();

      if (creatorIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, email")
          .in("id", creatorIds);

        if (profiles) {
          for (const p of profiles) {
            const name = p.display_name || p.email?.split("@")[0] || "未知";
            profilesMap.set(p.id, name);
          }
        }
      }

      // 建立 threads_post_id 到排程記錄的對應（用於判斷已發布貼文來源和刪除狀態）
      const scheduledByThreadsId = new Map<string, {
        createdByName: string;
        isDeleted: boolean;
      }>();

      if (scheduledPosts) {
        for (const sp of scheduledPosts) {
          if (sp.threads_post_id && sp.publish_status === "published") {
            scheduledByThreadsId.set(sp.threads_post_id, {
              createdByName: profilesMap.get(sp.created_by) || "平台",
              isDeleted: sp.deleted_at != null,
            });
          }
        }
      }

      // 3. 處理已發布貼文
      if (publishedPosts) {
        for (const post of publishedPosts) {
          const scheduledInfo = scheduledByThreadsId.get(post.threads_post_id);
          const tags: TimelineTag[] = [];

          // 解析標籤
          if (post.workspace_threads_post_tags) {
            const postTags = post.workspace_threads_post_tags as unknown as Array<{
              workspace_threads_account_tags: { id: string; name: string; color: string } | null;
            }>;
            for (const pt of postTags) {
              if (pt.workspace_threads_account_tags) {
                tags.push({
                  id: pt.workspace_threads_account_tags.id,
                  name: pt.workspace_threads_account_tags.name,
                  color: pt.workspace_threads_account_tags.color,
                });
              }
            }
          }

          items.push({
            id: post.id,
            type: "published",
            text: post.text,
            time: post.published_at,
            source: scheduledInfo ? "platform" : "threads",
            createdByName: scheduledInfo?.createdByName,
            tags,
            isDeleted: scheduledInfo?.isDeleted,
          });
        }
      }

      // 4. 處理外發貼文（待發布 + 已發布但還沒同步的 + 已刪除的 + 即時發布的）
      // 建立已從 posts 表顯示的 threads_post_id 集合，避免重複
      const displayedThreadsPostIds = new Set(
        publishedPosts?.map((p) => p.threads_post_id).filter(Boolean) || []
      );

      if (scheduledPosts) {
        for (const sp of scheduledPosts) {
          const isDeleted = sp.deleted_at != null;
          const creatorName = profilesMap.get(sp.created_by) || "平台";
          const isImmediate = sp.publish_type === "immediate";
          // 即時發布用 published_at，排程發布用 scheduled_at
          const displayTime = isImmediate ? sp.published_at : sp.scheduled_at;

          // 待發布或發布中的排程
          if (sp.publish_status === "scheduled" || sp.publish_status === "publishing") {
            items.push({
              id: sp.id,
              type: "scheduled",
              text: sp.text,
              time: displayTime,
              status: sp.publish_status,
              createdByName: creatorName,
              isDeleted,
            });
          }
          // 已發布但還沒同步到 posts 表的（或已刪除的）
          else if (sp.publish_status === "published") {
            // 如果已經從 posts 表顯示了，跳過（避免重複）
            if (sp.threads_post_id && displayedThreadsPostIds.has(sp.threads_post_id)) {
              continue;
            }
            // 否則顯示為已發布（來源：平台）
            items.push({
              id: sp.id,
              type: "published",
              text: sp.text,
              time: displayTime,
              source: "platform",
              createdByName: creatorName,
              isDeleted,
            });
          }
          // 其他已刪除的狀態
          else if (isDeleted) {
            items.push({
              id: sp.id,
              type: "scheduled",
              text: sp.text,
              time: displayTime,
              status: sp.publish_status,
              createdByName: creatorName,
              isDeleted: true,
            });
          }
        }
      }

      // 5. 按時間排序
      items.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

      setTimelineItems(items);
      setIsLoadingTimeline(false);
    }

    fetchTimeline();
  }, [open, currentAccount, getTargetDate]);

  // 恢復草稿
  const handleRestoreDraft = useCallback(() => {
    try {
      const savedDraft = localStorage.getItem(DRAFT_KEY);
      if (savedDraft) {
        const draft: DraftData = JSON.parse(savedDraft);
        setText(draft.text || "");
        setSelectedTagIds(draft.selectedTagIds || []);
        setScheduleOption(draft.scheduleOption || "now");
        setCustomScheduleTime(draft.customScheduleTime || null);
      }
    } catch {
      // 忽略解析錯誤
    }
    setShowDraftRestore(false);
  }, []);

  // 忽略草稿
  const handleIgnoreDraft = useCallback(() => {
    localStorage.removeItem(DRAFT_KEY);
    setShowDraftRestore(false);
  }, []);

  // 儲存草稿（debounced）
  const saveDraft = useCallback(() => {
    if (draftTimeoutRef.current) {
      clearTimeout(draftTimeoutRef.current);
    }

    draftTimeoutRef.current = setTimeout(() => {
      const draft: DraftData = {
        text,
        selectedTagIds,
        scheduleOption,
        customScheduleTime,
        savedAt: Date.now(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, 500);
  }, [text, selectedTagIds, scheduleOption, customScheduleTime]);

  // 監聽變更並儲存草稿
  useEffect(() => {
    if (!open || showDraftRestore) return;
    saveDraft();
  }, [open, showDraftRestore, saveDraft]);

  // 清除草稿計時器
  useEffect(() => {
    return () => {
      if (draftTimeoutRef.current) {
        clearTimeout(draftTimeoutRef.current);
      }
    };
  }, []);

  // 重置表單
  const resetForm = useCallback(() => {
    setText("");
    setSelectedTagIds([]);
    setScheduleOption("now");
    setCustomScheduleTime(null);
    localStorage.removeItem(DRAFT_KEY);
  }, []);

  // 計算排程時間
  const getScheduledAt = useCallback((): string | null => {
    if (scheduleOption === "now") return null;

    const now = new Date();

    if (scheduleOption === "later") {
      // 1 小時後
      now.setHours(now.getHours() + 1);
      return now.toISOString();
    }

    if (scheduleOption === "tomorrow") {
      // 明天同一時間
      now.setDate(now.getDate() + 1);
      return now.toISOString();
    }

    if (scheduleOption === "custom" && customScheduleTime) {
      return new Date(customScheduleTime).toISOString();
    }

    return null;
  }, [scheduleOption, customScheduleTime]);

  // 跳轉完整編輯
  const handleGoToFullEditor = useCallback(() => {
    const params = new URLSearchParams();
    if (text) params.set("text", text);
    if (selectedTagIds.length > 0) params.set("tags", selectedTagIds.join(","));

    // 儲存草稿後跳轉
    saveDraft();
    onOpenChange(false);
    router.push(`/compose${params.toString() ? `?${params.toString()}` : ""}`);
  }, [text, selectedTagIds, saveDraft, onOpenChange, router]);

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

    setIsLoading(true);

    try {
      const supabase = createClient();
      const scheduledAt = getScheduledAt();

      const { data, error } = await supabase.functions.invoke("threads-compose", {
        body: {
          account_id: currentAccount.id,
          text: text.trim(),
          media_type: "TEXT",
          scheduled_at: scheduledAt || undefined,
          tag_ids: selectedTagIds.length > 0 ? selectedTagIds : undefined,
        },
      });

      if (error) {
        throw new Error(error.message);
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
          action: data.permalink
            ? {
                label: "查看貼文",
                onClick: () => window.open(data.permalink, "_blank"),
              }
            : undefined,
        });
      }

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

  // 切換標籤
  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  // 取得最小可選時間（10 分鐘後）
  const getMinDateTime = () => {
    const min = new Date();
    min.setMinutes(min.getMinutes() + 10);
    return min.toISOString().slice(0, 16);
  };

  const charCount = text.length;
  const isOverLimit = charCount > TEXT_LIMIT;
  const canPublish = currentAccount && text.trim().length > 0 && !isOverLimit && !isLoading;

  // 取得已選標籤物件
  const selectedTags = accountTags.filter((t) => selectedTagIds.includes(t.id));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-[480px] flex flex-col p-0">
        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
          <div className="grid grid-cols-3 items-center">
            {/* 左：完整編輯 */}
            <div className="flex justify-start">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGoToFullEditor}
                className="text-muted-foreground hover:text-foreground gap-1"
              >
                完整編輯
                <ExternalLink className="size-3" />
              </Button>
            </div>
            {/* 中：標題置中 */}
            <div className="flex items-center justify-center gap-1.5">
              <Shield className="size-4 text-orange-500" />
              <SheetTitle className="text-base font-semibold text-orange-600">
                新串文
              </SheetTitle>
            </div>
            {/* 右：留空給 X 按鈕 */}
            <div />
          </div>
          <SheetDescription className="sr-only">
            快速發布新串文到 Threads
          </SheetDescription>
        </SheetHeader>

        {/* 草稿恢復提示 */}
        {showDraftRestore && (
          <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/30 border-b flex items-center justify-between">
            <span className="text-sm text-amber-700 dark:text-amber-400">
              發現未完成的草稿
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleIgnoreDraft}>
                忽略
              </Button>
              <Button variant="secondary" size="sm" onClick={handleRestoreDraft}>
                恢復
              </Button>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
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
            <div className="flex gap-3 p-4 shrink-0">
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
                {/* 使用者名稱 */}
                <div className="mb-1">
                  <span className="font-semibold text-sm">{currentAccount.username}</span>
                </div>

                <div className="relative">
                  <Textarea
                    placeholder="有什麼新鮮事？"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    className="min-h-[100px] resize-none border-0 p-0 pb-6 text-[15px] leading-relaxed placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0"
                    disabled={isLoading}
                    autoFocus
                  />
                  {/* 字數進度（文字框內右下角） */}
                  <div className="absolute bottom-0 right-0 flex items-center gap-1.5">
                    <div className="relative size-4">
                      <svg className="size-4 -rotate-90" viewBox="0 0 36 36">
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4"
                          className="text-muted/30"
                        />
                        <circle
                          cx="18"
                          cy="18"
                          r="14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="4"
                          strokeDasharray={`${Math.min((charCount / TEXT_LIMIT) * 88, 88)} 88`}
                          strokeLinecap="round"
                          className={cn(
                            "transition-all duration-300",
                            isOverLimit
                              ? "text-destructive"
                              : charCount > TEXT_LIMIT * 0.8
                              ? "text-amber-500"
                              : "text-primary"
                          )}
                        />
                      </svg>
                    </div>
                    <span
                      className={cn(
                        "text-[11px] tabular-nums",
                        isOverLimit
                          ? "text-destructive font-medium"
                          : charCount > TEXT_LIMIT * 0.8
                          ? "text-amber-500 font-medium"
                          : "text-muted-foreground"
                      )}
                    >
                      剩餘 {TEXT_LIMIT - charCount}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 帳號標籤選擇 */}
          {currentAccount && !isLoadingAccount && (
            <div className="px-4 pb-3 shrink-0">
              <div className="flex items-center gap-2 flex-wrap">
                <Popover open={isTagPopoverOpen} onOpenChange={setIsTagPopoverOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 gap-1 text-xs"
                      disabled={isLoading || isLoadingTags}
                    >
                      <Tag className="size-3" />
                      標籤
                      {selectedTags.length > 0 && (
                        <span className="ml-1 bg-primary/10 text-primary px-1.5 rounded-full">
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
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium text-white"
                    style={{ backgroundColor: tag.color }}
                  >
                    {tag.name}
                    <button
                      onClick={() => handleToggleTag(tag.id)}
                      className="hover:bg-white/20 rounded-full p-0.5"
                    >
                      <X className="size-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <Separator className="shrink-0" />

          {/* 排程選項 */}
          {currentAccount && !isLoadingAccount && (
            <div className="px-4 py-3 flex-1 flex flex-col min-h-0 overflow-hidden">
              <div className="flex items-center gap-2 mb-3 shrink-0">
                <Clock className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium">發布時間</span>
              </div>
              <RadioGroup
                value={scheduleOption}
                onValueChange={(v) => setScheduleOption(v as ScheduleOption)}
                className="space-y-2 shrink-0"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="now" id="now" disabled={isLoading} />
                  <Label htmlFor="now" className="text-sm cursor-pointer">
                    立即發布
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="later" id="later" disabled={isLoading} />
                  <Label htmlFor="later" className="text-sm cursor-pointer">
                    稍後（1 小時後）
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="tomorrow" id="tomorrow" disabled={isLoading} />
                  <Label htmlFor="tomorrow" className="text-sm cursor-pointer">
                    明天同一時間
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="custom" disabled={isLoading} />
                  <Label htmlFor="custom" className="text-sm cursor-pointer">
                    自訂時間
                  </Label>
                </div>
              </RadioGroup>

              {scheduleOption === "custom" && (
                <div className="mt-3 ml-6 shrink-0">
                  <Input
                    type="datetime-local"
                    min={getMinDateTime()}
                    value={customScheduleTime || ""}
                    onChange={(e) => setCustomScheduleTime(e.target.value || null)}
                    disabled={isLoading}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    排程時間必須在 10 分鐘後
                  </p>
                </div>
              )}

              {/* 時間軸 - 根據排程選項動態切換日期 */}
              <div className="mt-4 pt-3 border-t border-dashed flex-1 flex flex-col min-h-0">
                <p className="text-xs text-muted-foreground mb-3 shrink-0">
                  {timelineDateLabel}動態{timelineItems.length > 0 ? `（${timelineItems.length} 篇）` : ""}
                </p>

                {isLoadingTimeline ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  </div>
                ) : timelineItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-4 text-center flex-1">
                    <Clock className="size-6 text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground">
                      {timelineDateLabel}尚無動態
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 flex-1 min-h-0 overflow-y-auto pr-1">
                    {timelineItems.map((item) => {
                      const isPublished = item.type === "published";
                      const isDeleted = item.isDeleted === true;

                      return (
                        <div
                          key={item.id}
                          className={cn(
                            "rounded-xl border p-3 shadow-sm transition-all hover:shadow-md",
                            isDeleted
                              ? "bg-muted/20 border-muted/50 opacity-60"
                              : isPublished
                              ? "bg-card border-border shadow-emerald-100/50 dark:shadow-emerald-900/20"
                              : "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800 shadow-orange-100/50 dark:shadow-orange-900/20"
                          )}
                        >
                          {/* 頂部：時間 + 狀態 */}
                          <div className="flex items-center gap-2 mb-1.5">
                            {isDeleted ? (
                              <Trash2 className="size-3.5 text-muted-foreground shrink-0" />
                            ) : isPublished ? (
                              <CheckCircle2 className="size-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <CircleDashed className="size-3.5 text-orange-500 shrink-0" />
                            )}
                            <span className={cn(
                              "text-xs font-medium tabular-nums",
                              isDeleted && "line-through text-muted-foreground"
                            )}>
                              {new Date(item.time).toLocaleTimeString("zh-TW", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                            <span className={cn(
                              "text-xs px-1.5 py-0.5 rounded",
                              isDeleted
                                ? "bg-muted text-muted-foreground"
                                : isPublished
                                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                : "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
                            )}>
                              {isDeleted ? "已刪除" : isPublished ? "已發布" : item.status === "publishing" ? "發布中" : "排程中"}
                            </span>

                            {/* 來源標記 */}
                            {isPublished && !isDeleted && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground ml-auto">
                                {item.source === "platform" ? (
                                  <>
                                    <Monitor className="size-3" />
                                    <span>平台</span>
                                  </>
                                ) : (
                                  <>
                                    <Smartphone className="size-3" />
                                    <span>Threads</span>
                                  </>
                                )}
                              </span>
                            )}
                          </div>

                          {/* 貼文內容 */}
                          <p className={cn(
                            "text-xs text-muted-foreground line-clamp-2 mb-1.5",
                            isDeleted && "line-through"
                          )}>
                            {item.text?.slice(0, 50) || "(無文字)"}
                            {item.text && item.text.length > 50 ? "..." : ""}
                          </p>

                          {/* 底部：標籤 + 發送者 */}
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* 貼文標籤 */}
                            {item.tags && item.tags.length > 0 && !isDeleted && (
                              <>
                                {item.tags.slice(0, 3).map((tag) => (
                                  <span
                                    key={tag.id}
                                    className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                                    style={{ backgroundColor: tag.color }}
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                                {item.tags.length > 3 && (
                                  <span className="text-[10px] text-muted-foreground">
                                    +{item.tags.length - 3}
                                  </span>
                                )}
                              </>
                            )}

                            {/* 發送者（平台發送時顯示） */}
                            {item.createdByName && !isDeleted && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground ml-auto">
                                <User className="size-2.5" />
                                {item.createdByName}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {currentAccount && (
          <div className="border-t px-4 py-3">
            <div className="flex items-center justify-end">
              <Button
                onClick={handlePublish}
                disabled={!canPublish || isLoadingAccount}
                size="sm"
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="size-4 mr-1.5 animate-spin" />
                    {scheduleOption === "now" ? "發布中" : "排程中"}
                  </>
                ) : scheduleOption === "now" ? (
                  "發布"
                ) : (
                  <>
                    <Clock className="size-4 mr-1.5" />
                    {(() => {
                      const scheduledAt = getScheduledAt();
                      if (scheduledAt) {
                        const date = new Date(scheduledAt);
                        return `排程 ${date.toLocaleDateString("zh-TW", { month: "numeric", day: "numeric" })} ${date.toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" })}`;
                      }
                      return "排程發布";
                    })()}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
