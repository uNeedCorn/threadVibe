"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

interface LoginFormProps {
  turnstileToken: string | null;
  turnstileError: string | null;
  setTurnstileError: (error: string | null) => void;
  resetTurnstile: () => void;
}

export function LoginForm({
  turnstileToken,
  turnstileError,
  setTurnstileError,
  resetTurnstile,
}: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setError(null);
    setTurnstileError(null);

    // 如果有設定 Turnstile，必須先驗證
    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError("請先完成下方的人機驗證");
      return;
    }

    setIsLoading(true);

    try {
      // 驗證 Turnstile token（如果有設定）
      if (TURNSTILE_SITE_KEY && turnstileToken) {
        try {
          const verifyResponse = await fetch("/api/turnstile/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: turnstileToken }),
          });

          if (!verifyResponse.ok) {
            console.error("Turnstile verify failed:", verifyResponse.status, verifyResponse.statusText);
            setError(`人機驗證失敗 (${verifyResponse.status})，請重試`);
            resetTurnstile();
            setIsLoading(false);
            return;
          }

          const verifyResult = await verifyResponse.json();

          if (!verifyResult.success) {
            setError("人機驗證失敗，請重試");
            resetTurnstile();
            setIsLoading(false);
            return;
          }
        } catch (verifyError) {
          console.error("Turnstile verify error:", verifyError);
          setError("人機驗證請求失敗，請重試");
          resetTurnstile();
          setIsLoading(false);
          return;
        }
      }

      // 進行 Google OAuth 登入
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (authError) {
        console.error("Login error:", authError);
        setError("登入失敗，請稍後再試");
        setIsLoading(false);
      }
    } catch (err) {
      console.error("Login error:", err);
      setError("登入失敗，請稍後再試");
      setIsLoading(false);
    }
  };

  const displayError = error || turnstileError;

  return (
    <div className="space-y-4">
      {displayError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      )}

      <Button
        onClick={handleGoogleLogin}
        disabled={isLoading || (TURNSTILE_SITE_KEY ? !turnstileToken : false)}
        className="w-full h-12 text-base"
        variant="outline"
      >
        {isLoading ? (
          <Loader2 className="size-5 animate-spin" />
        ) : (
          <>
            <svg className="size-5 mr-2" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            使用 Google 帳號登入
          </>
        )}
      </Button>
    </div>
  );
}
