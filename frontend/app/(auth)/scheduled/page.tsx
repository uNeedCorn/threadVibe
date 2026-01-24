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

interface Profile {
  id: string;
  display_name: string | null;
}

// 合併後的貼文資料
interface ScheduledPostWithCreator extends ScheduledPost {
  creatorName: string | null;
}

type StatusTabValue = "scheduled" | "published" | "failed";
type ViewMode = "list" | "calendar";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock; color: string }> = {
  scheduled: { label: "排程中", variant: "secondary", icon: Clock, color: SCHEDULE_STATUS_COLORS.scheduled },
  publishing: { label: "發布中", variant: "default", icon: Loader2, color: SCHEDULE_STATUS_COLORS.publishing },
  published: { label: "已發布", variant: "outline", icon: Send, color: SCHEDULE_STATUS_COLORS.published },
  failed: { label: "發布失敗", variant: "destructive", icon: AlertCircle, color: SCHEDULE_STATUS_COLORS.failed },
  cancelled: { label: "已取消", variant: "outline", icon: Trash2, color: SCHEDULE_STATUS_COLORS.cancelled },
};

export default function ScheduledPage() {
  const { selectedAccount, isLoading: isLoadingAccount } = useSelectedAccountContext();
  const [posts, setPosts] = useState<ScheduledPostWithCreator[]>([]);
  const [allPosts, setAllPosts] = useState<ScheduledPostWithCreator[]>([]); // 日曆用：所有狀態
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
    postsData: ScheduledPost[]
  ): Promise<ScheduledPostWithCreator[]> => {
    if (postsData.length === 0) return [];

    const supabase = createClient();
    const userIds = [...new Set(postsData.map(p => p.created_by))];

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
      creatorName: profileMap.get(post.created_by) || null,
    }));
  }, []);

  // 載入所有排程貼文（日曆視圖用）
  useEffect(() => {
    if (!selectedAccount) {
      setAllPosts([]);
      return;
    }

    async function fetchAllPosts() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("workspace_threads_outbound_posts")
        .select("id, text, media_type, scheduled_at, publish_status, created_at, published_at, threads_post_id, error_message, created_by, topic_tag")
        .eq("workspace_threads_account_id", selectedAccount!.id)
        .is("deleted_at", null)
        .order("scheduled_at", { ascending: true });

      if (error) {
        console.error("Error fetching all posts:", error);
      } else {
        const postsWithCreators = await fetchPostsWithProfiles(data || []);
        setAllPosts(postsWithCreators);
      }
    }

    fetchAllPosts();
  }, [selectedAccount, fetchPostsWithProfiles]);

  // 載入篩選後的排程貼文（清單視圖用）
  useEffect(() => {
    if (!selectedAccount || viewMode === "calendar") {
      return;
    }

    async function fetchPosts() {
      setIsLoadingPosts(true);
      const supabase = createClient();

      let statusFilter: string[];
      switch (activeTab) {
        case "scheduled":
          statusFilter = ["scheduled", "publishing"];
          break;
        case "published":
          statusFilter = ["published"];
          break;
        case "failed":
          statusFilter = ["failed", "cancelled"];
          break;
        default:
          statusFilter = ["scheduled"];
      }

      const { data, error } = await supabase
        .from("workspace_threads_outbound_posts")
        .select("id, text, media_type, scheduled_at, publish_status, created_at, published_at, threads_post_id, error_message, created_by, topic_tag")
        .eq("workspace_threads_account_id", selectedAccount!.id)
        .is("deleted_at", null)
        .in("publish_status", statusFilter)
        .order("scheduled_at", { ascending: activeTab === "scheduled" });

      if (error) {
        console.error("Error fetching posts:", error);
        toast.error("載入排程貼文失敗");
      } else {
        const postsWithCreators = await fetchPostsWithProfiles(data || []);
        setPosts(postsWithCreators);
      }

      setIsLoadingPosts(false);
    }

    fetchPosts();
  }, [selectedAccount, activeTab, viewMode, fetchPostsWithProfiles]);

  // 轉換為日曆事件（使用 allPosts）
  const calendarEvents: ScheduleEvent[] = useMemo(() => {
    return allPosts.map((post) => {
      const start = new Date(post.scheduled_at);
      const end = new Date(start.getTime() + 30 * 60 * 1000); // 30 分鐘
      const text = post.text?.trim() || "(無文字)";
      return {
        id: post.id,
        title: text.length > 10 ? text.slice(0, 10) + "…" : text,
        start,
        end,
        status: post.publish_status,
        mediaType: post.media_type,
        text: post.text,
        createdAt: new Date(post.created_at),
        creatorName: post.creatorName,
        topicTag: post.topic_tag,
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
    if (!event || event.publish_status !== "scheduled") {
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
      const updatePost = (p: ScheduledPostWithCreator): ScheduledPostWithCreator =>
        p.id === rescheduleEvent.id
          ? { ...p, scheduled_at: rescheduleEvent.newStart.toISOString() }
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
  const groupPostsByDate = (posts: ScheduledPost[]) => {
    const groups: Record<string, ScheduledPost[]> = {};
    posts.forEach((post) => {
      const date = new Date(post.scheduled_at).toISOString().split("T")[0];
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
                        {formatDate(groupedPosts[date][0].scheduled_at)}
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        ({groupedPosts[date].length} 篇)
                      </span>
                    </div>
                    <div className="space-y-3">
                      {groupedPosts[date].map((post) => {
                        const statusConfig = STATUS_CONFIG[post.publish_status] || STATUS_CONFIG.scheduled;
                        const StatusIcon = statusConfig.icon;

                        return (
                          <Card key={post.id}>
                            <CardContent className="relative pt-4 pb-8">
                              <div className="flex items-start gap-4 pr-10">
                                {/* 時間 */}
                                <div className="flex flex-col items-center text-center min-w-[60px]">
                                  <span className="text-lg font-semibold tabular-nums">
                                    {formatTime(post.scheduled_at)}
                                  </span>
                                  {activeTab === "scheduled" && (
                                    <span className="text-xs text-muted-foreground">
                                      {getTimeUntil(post.scheduled_at)}
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
                                由 {(post as ScheduledPostWithCreator).creatorName || "未知"} 建立於 {formatDateTime(new Date(post.created_at))}
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
            <DialogTitle>排程貼文</DialogTitle>
            <DialogDescription>
              排程時間：{selectedEvent && formatDateTime(selectedEvent.start)}
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

              {/* 貼文內容 */}
              <div className="rounded-lg border bg-muted/30 p-3">
                <p className="text-sm whitespace-pre-wrap">
                  {selectedEvent.text || "(無文字內容)"}
                </p>
              </div>

              {/* 發布人與建立時間 */}
              <p className="text-xs text-muted-foreground">
                由 {selectedEvent.creatorName || "未知"} 建立於 {formatDateTime(selectedEvent.createdAt)}
              </p>
            </div>
          )}
          <DialogFooter>
            {selectedEvent && (
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
