"use client";

import { useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { LoginForm } from "./login-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle } from "lucide-react";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

function LoginPageContent() {
  const searchParams = useSearchParams();
  const errorParam = searchParams.get("error");
  const reasonParam = searchParams.get("reason");

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  const resetTurnstile = () => {
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo & Branding */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <Image
              src="/logo-icon.png"
              alt="Postlyzer"
              width={48}
              height={48}
              className="rounded-xl"
            />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Postlyzer</h1>
          <p className="text-muted-foreground">
            追蹤、分析你的 Threads 貼文成效
          </p>
        </div>

        {/* Error Message */}
        {errorParam && (
          <Alert variant="destructive">
            <AlertCircle className="size-4" />
            <AlertDescription>
              登入失敗
              {reasonParam && (
                <details className="mt-2 text-xs">
                  <summary className="cursor-pointer">詳細資訊</summary>
                  <pre className="mt-1 whitespace-pre-wrap">{decodeURIComponent(reasonParam)}</pre>
                </details>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Login Form - 簡化版，不需要邀請碼 */}
        <LoginForm
          turnstileToken={turnstileToken}
          turnstileError={turnstileError}
          setTurnstileError={setTurnstileError}
          resetTurnstile={resetTurnstile}
        />

        {/* Terms & Privacy */}
        <div className="text-center text-xs text-muted-foreground">
          <p>
            登入即表示你同意我們的{" "}
            <a href="/terms" className="text-primary hover:underline">
              服務條款
            </a>{" "}
            和{" "}
            <a href="/privacy" className="text-primary hover:underline">
              隱私政策
            </a>
          </p>
        </div>

        {/* Turnstile Widget */}
        {TURNSTILE_SITE_KEY && (
          <div className="flex justify-center">
            <Turnstile
              ref={turnstileRef}
              siteKey={TURNSTILE_SITE_KEY}
              onSuccess={(token) => {
                setTurnstileToken(token);
                setTurnstileError(null);
              }}
              onError={() => {
                setTurnstileError("人機驗證載入失敗，請重新整理頁面");
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
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}
