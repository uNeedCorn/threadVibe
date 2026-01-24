"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PostInputList } from "./post-input-list";
import { HealthCheckAnalytics } from "../lib/analytics";
import type { HealthCheckResult, RateLimitInfo } from "./health-check-client";

interface CheckFormProps {
  onSubmitResult: (result: HealthCheckResult, rateLimit: RateLimitInfo) => void;
  initialRateLimit: RateLimitInfo | null;
}

export function CheckForm({ onSubmitResult, initialRateLimit }: CheckFormProps) {
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
    if (!hasStarted && (followers || posts.some((p) => p.views))) {
      setHasStarted(true);
      HealthCheckAnalytics.startForm();
    }
  }, [followers, posts, hasStarted]);

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
            followers: followersNum,
            posts: validPosts,
          }),
        }
      );

      const data = await response.json();

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

      onSubmitResult(data.result, data.rateLimit);
    } catch {
      setError("網路錯誤，請稍後再試");
      setIsSubmitting(false);
    }
  };

  const remainingChecks = initialRateLimit?.remaining ?? 3;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl text-center">
            Threads 健康檢測
          </CardTitle>
          <p className="text-center text-muted-foreground">
            輸入數據，立即分析帳號健康狀態
          </p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 剩餘次數 */}
            <div className="text-center text-sm text-muted-foreground">
              今日剩餘檢測次數：
              <span className="font-semibold text-foreground">
                {remainingChecks}
              </span>{" "}
              次
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
              className="w-full"
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
                "開始檢測"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
