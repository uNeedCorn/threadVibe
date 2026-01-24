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
        if (session && pageState === "landing") {
          setPageState("form");
        } else if (!session) {
          setPageState("landing");
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [pageState]);

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
    setResult(newResult);
    setRateLimit(newRateLimit);
    setPageState("result");
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
