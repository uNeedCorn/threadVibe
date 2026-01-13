"use client";

import { useState, useEffect, Suspense, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { createClient } from "@/lib/supabase/client";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Loader2,
  KeyRound,
  AlertCircle,
  Clock,
  CheckCircle2,
  LogOut,
} from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CODE: "邀請碼無效，請確認後重新輸入",
  ALREADY_USED: "此邀請碼已被使用",
  EXPIRED: "此邀請碼已過期",
  ALREADY_REGISTERED: "您已經完成註冊",
  UNAUTHORIZED: "請先登入",
  INTERNAL_ERROR: "系統錯誤，請稍後再試",
  VALIDATION_FAILED: "驗證失敗，請稍後再試",
  WORKSPACE_CREATION_FAILED: "建立工作區失敗，請稍後再試",
  MEMBER_CREATION_FAILED: "建立成員失敗，請稍後再試",
};

type WaitlistStatus = "pending" | "approved" | "rejected" | null;

function InvitationPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/settings";

  // 邀請碼狀態
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Waitlist 狀態
  const [waitlistStatus, setWaitlistStatus] = useState<WaitlistStatus>(null);
  const [isCheckingWaitlist, setIsCheckingWaitlist] = useState(true);
  const [threadsUsername, setThreadsUsername] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmittingWaitlist, setIsSubmittingWaitlist] = useState(false);
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false);

  // Turnstile 狀態
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  // 檢查 waitlist 狀態
  useEffect(() => {
    async function checkWaitlist() {
      try {
        const response = await fetch("/api/waitlist");
        const result = await response.json();

        if (result.success && result.inWaitlist) {
          setWaitlistStatus(result.status);
          setWaitlistSubmitted(true);
        }
      } catch (err) {
        console.error("Failed to check waitlist:", err);
      } finally {
        setIsCheckingWaitlist(false);
      }
    }

    checkWaitlist();
  }, []);

  const handleSubmitCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!code.trim()) {
      setError("請輸入邀請碼");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 先驗證邀請碼
      const validateResponse = await fetch("/api/invitation/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      const validateResult = await validateResponse.json();

      if (!validateResult.valid) {
        setError(ERROR_MESSAGES[validateResult.error] || "邀請碼無效");
        setIsLoading(false);
        return;
      }

      // 使用邀請碼並完成註冊
      const useResponse = await fetch("/api/invitation/use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });

      const useResult = await useResponse.json();

      if (!useResult.success) {
        setError(ERROR_MESSAGES[useResult.error] || "註冊失敗，請稍後再試");
        setIsLoading(false);
        return;
      }

      // 成功，導向設定頁面
      const redirectUrl = new URL(next, window.location.origin);
      if (useResult.workspaceId) {
        redirectUrl.searchParams.set("workspace_id", useResult.workspaceId);
      }
      router.push(redirectUrl.toString());
    } catch (err) {
      console.error("Invitation error:", err);
      setError("系統錯誤，請稍後再試");
      setIsLoading(false);
    }
  };

  const handleSubmitWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 如果有設定 Turnstile，必須先驗證
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError("請先完成人機驗證");
      return;
    }

    setIsSubmittingWaitlist(true);

    try {
      // 驗證 Turnstile token（如果有設定）
      if (TURNSTILE_SITE_KEY && turnstileToken) {
        const verifyResponse = await fetch("/api/turnstile/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: turnstileToken }),
        });

        const verifyResult = await verifyResponse.json();

        if (!verifyResult.success) {
          setError("人機驗證失敗，請重試");
          setTurnstileToken(null);
          turnstileRef.current?.reset();
          setIsSubmittingWaitlist(false);
          return;
        }
      }

      const response = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          threadsUsername: threadsUsername.trim(),
          reason: reason.trim(),
        }),
      });

      const result = await response.json();

      if (result.success) {
        setWaitlistSubmitted(true);
        setWaitlistStatus(result.status || "pending");
      } else {
        setError("加入等待名單失敗，請稍後再試");
      }
    } catch (err) {
      console.error("Waitlist error:", err);
      setError("系統錯誤，請稍後再試");
    } finally {
      setIsSubmittingWaitlist(false);
    }
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  if (isCheckingWaitlist) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // 已在 waitlist 中
  if (waitlistSubmitted && waitlistStatus) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-amber-100">
              <Clock className="size-6 text-amber-600" />
            </div>
            <CardTitle className="text-2xl">已加入等待名單</CardTitle>
            <CardDescription>
              感謝您的興趣！我們會盡快審核您的申請
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg bg-muted p-4 text-center">
              <p className="text-sm text-muted-foreground mb-1">目前狀態</p>
              <div className="flex items-center justify-center gap-2">
                {waitlistStatus === "pending" && (
                  <>
                    <Clock className="size-4 text-amber-500" />
                    <span className="font-medium text-amber-600">審核中</span>
                  </>
                )}
                {waitlistStatus === "approved" && (
                  <>
                    <CheckCircle2 className="size-4 text-green-500" />
                    <span className="font-medium text-green-600">已通過</span>
                  </>
                )}
                {waitlistStatus === "rejected" && (
                  <>
                    <AlertCircle className="size-4 text-red-500" />
                    <span className="font-medium text-red-600">未通過</span>
                  </>
                )}
              </div>
            </div>

            <p className="text-sm text-center text-muted-foreground">
              審核通過後，我們會發送邀請碼到您的信箱
            </p>

            {/* 如果有邀請碼，顯示輸入框 */}
            <div className="pt-4 border-t">
              <p className="text-sm text-center text-muted-foreground mb-4">
                已經收到邀請碼了嗎？
              </p>
              <form onSubmit={handleSubmitCode} className="space-y-3">
                <Input
                  type="text"
                  placeholder="輸入邀請碼"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength={8}
                  className="text-center font-mono"
                  disabled={isLoading}
                />
                {error && (
                  <p className="text-sm text-destructive text-center">{error}</p>
                )}
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !code.trim()}
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    "驗證邀請碼"
                  )}
                </Button>
              </form>
            </div>

            <Button
              variant="ghost"
              className="w-full"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 size-4" />
              登出並使用其他帳號
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="size-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Beta 測試階段</CardTitle>
          <CardDescription>
            目前僅開放邀請制，請輸入邀請碼或加入等待名單
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="code" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="code">我有邀請碼</TabsTrigger>
              <TabsTrigger value="waitlist">加入等待名單</TabsTrigger>
            </TabsList>

            <TabsContent value="code" className="space-y-4 pt-4">
              <form onSubmit={handleSubmitCode} className="space-y-4">
                {error && (
                  <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <Label htmlFor="code">邀請碼</Label>
                  <Input
                    id="code"
                    type="text"
                    placeholder="請輸入 8 碼邀請碼"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={8}
                    className="text-center text-lg tracking-widest font-mono"
                    autoFocus
                    disabled={isLoading}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || !code.trim()}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      驗證中...
                    </>
                  ) : (
                    "確認並完成註冊"
                  )}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="waitlist" className="space-y-4 pt-4">
              <form onSubmit={handleSubmitWaitlist} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="threadsUsername">
                    您的 Threads 帳號 <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      @
                    </span>
                    <Input
                      id="threadsUsername"
                      placeholder="your_username"
                      value={threadsUsername}
                      onChange={(e) => setThreadsUsername(e.target.value.replace(/^@/, ""))}
                      className="pl-8"
                      disabled={isSubmittingWaitlist}
                      required
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    我們會查看您的 Threads 帳號以審核申請
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">
                    您想如何使用 Postlyzer？（選填）
                  </Label>
                  <Textarea
                    id="reason"
                    placeholder="例如：我是 Threads 創作者，想追蹤貼文成效..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    disabled={isSubmittingWaitlist}
                  />
                </div>

                {/* Turnstile Widget */}
                {TURNSTILE_SITE_KEY && (
                  <div className="flex justify-center">
                    <Turnstile
                      ref={turnstileRef}
                      siteKey={TURNSTILE_SITE_KEY}
                      onSuccess={(token) => setTurnstileToken(token)}
                      onError={() => {
                        setError("人機驗證載入失敗，請重新整理頁面");
                        setTurnstileToken(null);
                      }}
                      onExpire={() => {
                        setTurnstileToken(null);
                      }}
                      options={{
                        theme: "auto",
                        size: "normal",
                      }}
                    />
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmittingWaitlist || !threadsUsername.trim() || (TURNSTILE_SITE_KEY ? !turnstileToken : false)}
                >
                  {isSubmittingWaitlist ? (
                    <>
                      <Loader2 className="mr-2 size-4 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    "加入等待名單"
                  )}
                </Button>
              </form>

              <p className="text-xs text-center text-muted-foreground">
                加入等待名單後，我們會審核您的申請並發送邀請碼到您的信箱
              </p>
            </TabsContent>
          </Tabs>

          <div className="mt-6 pt-4 border-t">
            <Button
              variant="ghost"
              className="w-full"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 size-4" />
              登出並使用其他帳號
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function InvitationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <InvitationPageContent />
    </Suspense>
  );
}
