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
} from "lucide-react";

interface WaitlistEntry {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  threads_username: string | null;
  reason: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at: string | null;
  notes: string | null;
}

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
                    <TableHead>申請原因</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>申請時間</TableHead>
                    <TableHead className="w-[120px]">操作</TableHead>
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
                      <TableCell className="max-w-[200px]">
                        <p className="truncate text-sm text-muted-foreground">
                          {entry.reason || "-"}
                        </p>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={entry.status} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(entry.created_at)}
                      </TableCell>
                      <TableCell>
                        {entry.status === "pending" && (
                          <div className="flex items-center gap-1">
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
                          </div>
                        )}
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
    </div>
  );
}
