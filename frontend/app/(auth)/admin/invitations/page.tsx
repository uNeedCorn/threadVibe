"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  KeyRound,
  Plus,
  Loader2,
  Copy,
  Check,
  Trash2,
  AlertCircle,
} from "lucide-react";

interface InvitationCode {
  id: string;
  code: string;
  email: string | null;
  is_used: boolean;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
  expires_at: string | null;
  note: string | null;
}

export default function InvitationsPage() {
  const { isAdmin, isLoading: isUserLoading } = useCurrentUser();
  const [codes, setCodes] = useState<InvitationCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 產生邀請碼對話框
  const [isGenerating, setIsGenerating] = useState(false);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchCodes = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: fetchError } = await supabase
        .from("invitation_codes")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) throw fetchError;
      setCodes(data || []);
    } catch (err) {
      console.error("Failed to fetch invitation codes:", err);
      setError("載入邀請碼失敗");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchCodes();
    }
  }, [isAdmin, fetchCodes]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const supabase = createClient();
      const { data, error: genError } = await supabase.rpc(
        "generate_invitation_code",
        {
          p_email: email.trim().toLowerCase() || null,
          p_note: note.trim() || null,
          p_expires_at: null,
        }
      );

      if (genError) throw genError;

      setGeneratedCode(data);
      fetchCodes();
    } catch (err) {
      console.error("Failed to generate invitation code:", err);
      setError("產生邀請碼失敗");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (generatedCode) {
      await navigator.clipboard.writeText(generatedCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("確定要刪除此邀請碼？")) return;

    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from("invitation_codes")
        .delete()
        .eq("id", id);

      if (deleteError) throw deleteError;
      fetchCodes();
    } catch (err) {
      console.error("Failed to delete invitation code:", err);
      setError("刪除邀請碼失敗");
    }
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEmail("");
    setNote("");
    setGeneratedCode(null);
    setCopied(false);
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

  const unboundCount = codes.filter((c) => !c.email).length;
  const boundCount = codes.filter((c) => c.email).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">邀請碼管理</h1>
          <p className="text-muted-foreground">
            管理 Beta 測試邀請碼，控制新使用者註冊
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 size-4" />
              產生邀請碼
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>產生新邀請碼</DialogTitle>
              <DialogDescription>
                產生一組新的邀請碼。可指定 Email 限制特定用戶使用，或留空讓第一個使用者自動綁定。
              </DialogDescription>
            </DialogHeader>

            {generatedCode ? (
              <div className="space-y-4">
                <div className="p-4 bg-muted rounded-lg text-center">
                  <p className="text-sm text-muted-foreground mb-2">
                    新邀請碼已產生
                  </p>
                  <p className="text-2xl font-mono font-bold tracking-widest">
                    {generatedCode}
                  </p>
                  {email && (
                    <p className="text-sm text-muted-foreground mt-2">
                      已綁定：{email}
                    </p>
                  )}
                </div>
                <Button
                  onClick={handleCopy}
                  variant="outline"
                  className="w-full"
                >
                  {copied ? (
                    <>
                      <Check className="mr-2 size-4" />
                      已複製
                    </>
                  ) : (
                    <>
                      <Copy className="mr-2 size-4" />
                      複製邀請碼
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email（選填）</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="user@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isGenerating}
                  />
                  <p className="text-xs text-muted-foreground">
                    指定後只有此 Email 可使用。留空則由第一個使用者自動綁定。
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="note">備註（選填）</Label>
                  <Input
                    id="note"
                    placeholder="例如：給 XXX 使用"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    disabled={isGenerating}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              {generatedCode ? (
                <Button onClick={handleDialogClose}>完成</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={handleDialogClose}>
                    取消
                  </Button>
                  <Button onClick={handleGenerate} disabled={isGenerating}>
                    {isGenerating ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" />
                        產生中...
                      </>
                    ) : (
                      "產生"
                    )}
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* 統計 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>總邀請碼</CardDescription>
            <CardTitle className="text-3xl">{codes.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>未綁定</CardDescription>
            <CardTitle className="text-3xl text-green-600">
              {unboundCount}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>已綁定</CardDescription>
            <CardTitle className="text-3xl text-muted-foreground">
              {boundCount}
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

      {/* 邀請碼列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="size-5" />
            邀請碼列表
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="size-8 animate-spin text-muted-foreground" />
            </div>
          ) : codes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              尚無邀請碼，點擊上方按鈕產生
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>邀請碼</TableHead>
                    <TableHead>綁定 Email</TableHead>
                    <TableHead>狀態</TableHead>
                    <TableHead>備註</TableHead>
                    <TableHead>建立時間</TableHead>
                    <TableHead>使用時間</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {codes.map((code) => (
                    <TableRow key={code.id}>
                      <TableCell className="font-mono font-medium">
                        {code.code}
                      </TableCell>
                      <TableCell className="text-sm">
                        {code.email || (
                          <span className="text-muted-foreground">未綁定</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {code.email ? (
                          <Badge variant="outline">已綁定</Badge>
                        ) : (
                          <Badge variant="default">可用</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {code.note || "-"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {formatDate(code.created_at)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {code.used_at ? formatDate(code.used_at) : "-"}
                      </TableCell>
                      <TableCell>
                        {!code.email && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(code.id)}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
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
    </div>
  );
}
