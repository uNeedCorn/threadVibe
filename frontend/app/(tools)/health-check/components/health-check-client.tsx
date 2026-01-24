"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { LandingSection } from "./landing-section";
import { CheckForm } from "./check-form";
import { ResultSection } from "./result-section";
import { HealthCheckAnalytics } from "../lib/analytics";

type PageState = "landing" | "form" | "result";

export interface HealthCheckResult {
  cumulative: { value: number; status: string; label: string };
  max: { value: number; status: string; label: string };
  latest: { value: number; status: string; label: string };
  inCooldown: boolean;
  conclusion: string;
  recommendations: string[];
}

export interface RateLimitInfo {
  remaining: number;
  resetAt: string;
}

export function HealthCheckClient() {
  const [pageState, setPageState] = useState<PageState>("landing");
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [result, setResult] = useState<HealthCheckResult | null>(null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(null);

  useEffect(() => {
    const supabase = createClient();

    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAuthenticated(!!session);
      setPageState(session ? "form" : "landing");
      setIsLoading(false);

      if (!session) {
        HealthCheckAnalytics.viewLanding();
      }
    }

    checkAuth();

    // 監聽認證狀態變化
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setIsAuthenticated(!!session);
        // 只在未登入或從 landing 頁面登入時切換狀態
        // 不要覆蓋 result 狀態
        if (!session) {
          setPageState("landing");
        } else {
          setPageState((prev) => (prev === "landing" ? "form" : prev));
        }
      }
    );

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogin = async () => {
    HealthCheckAnalytics.clickLogin();
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/health-check`,
      },
    });
  };

  const handleSubmitResult = (
    newResult: HealthCheckResult,
    newRateLimit: RateLimitInfo
  ) => {
    console.log("[HealthCheck] handleSubmitResult called:", { newResult, newRateLimit });
    setResult(newResult);
    setRateLimit(newRateLimit);
    setPageState("result");
    console.log("[HealthCheck] pageState set to 'result'");
    HealthCheckAnalytics.viewResult(newResult.max.status);
  };

  const handleTryAgain = () => {
    HealthCheckAnalytics.clickAgain();
    setResult(null);
    setPageState("form");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">載入中...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {pageState === "landing" && <LandingSection onLogin={handleLogin} />}

      {pageState === "form" && (
        <CheckForm
          onSubmitResult={handleSubmitResult}
          initialRateLimit={rateLimit}
        />
      )}

      {pageState === "result" && result && (
        <ResultSection
          result={result}
          rateLimit={rateLimit}
          onTryAgain={handleTryAgain}
        />
      )}
    </div>
  );
}
