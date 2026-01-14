"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Users,
  Loader2,
  Check,
  X,
  AlertCircle,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Trash2,
} from "lucide-react";

interface WaitlistEntry {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  threads_username: string | null;
  user_type: "personal" | "agency" | "brand" | null;
  follower_tier: "under1k" | "1k-10k" | "10k-50k" | "50k+" | null;
  managed_accounts: string | null;
  referral_source: "friend" | "social" | "search" | "other" | null;
  content_type: "lifestyle" | "knowledge" | "brand" | "other" | null;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  notes: string | null;
}

const USER_TYPE_LABELS: Record<string, string> = {
  personal: "個人創作者",
  agency: "代理商/小編",
  brand: "品牌/企業",
};

const FOLLOWER_TIER_LABELS: Record<string, string> = {
  "under1k": "1K 以下",
  "1k-10k": "1K-10K",
  "10k-50k": "10K-50K",
  "50k+": "50K+",
};

const REFERRAL_SOURCE_LABELS: Record<string, string> = {
  friend: "朋友推薦",
  social: "社群貼文",
  search: "搜尋引擎",
  other: "其他",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  lifestyle: "生活分享",
  knowledge: "知識教學",
  brand: "品牌行銷",
  other: "其他",
};

export default function WaitlistPage() {
  const { isAdmin, isLoading: isUserLoading } = useCurrentUser();
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 審核對話框
  const [selectedEntry, setSelectedEntry] = useState<WaitlistEntry | null>(null);
  const [reviewAction, setReviewAction] = useState<"approve" | "reject" | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 刪除對話框
  const [deleteEntry, setDeleteEntry] = useState<WaitlistEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("beta_waitlist")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setEntries(data || []);
    } catch (err) {
      console.error("Failed to fetch waitlist:", err);
      setError("載入等待名單失敗");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchEntries();
    }
  }, [isAdmin, fetchEntries]);

  const handleReview = async () => {
    if (!selectedEntry || !reviewAction) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      const { error: updateError } = await supabase
        .from("beta_waitlist")
        .update({
          status: reviewAction === "approve" ? "approved" : "rejected",
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id,
          notes: reviewNotes.trim() || null,
        })
        .eq("id", selectedEntry.id);

      if (updateError) throw updateError;

      setSelectedEntry(null);
      setReviewAction(null);
      setReviewNotes("");
      fetchEntries();
    } catch (err) {
      console.error("Failed to review entry:", err);
      setError("審核失敗，請稍後再試");
    } finally {
      setIsSubmitting(false);
    }
  };

  const openReviewDialog = (entry: WaitlistEntry, action: "approve" | "reject") => {
    setSelectedEntry(entry);
    setReviewAction(action);
    setReviewNotes(entry.notes || "");
  };

  const closeDialog = () => {
    setSelectedEntry(null);
    setReviewAction(null);
    setReviewNotes("");
  };

  const handleDelete = async () => {
    if (!deleteEntry) return;

    setIsDeleting(true);
    setError(null);

    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("beta_waitlist")
        .delete()
        .eq("id", deleteEntry.id);

      if (deleteError) throw deleteError;

      setDeleteEntry(null);
      fetchEntries();
    } catch (err) {
      console.error("Failed to delete entry:", err);
      setError("刪除失敗，請稍後再試");
    } finally {
      setIsDeleting(false);
    }
  };

  if (isUserLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="size-4" />
        <AlertDescription>您沒有權限訪問此頁面</AlertDescription>
      </Alert>
    );
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const pendingCount = entries.filter((e) => e.status === "pending").length;
  const approvedCount = entries.filter((e) => e.status === "approved").length;
  const rejectedCount = entries.filter((e) => e.status === "rejected").length;

  const StatusBadge = ({ status }: { status: WaitlistEntry["status"] }) => {
    switch (status) {
      case "pending":
        return (
          <Badge variant="outline" className="gap-1">
            <Clock className="size-3" />
            待審核
          </Badge>
        );
      case "approved":
        return (
          <Badge variant="default" className="gap-1 bg-green-600">
            <CheckCircle2 className="size-3" />
            已通過
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="size-3" />
            已拒絕
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">等待名單管理</h1>
        <p className="text-muted-foreground">
          審核 Beta 測試申請，通過後可發送邀請碼
        </p>
      </div>

      {/* 統計 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>總申請數</CardDescription>
            <CardTitle className="text-3xl">{entries.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>待審核</CardDescription>
            <CardTitle className="text-3xl text-amber-600">
              {pendingCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>已通過</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {approvedCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>已拒絕</CardDescription>
            <CardTitle className="text-3xl text-red-600">
              {rejectedCount}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* 錯誤訊息 */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 等待名單 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="size-5" />
            申請列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              尚無申請
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>申請者</TableHead>
                    <TableHead>Threads 帳號</TableHead>
                    <TableHead>身份/粉絲</TableHead>
                    <TableHead>內容類型</TableHead>
                    <TableHead>管理帳號</TableHead>
                    <TableHead>來源</TableHead>
                    <TableHead>申請原因</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>申請時間</TableHead>
                    <TableHead className="w-[140px]">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{entry.name || "未提供"}</p>
                          <p className="text-sm text-muted-foreground">
                            {entry.email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.threads_username ? (
                          <a
                            href={`https://www.threads.net/@${entry.threads_username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            @{entry.threads_username}
                            <ExternalLink className="size-3" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">未提供</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {entry.user_type && (
                            <Badge variant="outline" className="text-xs">
                              {USER_TYPE_LABELS[entry.user_type] || entry.user_type}
                            </Badge>
                          )}
                          {entry.follower_tier && (
                            <p className="text-xs text-muted-foreground">
                              {FOLLOWER_TIER_LABELS[entry.follower_tier] || entry.follower_tier}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {entry.content_type ? (
                          <span className="text-sm">
                            {CONTENT_TYPE_LABELS[entry.content_type] || entry.content_type}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.managed_accounts ? (
                          <span className="text-sm max-w-[120px] truncate block" title={entry.managed_accounts}>
                            {entry.managed_accounts}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.referral_source ? (
                          <span className="text-sm">
                            {REFERRAL_SOURCE_LABELS[entry.referral_source] || entry.referral_source}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.reason ? (
                          <span className="text-sm max-w-[150px] truncate block" title={entry.reason}>
                            {entry.reason}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={entry.status} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(entry.created_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          {entry.status === "pending" && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={() => openReviewDialog(entry, "approve")}
                              >
                                <Check className="size-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => openReviewDialog(entry, "reject")}
                              >
                                <X className="size-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-muted-foreground hover:text-red-600 hover:bg-red-50"
                            onClick={() => setDeleteEntry(entry)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 審核對話框 */}
      <Dialog open={!!selectedEntry && !!reviewAction} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approve" ? "通過申請" : "拒絕申請"}
            </DialogTitle>
            <DialogDescription>
              {reviewAction === "approve"
                ? "確認通過此申請後，您需要另外發送邀請碼給用戶"
                : "確認拒絕此申請"}
            </DialogDescription>
          </DialogHeader>

          {selectedEntry && (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">申請者</span>
                    <span className="font-medium">{selectedEntry.name || selectedEntry.email}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Email</span>
                    <span>{selectedEntry.email}</span>
                  </div>
                  {selectedEntry.threads_username && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Threads</span>
                      <a
                        href={`https://www.threads.net/@${selectedEntry.threads_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        @{selectedEntry.threads_username}
                      </a>
                    </div>
                  )}
                  {selectedEntry.user_type && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">身份類型</span>
                      <span>{USER_TYPE_LABELS[selectedEntry.user_type] || selectedEntry.user_type}</span>
                    </div>
                  )}
                  {selectedEntry.follower_tier && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">粉絲數量</span>
                      <span>{FOLLOWER_TIER_LABELS[selectedEntry.follower_tier] || selectedEntry.follower_tier}</span>
                    </div>
                  )}
                  {selectedEntry.content_type && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">內容類型</span>
                      <span>{CONTENT_TYPE_LABELS[selectedEntry.content_type] || selectedEntry.content_type}</span>
                    </div>
                  )}
                  {selectedEntry.referral_source && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">得知來源</span>
                      <span>{REFERRAL_SOURCE_LABELS[selectedEntry.referral_source] || selectedEntry.referral_source}</span>
                    </div>
                  )}
                  {selectedEntry.managed_accounts && (
                    <div className="pt-2 border-t">
                      <p className="text-muted-foreground mb-1">管理的帳號</p>
                      <p className="break-all">{selectedEntry.managed_accounts}</p>
                    </div>
                  )}
                  {selectedEntry.reason && (
                    <div className="pt-2 border-t">
                      <p className="text-muted-foreground mb-1">申請原因</p>
                      <p>{selectedEntry.reason}</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">備註（選填）</Label>
                <Textarea
                  id="notes"
                  placeholder="內部備註..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>
              取消
            </Button>
            <Button
              variant={reviewAction === "approve" ? "default" : "destructive"}
              onClick={handleReview}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : reviewAction === "approve" ? (
                <Check className="mr-2 size-4" />
              ) : (
                <X className="mr-2 size-4" />
              )}
              {reviewAction === "approve" ? "確認通過" : "確認拒絕"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 刪除確認對話框 */}
      <Dialog open={!!deleteEntry} onOpenChange={() => setDeleteEntry(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>確認刪除</DialogTitle>
            <DialogDescription>
              確定要刪除此申請記錄嗎？此操作無法復原。
            </DialogDescription>
          </DialogHeader>

          {deleteEntry && (
            <div className="rounded-lg bg-muted p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">申請者</span>
                  <span className="font-medium">{deleteEntry.name || deleteEntry.email}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email</span>
                  <span>{deleteEntry.email}</span>
                </div>
                {deleteEntry.threads_username && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Threads</span>
                    <span>@{deleteEntry.threads_username}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteEntry(null)}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              確認刪除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
