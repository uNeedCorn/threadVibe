"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, Activity, ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PostInputList } from "./post-input-list";
import { HealthCheckAnalytics } from "../lib/analytics";
import type { HealthCheckResult, RateLimitInfo } from "./health-check-client";

interface CheckFormProps {
  onSubmitResult: (result: HealthCheckResult, rateLimit: RateLimitInfo) => void;
  initialRateLimit: RateLimitInfo | null;
  source?: string;
}

const DEFAULT_SOURCE = "Threads 限流測試器";

export function CheckForm({ onSubmitResult, initialRateLimit, source = DEFAULT_SOURCE }: CheckFormProps) {
  const [threadsId, setThreadsId] = useState("");
  const [followers, setFollowers] = useState("");
  const [posts, setPosts] = useState<{ id: string; views: string }[]>([
    { id: crypto.randomUUID(), views: "" },
  ]);
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasStarted, setHasStarted] = useState(false);

  // 追蹤開始填寫
  useEffect(() => {
    if (!hasStarted && (threadsId || followers || posts.some((p) => p.views))) {
      setHasStarted(true);
      HealthCheckAnalytics.startForm();
    }
  }, [threadsId, followers, posts, hasStarted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 驗證
    const followersNum = parseInt(followers, 10);
    if (isNaN(followersNum) || followersNum < 1) {
      setError("請輸入有效的粉絲數");
      return;
    }

    const validPosts = posts
      .map((p) => ({ views: parseInt(p.views, 10) }))
      .filter((p) => !isNaN(p.views) && p.views >= 0);

    if (validPosts.length === 0) {
      setError("請至少輸入一篇貼文的曝光數");
      return;
    }

    if (!agreed) {
      setError("請勾選同意免責聲明");
      return;
    }

    setIsSubmitting(true);
    HealthCheckAnalytics.submit(validPosts.length);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setError("請先登入");
        setIsSubmitting(false);
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/health-check`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            threadsId: threadsId.trim() || undefined,
            followers: followersNum,
            posts: validPosts,
            source,
          }),
        }
      );

      const data = await response.json();
      console.log("[HealthCheck] API response:", { status: response.status, data });

      if (!response.ok) {
        if (response.status === 429) {
          HealthCheckAnalytics.rateLimited();
          setError(data.error || "今日檢測次數已用完");
        } else {
          setError(data.error || "檢測失敗，請稍後再試");
        }
        setIsSubmitting(false);
        return;
      }

      console.log("[HealthCheck] Calling onSubmitResult with:", data.result, data.rateLimit);
      onSubmitResult(data.result, data.rateLimit);
    } catch {
      setError("網路錯誤，請稍後再試");
      setIsSubmitting(false);
    }
  };

  const remainingChecks = initialRateLimit?.remaining ?? 3;
  const maxChecks = 3;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <Card className="relative w-full max-w-lg overflow-hidden border-primary/20">
        {/* Top gradient decoration bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/60 via-primary to-primary/60" />

        <CardHeader className="pt-8">
          <div className="flex justify-center mb-4">
            <div className="flex items-center justify-center size-12 rounded-full bg-primary/10">
              <Activity className="size-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">
            Threads 健康檢測
          </CardTitle>
          <p className="text-center text-muted-foreground">
            輸入數據，立即分析帳號健康狀態
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 剩餘次數 - 圓點進度指示器 */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-sm text-muted-foreground">
                今日剩餘檢測次數
              </span>
              <div className="flex items-center gap-2">
                {Array.from({ length: maxChecks }).map((_, i) => (
                  <div
                    key={i}
                    className={`size-3 rounded-full transition-colors ${
                      i < remainingChecks
                        ? "bg-primary"
                        : "bg-muted-foreground/20"
                    }`}
                  />
                ))}
                <span className="ml-2 text-sm font-medium">
                  {remainingChecks}/{maxChecks}
                </span>
              </div>
            </div>

            {/* Threads ID */}
            <div className="space-y-2">
              <Label htmlFor="threadsId">Threads ID</Label>
              <Input
                id="threadsId"
                type="text"
                placeholder="例如：postlyzer"
                value={threadsId}
                onChange={(e) => setThreadsId(e.target.value)}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                選填，輸入你的 Threads 帳號 ID（不含 @）
              </p>
            </div>

            {/* 粉絲數 */}
            <div className="space-y-2">
              <Label htmlFor="followers">
                粉絲數 <span className="text-destructive">*</span>
              </Label>
              <Input
                id="followers"
                type="number"
                placeholder="例如：1000"
                value={followers}
                onChange={(e) => setFollowers(e.target.value)}
                min={1}
                max={100000000}
                required
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                請輸入你目前的 Threads 粉絲數
              </p>
            </div>

            {/* 貼文曝光數列表 */}
            <div className="space-y-2">
              <Label>
                貼文曝光數 <span className="text-destructive">*</span>
              </Label>
              <PostInputList
                posts={posts}
                onChange={setPosts}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                請輸入近期貼文的曝光數，第一篇視為最新貼文
              </p>
            </div>

            {/* 免責聲明 */}
            <div className="flex items-start gap-2">
              <Checkbox
                id="agree"
                checked={agreed}
                onCheckedChange={(checked) => setAgreed(checked === true)}
                disabled={isSubmitting}
              />
              <label
                htmlFor="agree"
                className="text-sm text-muted-foreground leading-tight cursor-pointer"
              >
                我了解此工具僅供參考，結果不代表 Threads 官方判斷，
                Postlyzer 不對任何結果負責。
              </label>
            </div>

            {/* 錯誤訊息 */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* 提交按鈕 */}
            <Button
              type="submit"
              className="group w-full"
              size="lg"
              disabled={isSubmitting || remainingChecks <= 0}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  檢測中...
                </>
              ) : remainingChecks <= 0 ? (
                "今日次數已用完"
              ) : (
                <>
                  開始檢測
                  <ArrowRight className="ml-2 size-4 transition-transform group-hover:translate-x-1" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
