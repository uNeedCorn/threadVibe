import { LoginForm } from "./login-form";

export default function LoginPage() {
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

        {/* Login Form */}
        <LoginForm />

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
      </div>
    </div>
  );
}
