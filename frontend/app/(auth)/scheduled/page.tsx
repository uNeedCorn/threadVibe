"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { type View } from "react-big-calendar";
import {
  Calendar as CalendarIcon,
  Clock,
  Edit2,
  Loader2,
  MoreHorizontal,
  Trash2,
  Eye,
  Send,
  AlertCircle,
  List,
  CalendarDays,
  UserX,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSelectedAccountContext } from "@/contexts/selected-account-context";
import { ScheduleCalendar, Views, type ScheduleEvent } from "@/components/scheduled/schedule-calendar";
import { PageHeader } from "@/components/layout";
import { SCHEDULE_STATUS_COLORS } from "@/lib/design-tokens";

interface ScheduledPost {
  id: string;
  text: string | null;
  media_type: string;
  scheduled_at: string;
  publish_status: string;
  created_at: string;
  published_at: string | null;
  threads_post_id: string | null;
  error_message: string | null;
  created_by: string;
  topic_tag: string | null;
}

interface SyncedPost {
  id: string;
  text: string | null;
  media_type: string;
  published_at: string;
  threads_post_id: string;
  current_views: number;
  current_likes: number;
  is_reply: boolean;
}

interface Profile {
  id: string;
  display_name: string | null;
}

// 統一的貼文資料（含來源標記）
type PostSource = "scheduled" | "synced";

interface UnifiedPost {
  id: string;
  text: string | null;
  media_type: string;
  displayDate: string; // 用於日曆顯示的日期
  publish_status: string;
  created_at: string;
  published_at: string | null;
  threads_post_id: string | null;
  error_message: string | null;
  created_by: string | null;
  topic_tag: string | null;
  source: PostSource;
  // 同步貼文的額外資料
  current_views?: number;
  current_likes?: number;
}

// 合併後的貼文資料
interface ScheduledPostWithCreator extends ScheduledPost {
  creatorName: string | null;
}

interface UnifiedPostWithCreator extends UnifiedPost {
  creatorName: string | null;
}

type StatusTabValue = "scheduled" | "published" | "failed";
type ViewMode = "list" | "calendar";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock; color: string }> = {
  scheduled: { label: "排程中", variant: "secondary", icon: Clock, color: SCHEDULE_STATUS_COLORS.scheduled },
  publishing: { label: "發布中", variant: "default", icon: Loader2, color: SCHEDULE_STATUS_COLORS.publishing },
  published: { label: "排程發布", variant: "outline", icon: Send, color: SCHEDULE_STATUS_COLORS.published }, // 綠色 - 排程後發布
  immediate: { label: "立即發布", variant: "outline", icon: Send, color: "#8b5cf6" }, // 紫色 - Compose 立即發布
  failed: { label: "發布失敗", variant: "destructive", icon: AlertCircle, color: SCHEDULE_STATUS_COLORS.failed },
  cancelled: { label: "已取消", variant: "outline", icon: Trash2, color: SCHEDULE_STATUS_COLORS.cancelled },
  synced: { label: "直接發布", variant: "outline", icon: Send, color: "#6366f1" }, // indigo - Threads App 發布
};

// 判斷是否為立即發布（scheduled_at 與 created_at 差距小於 5 分鐘）
function isImmediatePublish(scheduledAt: string, createdAt: string): boolean {
  const scheduled = new Date(scheduledAt).getTime();
  const created = new Date(createdAt).getTime();
  const diffMinutes = (scheduled - created) / (1000 * 60);
  return diffMinutes < 5;
}

// 取得顯示用的狀態（區分排程發布 vs 立即發布）
function getDisplayStatus(post: { publish_status: string; displayDate: string; created_at: string; source: PostSource }): string {
  if (post.source === "synced") return "synced";
  if (post.publish_status === "published") {
    return isImmediatePublish(post.displayDate, post.created_at) ? "immediate" : "published";
  }
  return post.publish_status;
}

