"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Clock, LogOut, RefreshCw } from "lucide-react";

type WaitlistStatus = "pending" | "approved" | "rejected" | null;

export default function WaitlistPendingPage() {
  const [status, setStatus] = useState<WaitlistStatus>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const checkStatus = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user?.email) {
      setIsLoading(false);
      return;
    }

    setEmail(user.email);

    const { data: waitlistEntry } = await supabase
      .from("beta_waitlist")
      .select("status")
      .eq("email", user.email)
      .maybeSingle();

    setStatus(waitlistEntry?.status || null);
    setIsLoading(false);

    // 如果已通過審核，重新導向
    if (waitlistEntry?.status === "approved") {
      window.location.href = "/settings";
    }
  };

  useEffect(() => {
    checkStatus();
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await checkStatus();
    setIsRefreshing(false);
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin">
          <RefreshCw className="size-8 text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-orange-100">
            <BarChart3 className="size-8 text-orange-600" />
          </div>
          <CardTitle className="text-2xl">Postlyzer</CardTitle>
          <CardDescription>
            {status === "pending" && "申請審核中"}
            {status === "rejected" && "申請未通過"}
            {!status && "尚未申請"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {status === "pending" && (
            <div className="text-center space-y-4">
              <div className="flex items-center justify-center gap-2 text-amber-600">
                <Clock className="size-5" />
                <span className="font-medium">等待審核中</span>
              </div>
              <p className="text-sm text-muted-foreground">
                感謝您申請 Postlyzer Beta 測試！
                <br />
                我們正在審核您的申請，通過後會發送通知。
              </p>
              <p className="text-xs text-muted-foreground">
                您的申請信箱：{email}
              </p>
            </div>
          )}

          {status === "rejected" && (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                很抱歉，您的申請未通過審核。
                <br />
                如有疑問，請聯繫我們。
              </p>
            </div>
          )}

          {!status && (
            <div className="text-center space-y-4">
              <p className="text-sm text-muted-foreground">
                您尚未申請 Beta 測試。
                <br />
                請先在首頁提交申請。
              </p>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.location.href = "/"}
              >
                前往首頁申請
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-4 border-t">
            <Button
              variant="outline"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full"
            >
              {isRefreshing ? (
                <RefreshCw className="mr-2 size-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 size-4" />
              )}
              重新檢查狀態
            </Button>
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full text-muted-foreground"
            >
              <LogOut className="mr-2 size-4" />
              登出
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
