"use client";

import { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Edit2,
  Loader2,
  MoreHorizontal,
  Trash2,
  Eye,
  Send,
  AlertCircle,
  Plus,
} from "lucide-react";
import Link from "next/link";
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
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useSelectedAccountContext } from "@/contexts/selected-account-context";

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
}

type TabValue = "scheduled" | "published" | "failed";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  scheduled: { label: "排程中", variant: "secondary", icon: Clock },
  publishing: { label: "發布中", variant: "default", icon: Loader2 },
  published: { label: "已發布", variant: "outline", icon: Send },
  failed: { label: "發布失敗", variant: "destructive", icon: AlertCircle },
  cancelled: { label: "已取消", variant: "outline", icon: Trash2 },
};

export default function ScheduledPage() {
  const { selectedAccount, isLoading: isLoadingAccount } = useSelectedAccountContext();
  const [posts, setPosts] = useState<ScheduledPost[]>([]);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>("scheduled");
  const [deletePostId, setDeletePostId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // 載入排程貼文
  useEffect(() => {
    if (!selectedAccount) {
      setPosts([]);
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
        .select("id, text, media_type, scheduled_at, publish_status, created_at, published_at, threads_post_id, error_message")
        .eq("workspace_threads_account_id", selectedAccount!.id)
        .in("publish_status", statusFilter)
        .order("scheduled_at", { ascending: activeTab === "scheduled" });

      if (error) {
        console.error("Error fetching posts:", error);
        toast.error("載入排程貼文失敗");
      } else {
        setPosts(data || []);
      }

      setIsLoadingPosts(false);
    }

    fetchPosts();
  }, [selectedAccount, activeTab]);

  // 取消排程
  const handleCancelSchedule = async (postId: string) => {
    setIsDeleting(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("workspace_threads_outbound_posts")
        .update({ publish_status: "cancelled" })
        .eq("id", postId);

      if (error) throw error;

      toast.success("已取消排程");
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    } catch {
      toast.error("取消排程失敗");
    } finally {
      setIsDeleting(false);
      setDeletePostId(null);
    }
  };

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
    <div className="container max-w-4xl py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">排程管理</h1>
          <p className="text-sm text-muted-foreground">
            管理已排程的貼文
          </p>
        </div>
        <Button asChild>
          <Link href="/compose">
            <Plus className="mr-2 size-4" />
            新增貼文
          </Link>
        </Button>
      </div>

      {/* 帳號資訊 */}
      {isLoadingAccount ? (
        <Card className="mb-6">
          <CardContent className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            載入帳號中...
          </CardContent>
        </Card>
      ) : !selectedAccount ? (
        <Card className="mb-6">
          <CardContent className="py-4">
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
              <p className="text-sm text-destructive">
                尚未選擇 Threads 帳號，請先在側邊欄選擇帳號
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="mb-6">
          <CardContent className="flex items-center gap-3 py-4">
            <Avatar className="size-10">
              <AvatarImage src={selectedAccount.profilePicUrl || undefined} />
              <AvatarFallback>
                {selectedAccount.username.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">@{selectedAccount.username}</p>
              <p className="text-sm text-muted-foreground">排程貼文帳號</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabValue)}>
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
              <CardContent className="py-12 text-center">
                <Calendar className="mx-auto mb-4 size-12 text-muted-foreground/50" />
                <p className="text-muted-foreground">
                  {activeTab === "scheduled" && "目前沒有排程中的貼文"}
                  {activeTab === "published" && "目前沒有已發布的排程貼文"}
                  {activeTab === "failed" && "沒有發布失敗的貼文"}
                </p>
                {activeTab === "scheduled" && (
                  <Button asChild variant="outline" className="mt-4">
                    <Link href="/compose">建立新貼文</Link>
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {sortedDates.map((date) => (
                <div key={date}>
                  <div className="mb-3 flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" />
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
                          <CardContent className="flex items-start gap-4 py-4">
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
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant={statusConfig.variant} className="gap-1">
                                  <StatusIcon className={cn("size-3", post.publish_status === "publishing" && "animate-spin")} />
                                  {statusConfig.label}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {post.media_type}
                                </Badge>
                              </div>
                              <p className="text-sm line-clamp-2">
                                {post.text || "(無文字內容)"}
                              </p>
                              {post.error_message && (
                                <p className="mt-1 text-xs text-destructive">
                                  錯誤：{post.error_message}
                                </p>
                              )}
                            </div>

                            {/* 操作 */}
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
    </div>
  );
}