export default function ScheduledPage() {
  const { selectedAccount, isLoading: isLoadingAccount } = useSelectedAccountContext();
  const [posts, setPosts] = useState<UnifiedPostWithCreator[]>([]);
  const [allPosts, setAllPosts] = useState<UnifiedPostWithCreator[]>([]); // 日曆用：所有狀態
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [activeTab, setActiveTab] = useState<StatusTabValue>("scheduled");
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");

  // 日曆狀態
  const [calendarView, setCalendarView] = useState<View>(Views.MONTH);
  const [calendarDate, setCalendarDate] = useState(new Date());

  // Dialog 狀態
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [rescheduleEvent, setRescheduleEvent] = useState<{ id: string; newStart: Date } | null>(null);
  const [isRescheduling, setIsRescheduling] = useState(false);

  // 查詢 profiles 並合併到貼文資料
  const fetchPostsWithProfiles = useCallback(async (
    postsData: UnifiedPost[]
  ): Promise<UnifiedPostWithCreator[]> => {
    if (postsData.length === 0) return [];

    const supabase = createClient();
    const userIds = [...new Set(postsData.map(p => p.created_by).filter(Boolean))] as string[];

    if (userIds.length === 0) {
      return postsData.map(post => ({ ...post, creatorName: null }));
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", userIds);

    const profileMap = new Map<string, string | null>();
    (profiles || []).forEach((p: Profile) => {
      profileMap.set(p.id, p.display_name);
    });

    return postsData.map(post => ({
      ...post,
      creatorName: post.created_by ? profileMap.get(post.created_by) || null : null,
    }));
  }, []);

  // 載入所有貼文（日曆視圖用）- 包含排程貼文和同步貼文
  useEffect(() => {
    if (!selectedAccount) {
      setAllPosts([]);
      return;
    }

    async function fetchAllPosts() {
      const supabase = createClient();

      // 1. 取得排程貼文
      const { data: outboundData, error: outboundError } = await supabase
        .from("workspace_threads_outbound_posts")
        .select("id, text, media_type, scheduled_at, publish_status, created_at, published_at, threads_post_id, error_message, created_by, topic_tag")
        .eq("workspace_threads_account_id", selectedAccount!.id)
        .is("deleted_at", null)
        .order("scheduled_at", { ascending: true });

      if (outboundError) {
        console.error("Error fetching outbound posts:", outboundError);
      }

      // 2. 取得同步貼文（只取非回覆的貼文）
      const { data: syncedData, error: syncedError } = await supabase
        .from("workspace_threads_posts")
        .select("id, text, media_type, published_at, threads_post_id, current_views, current_likes, is_reply")
        .eq("workspace_threads_account_id", selectedAccount!.id)
        .eq("is_reply", false)
        .order("published_at", { ascending: false });

      if (syncedError) {
        console.error("Error fetching synced posts:", syncedError);
      }

      // 3. 取得已發布排程貼文的 threads_post_id，用於去重
      const outboundThreadsIds = new Set(
        (outboundData || [])
          .filter(p => p.threads_post_id)
          .map(p => p.threads_post_id)
      );

      // 4. 轉換為統一格式
      const outboundUnified: UnifiedPost[] = (outboundData || []).map(post => ({
        id: post.id,
        text: post.text,
        media_type: post.media_type,
        displayDate: post.scheduled_at,
        publish_status: post.publish_status,
        created_at: post.created_at,
        published_at: post.published_at,
        threads_post_id: post.threads_post_id,
        error_message: post.error_message,
        created_by: post.created_by,
        topic_tag: post.topic_tag,
        source: "scheduled" as PostSource,
      }));

      // 過濾掉已經在 outbound 中的貼文（透過 threads_post_id 去重）
      const syncedUnified: UnifiedPost[] = (syncedData || [])
        .filter(post => !outboundThreadsIds.has(post.threads_post_id))
        .map(post => ({
          id: post.id,
          text: post.text,
          media_type: post.media_type,
          displayDate: post.published_at,
          publish_status: "synced",
          created_at: post.published_at,
          published_at: post.published_at,
          threads_post_id: post.threads_post_id,
          error_message: null,
          created_by: null,
          topic_tag: null,
          source: "synced" as PostSource,
          current_views: post.current_views,
          current_likes: post.current_likes,
        }));

      // 5. 合併並排序
      const allUnified = [...outboundUnified, ...syncedUnified].sort((a, b) =>
        new Date(a.displayDate).getTime() - new Date(b.displayDate).getTime()
      );

      const postsWithCreators = await fetchPostsWithProfiles(allUnified);
      setAllPosts(postsWithCreators);
    }

    fetchAllPosts();
  }, [selectedAccount, fetchPostsWithProfiles]);

  // 載入篩選後的貼文（清單視圖用）
  useEffect(() => {
    if (!selectedAccount || viewMode === "calendar") {
      return;
    }

    async function fetchPosts() {
      setIsLoadingPosts(true);
      const supabase = createClient();

      if (activeTab === "scheduled") {
        // 排程中：只從 outbound_posts 取
        const { data, error } = await supabase
          .from("workspace_threads_outbound_posts")
          .select("id, text, media_type, scheduled_at, publish_status, created_at, published_at, threads_post_id, error_message, created_by, topic_tag")
          .eq("workspace_threads_account_id", selectedAccount!.id)
          .is("deleted_at", null)
          .in("publish_status", ["scheduled", "publishing"])
          .order("scheduled_at", { ascending: true });

        if (error) {
          console.error("Error fetching posts:", error);
          toast.error("載入排程貼文失敗");
        } else {
          const unified: UnifiedPost[] = (data || []).map(post => ({
            ...post,
            displayDate: post.scheduled_at,
            source: "scheduled" as PostSource,
          }));
          const postsWithCreators = await fetchPostsWithProfiles(unified);
          setPosts(postsWithCreators);
        }
      } else if (activeTab === "published") {
        // 已發布：從兩個表取並合併
        const [outboundResult, syncedResult] = await Promise.all([
          supabase
            .from("workspace_threads_outbound_posts")
            .select("id, text, media_type, scheduled_at, publish_status, created_at, published_at, threads_post_id, error_message, created_by, topic_tag")
            .eq("workspace_threads_account_id", selectedAccount!.id)
            .is("deleted_at", null)
            .eq("publish_status", "published")
            .order("published_at", { ascending: false }),
          supabase
            .from("workspace_threads_posts")
            .select("id, text, media_type, published_at, threads_post_id, current_views, current_likes, is_reply")
            .eq("workspace_threads_account_id", selectedAccount!.id)
            .eq("is_reply", false)
            .order("published_at", { ascending: false }),
        ]);

        if (outboundResult.error) {
          console.error("Error fetching outbound posts:", outboundResult.error);
        }
        if (syncedResult.error) {
          console.error("Error fetching synced posts:", syncedResult.error);
        }

        // 去重：排除已在 outbound 中的貼文
        const outboundThreadsIds = new Set(
          (outboundResult.data || [])
            .filter(p => p.threads_post_id)
            .map(p => p.threads_post_id)
        );

        const outboundUnified: UnifiedPost[] = (outboundResult.data || []).map(post => ({
          ...post,
          displayDate: post.published_at || post.scheduled_at,
          source: "scheduled" as PostSource,
        }));

        const syncedUnified: UnifiedPost[] = (syncedResult.data || [])
          .filter(post => !outboundThreadsIds.has(post.threads_post_id))
          .map(post => ({
            id: post.id,
            text: post.text,
            media_type: post.media_type,
            displayDate: post.published_at,
            publish_status: "synced",
            created_at: post.published_at,
            published_at: post.published_at,
            threads_post_id: post.threads_post_id,
            error_message: null,
            created_by: null,
            topic_tag: null,
            source: "synced" as PostSource,
            current_views: post.current_views,
            current_likes: post.current_likes,
          }));

        const allUnified = [...outboundUnified, ...syncedUnified].sort((a, b) =>
          new Date(b.displayDate).getTime() - new Date(a.displayDate).getTime()
        );

        const postsWithCreators = await fetchPostsWithProfiles(allUnified);
        setPosts(postsWithCreators);
      } else if (activeTab === "failed") {
        // 失敗：只從 outbound_posts 取
        const { data, error } = await supabase
          .from("workspace_threads_outbound_posts")
          .select("id, text, media_type, scheduled_at, publish_status, created_at, published_at, threads_post_id, error_message, created_by, topic_tag")
          .eq("workspace_threads_account_id", selectedAccount!.id)
          .is("deleted_at", null)
          .in("publish_status", ["failed", "cancelled"])
          .order("scheduled_at", { ascending: false });

        if (error) {
          console.error("Error fetching posts:", error);
          toast.error("載入失敗貼文失敗");
        } else {
          const unified: UnifiedPost[] = (data || []).map(post => ({
            ...post,
            displayDate: post.scheduled_at,
            source: "scheduled" as PostSource,
          }));
          const postsWithCreators = await fetchPostsWithProfiles(unified);
          setPosts(postsWithCreators);
        }
      }

      setIsLoadingPosts(false);
    }

    fetchPosts();
  }, [selectedAccount, activeTab, viewMode, fetchPostsWithProfiles]);

  // 轉換為日曆事件（使用 allPosts）
  const calendarEvents: ScheduleEvent[] = useMemo(() => {
    return allPosts.map((post) => {
      const start = new Date(post.displayDate);
      const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 分鐘
      const text = post.text?.trim() || "(無文字)";
      const displayStatus = getDisplayStatus(post);
      return {
        id: post.id,
        title: text.length > 10 ? text.slice(0, 10) + "…" : text,
        start,
        end,
        status: displayStatus, // 使用顯示狀態（區分排程發布 vs 立即發布）
        mediaType: post.media_type,
        text: post.text,
        createdAt: new Date(post.created_at),
        creatorName: post.creatorName,
        topicTag: post.topic_tag,
        source: post.source,
        currentViews: post.current_views,
        currentLikes: post.current_likes,
      };
    });
  }, [allPosts]);

  // 取消排程（軟刪除）
  const handleCancelSchedule = async (postId: string) => {
    setIsDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("workspace_threads_outbound_posts")
        .update({
          deleted_at: new Date().toISOString(),
          deletion_source: "platform_deleted"
        })
        .eq("id", postId);

      if (error) throw error;

      toast.success("已取消排程");
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      setAllPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {
      toast.error("取消排程失敗");
    } finally {
      setIsDeleting(false);
      setDeletePostId(null);
    }
  };

  // 處理拖曳調整時間
  const handleEventDrop = useCallback((eventId: string, newStart: Date) => {
    // 檢查事件狀態，只有 scheduled 才能調整
    const event = allPosts.find(p => p.id === eventId);
    if (!event || event.publish_status !== "scheduled" || event.source === "synced") {
      toast.error("只有排程中的貼文可以調整時間");
      return;
    }
    // 不能調整到過去的時間
    if (newStart < new Date()) {
      toast.error("無法排程到過去的時間");
      return;
    }
    setRescheduleEvent({ id: eventId, newStart });
  }, [allPosts]);

  // 確認調整時間
  const handleConfirmReschedule = async () => {
    if (!rescheduleEvent) return;

    setIsRescheduling(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("workspace_threads_outbound_posts")
        .update({ scheduled_at: rescheduleEvent.newStart.toISOString() })
        .eq("id", rescheduleEvent.id);

      if (error) throw error;

      // 同時更新 publish_schedules 表
      await supabase
        .from("workspace_threads_publish_schedules")
        .update({ scheduled_at: rescheduleEvent.newStart.toISOString() })
        .eq("outbound_post_id", rescheduleEvent.id)
        .is("executed_at", null);

      toast.success("排程時間已更新");
      const newDateStr = rescheduleEvent.newStart.toISOString();
      const updatePost = (p: UnifiedPostWithCreator): UnifiedPostWithCreator =>
        p.id === rescheduleEvent.id
          ? { ...p, displayDate: newDateStr }
          : p;
      setPosts((prev) => prev.map(updatePost));
      setAllPosts((prev) => prev.map(updatePost));
    } catch {
      toast.error("調整時間失敗");
    } finally {
      setIsRescheduling(false);
      setRescheduleEvent(null);
    }
  };

  // 處理點擊事件
  const handleEventClick = useCallback((event: ScheduleEvent) => {
    setSelectedEvent(event);
  }, []);

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-TW", {
      month: "short",
      day: "numeric",
      weekday: "short",
    });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateTime = (date: Date) => {
    return date.toLocaleString("zh-TW", {
      year: "numeric",
      month: "short",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // 計算距離發布時間
  const getTimeUntil = (dateStr: string) => {
    const now = new Date();
    const target = new Date(dateStr);
    const diff = target.getTime() - now.getTime();

    if (diff < 0) return "即將發布";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} 天後`;
    }

    if (hours > 0) {
      return `${hours} 小時 ${minutes} 分鐘後`;
    }

    return `${minutes} 分鐘後`;
  };

  // 按日期分組貼文
  const groupPostsByDate = (posts: UnifiedPostWithCreator[]) => {
    const groups: Record<string, UnifiedPostWithCreator[]> = {};
    posts.forEach((post) => {
      const date = new Date(post.displayDate).toISOString().split("T")[0];
      if (!groups[date]) groups[date] = [];
      groups[date].push(post);
    });
    return groups;
  };

  const groupedPosts = groupPostsByDate(posts);
  const sortedDates = Object.keys(groupedPosts).sort((a, b) =>
    activeTab === "scheduled" ? a.localeCompare(b) : b.localeCompare(a)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="排程管理"
        description="管理已排程的貼文，拖曳調整發布時間"
        actions={
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as ViewMode)}>
            <ToggleGroupItem value="calendar" aria-label="日曆視圖">
              <CalendarDays className="size-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="清單視圖">
              <List className="size-4" />
            </ToggleGroupItem>
          </ToggleGroup>
        }
      />

      {/* 未選擇帳號提示 */}
      {!isLoadingAccount && !selectedAccount && (
        <Card className="mb-6">
          <EmptyState
            size="sm"
            icon={<UserX />}
            title="尚未選擇帳號"
            description="請先在側邊欄選擇 Threads 帳號"
          />
        </Card>
      )}

      {/* 日曆視圖 */}
      {viewMode === "calendar" && (
        <Card>
          <CardContent className="p-4">
            {calendarEvents.length === 0 && (
              <EmptyState
                size="sm"
                icon={<CalendarIcon />}
                title="目前沒有排程貼文"
                description="建立新貼文並設定發布時間"
                animate={false}
              />
            )}
            <div className="h-[600px]">
              <ScheduleCalendar
                events={calendarEvents}
                onEventDrop={handleEventDrop}
                onEventClick={handleEventClick}
                view={calendarView}
                onViewChange={setCalendarView}
                date={calendarDate}
                onDateChange={setCalendarDate}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* 清單視圖 - 使用 Tabs */}
      {viewMode === "list" && (
        <Tabs id="scheduled-status-tabs" value={activeTab} onValueChange={(v) => setActiveTab(v as StatusTabValue)}>
          <TabsList className="mb-6">
            <TabsTrigger value="scheduled" className="gap-2">
              <Clock className="size-4" />
              排程中
            </TabsTrigger>
            <TabsTrigger value="published" className="gap-2">
              <Send className="size-4" />
              已發布
            </TabsTrigger>
            <TabsTrigger value="failed" className="gap-2">
              <AlertCircle className="size-4" />
              失敗
            </TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab}>
            {isLoadingPosts ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="size-6 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : posts.length === 0 ? (
              <Card>
                <EmptyState
                  icon={<CalendarIcon />}
                  title={
                    activeTab === "scheduled" ? "目前沒有排程中的貼文" :
                    activeTab === "published" ? "目前沒有已發布的排程貼文" :
                    "沒有發布失敗的貼文"
                  }
                />
              </Card>
            ) : (
              <div className="space-y-6">
                {sortedDates.map((date) => (
                  <div key={date}>
                    <div className="mb-3 flex items-center gap-2">
                      <CalendarIcon className="size-4 text-muted-foreground" />
                      <h3 className="text-sm font-medium text-muted-foreground">
                        {formatDate(groupedPosts[date][0].displayDate)}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        ({groupedPosts[date].length} 篇)
                      </span>
                    </div>
                    <div className="space-y-3">
                      {groupedPosts[date].map((post) => {
                        const displayStatus = getDisplayStatus(post);
                        const statusConfig = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.scheduled;
                        const StatusIcon = statusConfig.icon;

                        return (
                          <Card key={post.id}>
                            <CardContent className="relative pt-4 pb-8">
                              <div className="flex items-start gap-4 pr-10">
                                {/* 時間 */}
                                <div className="flex flex-col items-center text-center min-w-[60px]">
                                  <span className="text-lg font-semibold tabular-nums">
                                    {formatTime(post.displayDate)}
                                  </span>
                                  {activeTab === "scheduled" && (
                                    <span className="text-xs text-muted-foreground">
                                      {getTimeUntil(post.displayDate)}
                                    </span>
                                  )}
                                  {post.source === "synced" && post.current_views !== undefined && (
                                    <span className="text-xs text-muted-foreground">
                                      {post.current_views.toLocaleString()} 觸及
                                    </span>
                                  )}
                                </div>

                                {/* 內容 */}
                                <div className="flex-1 min-w-0 space-y-2">
                                  {/* 狀態、媒體類型與主題標籤 */}
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span
                                      className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-white"
                                      style={{ backgroundColor: statusConfig.color }}
                                    >
                                      <StatusIcon className={cn("size-3", post.publish_status === "publishing" && "animate-spin")} />
                                      {statusConfig.label}
                                    </span>
                                    <Badge variant="outline" className="text-xs">
                                      {post.media_type}
                                    </Badge>
                                    {post.topic_tag && (
                                      <Badge variant="secondary">#{post.topic_tag}</Badge>
                                    )}
                                  </div>

                                  {/* 貼文內容（卡片形式） */}
                                  <div className="rounded-lg border bg-muted/30 p-3">
                                    <p className="text-sm whitespace-pre-wrap line-clamp-3">
                                      {post.text || "(無文字內容)"}
                                    </p>
                                  </div>

                                  {/* 錯誤訊息 */}
                                  {post.error_message && (
                                    <p className="text-xs text-destructive">
                                      錯誤：{post.error_message}
                                    </p>
                                  )}
                                </div>

                                {/* 操作按鈕 */}
                                <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="size-8">
                                    <MoreHorizontal className="size-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  {post.threads_post_id && (
                                    <DropdownMenuItem
                                      onClick={() => window.open(`https://www.threads.net/@${selectedAccount?.username}/post/${post.threads_post_id}`, "_blank")}
                                    >
                                      <Eye className="mr-2 size-4" />
                                      查看貼文
                                    </DropdownMenuItem>
                                  )}
                                  {activeTab === "scheduled" && (
                                    <>
                                      <DropdownMenuItem disabled>
                                        <Edit2 className="mr-2 size-4" />
                                        編輯（開發中）
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        className="text-destructive focus:text-destructive"
                                        onClick={() => setDeletePostId(post.id)}
                                      >
                                        <Trash2 className="mr-2 size-4" />
                                        取消排程
                                      </DropdownMenuItem>
                                    </>
                                  )}
                                  {activeTab === "failed" && (
                                    <DropdownMenuItem disabled>
                                      <Send className="mr-2 size-4" />
                                      重新發布（開發中）
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                              </div>

                              {/* 發布人與建立時間（右下角） */}
                              <p className="absolute bottom-3 right-4 text-xs text-muted-foreground">
                                {post.source === "synced" ? (
                                  <>發布於 {formatDateTime(new Date(post.displayDate))}</>
                                ) : (
                                  <>由 {post.creatorName || "未知"} 建立於 {formatDateTime(new Date(post.created_at))}</>
                                )}
                              </p>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* 刪除確認對話框 */}
      <AlertDialog open={!!deletePostId} onOpenChange={() => setDeletePostId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>取消排程</AlertDialogTitle>
            <AlertDialogDescription>
              確定要取消這篇貼文的排程嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePostId && handleCancelSchedule(deletePostId)}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  處理中...
                </>
              ) : (
                "確定取消"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 事件詳情對話框 */}
      <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {selectedEvent?.source === "synced" ? "已發布貼文" : "排程貼文"}
            </DialogTitle>
            <DialogDescription>
              {selectedEvent?.source === "synced" ? "發布" : "排程"}時間：{selectedEvent && formatDateTime(selectedEvent.start)}
            </DialogDescription>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-3">
              {/* 狀態、媒體類型與主題標籤 */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-white"
                  style={{ backgroundColor: STATUS_CONFIG[selectedEvent.status]?.color || "rgb(87, 83, 78)" }}
                >
                  {STATUS_CONFIG[selectedEvent.status]?.label || selectedEvent.status}
                </span>
                <Badge variant="outline">{selectedEvent.mediaType}</Badge>
                {selectedEvent.topicTag && (
                  <Badge variant="secondary">#{selectedEvent.topicTag}</Badge>
                )}
              </div>

              {/* 同步貼文的成效數據 */}
              {selectedEvent.source === "synced" && selectedEvent.currentViews !== undefined && (
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">
                    觸及 <span className="font-medium text-foreground">{selectedEvent.currentViews.toLocaleString()}</span>
                  </span>
                  {selectedEvent.currentLikes !== undefined && (
                    <span className="text-muted-foreground">
                      讚 <span className="font-medium text-foreground">{selectedEvent.currentLikes.toLocaleString()}</span>
                    </span>
                  )}
                </div>
              )}

              {/* 貼文內容 */}
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-sm whitespace-pre-wrap">
                  {selectedEvent.text || "(無文字內容)"}
                </p>
              </div>

              {/* 發布人與建立時間 */}
              <p className="text-xs text-muted-foreground">
                {selectedEvent.source === "synced" ? (
                  <>發布於 {formatDateTime(selectedEvent.createdAt)}</>
                ) : (
                  <>由 {selectedEvent.creatorName || "未知"} 建立於 {formatDateTime(selectedEvent.createdAt)}</>
                )}
              </p>
            </div>
          )}
          <DialogFooter>
            {selectedEvent && selectedEvent.source !== "synced" && (
              <Button
                variant="destructive"
                disabled={selectedEvent.status !== "scheduled" && selectedEvent.status !== "publishing"}
                onClick={() => {
                  setDeletePostId(selectedEvent.id);
                  setSelectedEvent(null);
                }}
              >
                <Trash2 className="mr-2 size-4" />
                取消排程
              </Button>
            )}
            <Button variant="outline" onClick={() => setSelectedEvent(null)}>
              關閉
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 調整時間確認對話框 */}
      <AlertDialog open={!!rescheduleEvent} onOpenChange={() => setRescheduleEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>調整排程時間</AlertDialogTitle>
            <AlertDialogDescription>
              確定要將排程時間調整為 {rescheduleEvent && formatDateTime(rescheduleEvent.newStart)} 嗎？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmReschedule}
              disabled={isRescheduling}
            >
              {isRescheduling ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  處理中...
                </>
              ) : (
                "確定調整"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
