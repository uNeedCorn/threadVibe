"use client";

import { useState, useRef, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { LoginForm } from "./login-form";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, KeyRound } from "lucide-react";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

const ERROR_MESSAGES: Record<string, string> = {
  auth_failed: "登入失敗，請稀後再試",
  no_invitation: "需要邀請碼才能註冊",
  invalid_invitation: "邀請碼無效",
  expired_invitation: "邀請碼已過期",
  email_already_bound: "此邀請碼已被其他帳號使用",
  workspace_failed: "建立工作區失敗，請稍後再試",
};

function LoginPageContent() {
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get("code");
  const errorParam = searchParams.get("error");

  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileError, setTurnstileError] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileInstance>(null);

  // 邀請碼驗證狀態
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [isCodeValid, setIsCodeValid] = useState<boolean | null>(null);
  const [codeError, setCodeError] = useState<string | null>(
    errorParam ? ERROR_MESSAGES[errorParam] || "發生錯誤" : null
  );

  const resetTurnstile = () => {
    setTurnstileToken(null);
    turnstileRef.current?.reset();
  };

  // 驗證邀請碼
  useEffect(() => {
    async function validateCode() {
      if (!inviteCode) {
        setIsCodeValid(false);
        return;
      }

      setIsValidatingCode(true);
      setCodeError(null);

      try {
        const response = await fetch("/api/invitation/validate-public", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: inviteCode.trim().toUpperCase() }),
        });

        const result = await response.json();

        if (result.valid) {
          setIsCodeValid(true);
          // 將邀請碼存入 cookie，供 OAuth callback 使用
          document.cookie = `invitation_code=${inviteCode.trim().toUpperCase()}; path=/; max-age=3600; SameSite=Lax; Secure`;
        } else {
          setIsCodeValid(false);
          setCodeError(
            result.error === "EXPIRED" ? "此邀請碼已過期" : "邀請碼無效"
          );
        }
      } catch (err) {
        console.error("Failed to validate code:", err);
        setIsCodeValid(false);
        setCodeError("驗證失敗，請稍後再試");
      } finally {
        setIsValidatingCode(false);
      }
    }

    validateCode();
  }, [inviteCode]);

  // 載入中
  if (isValidatingCode) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">驗證邀請碼中...</p>
        </div>
      </div>
    );
  }

  // 沒有邀請碼或邀請碼無效
  if (!isCodeValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm space-y-8">
          {/* Logo & Branding */}
          <div className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                <KeyRound className="size-6" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-foreground">Postlyzer</h1>
            <p className="text-muted-foreground">Beta 測試階段</p>
          </div>

          {/* 提示訊息 */}
          <div className="text-center space-y-4">
            {codeError ? (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{codeError}</AlertDescription>
              </Alert>
            ) : (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                <p className="text-sm text-amber-800">
                  目前僅開放邀請制註冊，請使用含有邀請碼的連結登入。
                </p>
              </div>
            )}

            <p className="text-sm text-muted-foreground">
              如需申請邀請碼，請前往
              <a href="/" className="text-primary hover:underline ml-1">
                首頁申請試用
              </a>
            </p>
          </div>

          <div className="text-center">
            <Button variant="outline" asChild>
              <a href="/">返回首頁</a>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 邀請碼有效，顯示登入表單
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo & Branding */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-6"
              >
                <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
                <path d="M8.5 8.5v.01" />
                <path d="M16 15.5v.01" />
                <path d="M12 12v.01" />
                <path d="M11 17v.01" />
                <path d="M7 14v.01" />
              </svg>
            </div>
          </div>
          <h1 className="text-2xl font-bold text-foreground">Postlyzer</h1>
          <p className="text-muted-foreground">
            追蹤、分析你的 Threads 貼文成效
          </p>
        </div>

        {/* 邀請碼確認 */}
        <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-center">
          <p className="text-sm text-green-800">
            邀請碼有效，請使用 Google 帳號登入
          </p>
        </div>

        {/* Login Form */}
        <LoginForm
          turnstileToken={turnstileToken}
          turnstileError={turnstileError}
          setTurnstileError={setTurnstileError}
          resetTurnstile={resetTurnstile}
        />

        {/* Description */}
        <div className="text-center text-sm text-muted-foreground space-y-4">
          <p>
            登入後即可連結你的 Threads 帳號，<br />
            查看貼文成效、粉絲成長趨勢等數據分析。
          </p>
        </div>

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
